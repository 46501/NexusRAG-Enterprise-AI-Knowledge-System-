import asyncio
import math
import uuid
from datetime import datetime, timezone

from qdrant_client.models import FieldCondition, Filter, FilterSelector, MatchValue
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import Document, EvalResult, RoleEnum, User
from app.db.postgres import AsyncSessionLocal
from app.retrieval.dense import get_client as get_qdrant_client
from app.state import rag_slots_in_use
from app.utils.logger import get_logger

_s = get_settings()

logger = get_logger(__name__)

_eval_lock = asyncio.Lock()
EVAL_MAX_RAG_SLOTS_IN_USE = 2


class ServerUnderLoadError(Exception):
    pass


async def list_documents(
    db: AsyncSession,
    department: RoleEnum | None = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[Document], int]:
    q = select(Document)
    count_q = select(func.count()).select_from(Document)
    if department:
        q = q.where(Document.department == department)
        count_q = count_q.where(Document.department == department)
    q = q.order_by(Document.uploaded_at.desc()).offset(offset).limit(limit)
    docs = list((await db.scalars(q)).all())
    total = await db.scalar(count_q)
    logger.info("Listed %d documents (total=%d)", len(docs), total)
    return docs, total


async def _rebuild_bm25() -> None:
    from app.retrieval.sparse import save_sparse_index

    corpus_texts: list[str] = []
    doc_metadata: list[dict] = []
    offset = None

    logger.info("BM25 rebuild: scrolling Qdrant for remaining chunks")
    while True:
        batch, next_offset = await get_qdrant_client().scroll(
            collection_name=_s.qdrant_collection,
            scroll_filter=None,
            limit=1000,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for point in batch:
            corpus_texts.append(point.payload.get("text", ""))
            doc_metadata.append({
                "id": str(point.id),
                "text": point.payload.get("text", ""),
                "doc_id": point.payload.get("doc_id"),
                "source": point.payload.get("source"),
                "role_access": point.payload.get("role_access"),
                "chunk_index": point.payload.get("chunk_index"),
            })
        if next_offset is None:
            break
        offset = next_offset

    if not corpus_texts:
        logger.info("BM25 rebuild: no chunks remain — clearing index")
        from app.retrieval.sparse import clear_sparse_index
        await asyncio.to_thread(clear_sparse_index)
        return

    unique_doc_ids = {m["doc_id"] for m in doc_metadata}
    unique_sources = {m["source"] for m in doc_metadata}
    logger.info(
        "BM25 rebuild: fetched %d chunks across %d doc_ids, sources=%s",
        len(corpus_texts),
        len(unique_doc_ids),
        sorted(unique_sources),
    )

    logger.info("BM25 rebuild: writing index to disk")
    await asyncio.to_thread(save_sparse_index, corpus_texts, doc_metadata)
    logger.info("BM25 rebuild: saved — reloading in-memory index from disk")

    from app.retrieval.sparse import reload_sparse_index
    await asyncio.to_thread(reload_sparse_index)
    logger.info(
        "BM25 rebuild: complete — %d chunks, %d unique documents in new index",
        len(corpus_texts),
        len(unique_doc_ids),
    )


async def delete_document(db: AsyncSession, document_id: uuid.UUID) -> None:
    logger.info("delete_document called for document_id=%s", document_id)

    doc = await db.get(Document, document_id)
    logger.info("db.get result for document_id=%s: %s", document_id, doc)
    if not doc:
        raise ValueError(f"Document not found: {document_id}")

    doc_id_str = str(document_id)
    doc_filter = Filter(
        must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id_str))]
    )

    logger.info("Deleting Qdrant chunks for doc_id=%s", doc_id_str)
    await get_qdrant_client().delete(
        collection_name=_s.qdrant_collection,
        points_selector=FilterSelector(filter=doc_filter),
    )

    remaining = await get_qdrant_client().count(
        collection_name=_s.qdrant_collection,
        count_filter=doc_filter,
        exact=True,
    )
    logger.info(
        "Qdrant delete complete for doc_id=%s — chunks remaining: %d",
        doc_id_str,
        remaining.count,
    )

    logger.info("Deleting Postgres row for doc_id=%s", doc_id_str)
    await db.delete(doc)
    await db.commit()
    logger.info("Postgres commit complete for doc_id=%s", doc_id_str)

    logger.info("Rebuilding BM25 index after deletion of doc_id=%s", doc_id_str)
    await _rebuild_bm25()


async def list_users(
    db: AsyncSession,
    offset: int = 0,
    limit: int = 50,
) -> list[User]:
    q = select(User).order_by(User.created_at.desc()).offset(offset).limit(limit)
    users = list((await db.scalars(q)).all())
    logger.info("Listed %d users", len(users))
    return users


async def set_user_active(db: AsyncSession, user_id: uuid.UUID, is_active: bool) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise ValueError(f"User not found: {user_id}")
    user.is_active = is_active
    logger.info("Set user %s is_active=%s", user_id, is_active)
    return user


async def save_eval_results(
    run_id: uuid.UUID,
    scores: dict,
    run_at: datetime,
) -> int:
    saved = 0
    async with AsyncSessionLocal() as session:
        for metric_name, score in scores.items():
            if score is None or (isinstance(score, float) and math.isnan(score)):
                logger.warning("Skipping NaN score for metric=%s run_id=%s", metric_name, run_id)
                continue
            session.add(EvalResult(
                run_id=run_id,
                metric_name=metric_name,
                score=float(score),
                run_at=run_at,
            ))
            saved += 1
        await session.commit()
    logger.info("Persisted %d eval rows to Postgres for run_id=%s", saved, run_id)
    return saved


async def get_eval_results(
    db: AsyncSession,
    metric_name: str | None = None,
    limit: int = 100,
) -> list[EvalResult]:
    q = select(EvalResult)
    if metric_name:
        q = q.where(EvalResult.metric_name == metric_name)
    q = q.order_by(EvalResult.run_at.desc(), EvalResult.metric_name.asc()).limit(limit)
    rows = list((await db.scalars(q)).all())
    logger.info("Listed %d eval results", len(rows))
    return rows


async def trigger_eval_run() -> dict:
    in_use = rag_slots_in_use()
    if in_use > EVAL_MAX_RAG_SLOTS_IN_USE:
        logger.warning("Eval run rejected: %d RAG slots in use", in_use)
        raise ServerUnderLoadError("server under load, try again later")

    if _eval_lock.locked():
        raise RuntimeError("An evaluation run is already in progress")

    started_at = datetime.now(timezone.utc)

    async def _runner() -> None:
        async with _eval_lock:
            from eval.run_eval import run_evaluation
            try:
                await run_evaluation()
            except Exception as exc:
                logger.exception("Background eval run failed: %s", exc)

    asyncio.create_task(_runner())
    logger.info("Eval run triggered at %s", started_at.isoformat())
    return {"status": "started", "started_at": started_at}
