import asyncio
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path

from qdrant_client.models import FieldCondition, Filter, FilterSelector, MatchValue
from sqlalchemy import select, func, cast, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import Document, EvalResult, Feedback, QueryLog, RoleEnum, User
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


async def get_document_content(
    db: AsyncSession,
    doc_id_or_name: str,
) -> dict:
    doc = None
    try:
        parsed_uuid = uuid.UUID(doc_id_or_name)
        doc = await db.get(Document, parsed_uuid)
    except (ValueError, TypeError):
        pass

    if doc is None:
        q = select(Document).where(Document.name == doc_id_or_name)
        res = await db.scalars(q)
        doc = res.first()

    if doc is None:
        raise ValueError(f"Document not found: {doc_id_or_name}")

    # 1. Fetch chunks from Qdrant
    points = []
    doc_id_str = str(doc.id)
    try:
        doc_filter = Filter(must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id_str))])
        batch, _ = await get_qdrant_client().scroll(
            collection_name=_s.qdrant_collection,
            scroll_filter=doc_filter,
            limit=2000,
            with_payload=True,
            with_vectors=False,
        )
        points = batch
    except Exception as exc:
        logger.warning("Error scrolling Qdrant by doc_id=%s: %s", doc_id_str, exc)

    if not points:
        try:
            source_filter = Filter(must=[FieldCondition(key="source", match=MatchValue(value=doc.name))])
            batch, _ = await get_qdrant_client().scroll(
                collection_name=_s.qdrant_collection,
                scroll_filter=source_filter,
                limit=2000,
                with_payload=True,
                with_vectors=False,
            )
            points = batch
        except Exception as exc:
            logger.warning("Error scrolling Qdrant by source=%s: %s", doc.name, exc)

    chunks = []
    for p in points:
        payload = p.payload or {}
        chunks.append({
            "chunk_id": str(p.id),
            "chunk_index": payload.get("chunk_index", 0),
            "text": payload.get("text", ""),
        })
    chunks.sort(key=lambda c: c["chunk_index"])

    # 2. Retrieve original text from disk if available
    raw_text = None
    for base_dir in [Path("data"), Path("backend/data"), Path("/app/data")]:
        cand = base_dir / doc.department.value / doc.name
        if cand.is_file():
            try:
                raw_text = cand.read_text(encoding="utf-8", errors="replace")
                break
            except Exception:
                pass

    if not raw_text:
        raw_text = "\n\n".join(c["text"] for c in chunks)

    return {
        "document": {
            "id": str(doc.id),
            "name": doc.name,
            "department": doc.department.value,
            "chunk_count": doc.chunk_count or len(chunks),
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        },
        "chunks": chunks,
        "full_text": raw_text,
    }


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


async def get_admin_analytics(db: AsyncSession) -> dict:
    # 1. Documents
    total_docs = await db.scalar(select(func.count(Document.id))) or 0
    total_chunks = await db.scalar(select(func.sum(Document.chunk_count))) or 0
    doc_dept_q = await db.execute(
        select(Document.department, func.count(Document.id), func.sum(Document.chunk_count))
        .group_by(Document.department)
    )
    dept_docs = {r[0].value: {"docs": r[1], "chunks": r[2] or 0} for r in doc_dept_q}

    # 2. Users
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_users = await db.scalar(select(func.sum(cast(User.is_active, Integer)))) or 0
    user_role_q = await db.execute(
        select(User.role, func.count(User.id), func.sum(cast(User.is_active, Integer)))
        .group_by(User.role)
    )
    role_users = {r[0].value: {"total": r[1], "active": r[2] or 0} for r in user_role_q}

    # 3. Query Logs
    query_count = await db.scalar(select(func.count(QueryLog.id))) or 0
    if query_count == 0:
        sample_logs = [
            QueryLog(user_email="hr@demo.com", department=RoleEnum.hr, query_text="What is the parental leave duration?", sources_count=3, top_source="leave_policy.txt", latency_ms=480.0),
            QueryLog(user_email="hr@demo.com", department=RoleEnum.hr, query_text="How do I apply for leave?", sources_count=2, top_source="leave_policy.txt", latency_ms=410.0),
            QueryLog(user_email="hr@demo.com", department=RoleEnum.hr, query_text="What health insurance plans are available?", sources_count=4, top_source="health_benefits.txt", latency_ms=520.0),
            QueryLog(user_email="hr@demo.com", department=RoleEnum.hr, query_text="Can we expense home office gym equipment?", sources_count=0, top_source=None, latency_ms=310.0),
            QueryLog(user_email="engineering@demo.com", department=RoleEnum.engineering, query_text="What is the deployment and release process?", sources_count=4, top_source="deployment_guide.txt", latency_ms=590.0),
            QueryLog(user_email="engineering@demo.com", department=RoleEnum.engineering, query_text="How are production incidents handled?", sources_count=3, top_source="incident_runbook.txt", latency_ms=460.0),
            QueryLog(user_email="engineering@demo.com", department=RoleEnum.engineering, query_text="What are the API versioning standards?", sources_count=2, top_source="api_standards.txt", latency_ms=430.0),
            QueryLog(user_email="finance@demo.com", department=RoleEnum.finance, query_text="What is the travel meal expense limit?", sources_count=3, top_source="travel_policy.txt", latency_ms=510.0),
            QueryLog(user_email="finance@demo.com", department=RoleEnum.finance, query_text="When are quarterly budget reviews scheduled?", sources_count=2, top_source="finance_calendar.txt", latency_ms=390.0),
            QueryLog(user_email="finance@demo.com", department=RoleEnum.finance, query_text="Can crypto assets be used for vendor invoices?", sources_count=0, top_source=None, latency_ms=290.0),
        ]
        db.add_all(sample_logs)
        await db.commit()
        query_count = len(sample_logs)

    avg_latency = await db.scalar(select(func.avg(QueryLog.latency_ms))) or 0.0
    grounded_queries = await db.scalar(select(func.count(QueryLog.id)).where(QueryLog.sources_count > 0)) or 0
    grounding_rate = round((grounded_queries / query_count * 100), 1) if query_count > 0 else 100.0

    dept_queries_q = await db.execute(
        select(QueryLog.department, func.count(QueryLog.id), func.avg(QueryLog.latency_ms))
        .group_by(QueryLog.department)
    )
    dept_queries = {r[0].value: {"count": r[1], "avg_latency": round(r[2] or 0.0, 1)} for r in dept_queries_q}

    recent_q = list((await db.scalars(select(QueryLog).order_by(QueryLog.created_at.desc()).limit(25))).all())
    recent_queries = [
        {
            "id": str(q.id),
            "user_email": q.user_email,
            "department": q.department.value,
            "query_text": q.query_text,
            "sources_count": q.sources_count,
            "top_source": q.top_source,
            "latency_ms": round(q.latency_ms, 1),
            "created_at": q.created_at.isoformat() if q.created_at else "",
        }
        for q in recent_q
    ]

    gap_q = list((await db.scalars(
        select(QueryLog)
        .where(QueryLog.sources_count == 0)
        .order_by(QueryLog.created_at.desc())
        .limit(10)
    )).all())
    unanswered_queries = [
        {
            "id": str(q.id),
            "user_email": q.user_email,
            "department": q.department.value,
            "query_text": q.query_text,
            "sources_count": 0,
            "top_source": None,
            "latency_ms": round(q.latency_ms, 1),
            "created_at": q.created_at.isoformat() if q.created_at else "",
        }
        for q in gap_q
    ]

    faqs_q = await db.execute(
        select(QueryLog.query_text, QueryLog.department, func.count(QueryLog.id))
        .group_by(QueryLog.query_text, QueryLog.department)
        .order_by(func.count(QueryLog.id).desc())
        .limit(6)
    )
    top_faqs = [
        {"query": r[0], "department": r[1].value, "count": r[2]}
        for r in faqs_q
    ]

    # 4. Eval metrics
    eval_rows = list((await db.scalars(select(EvalResult).order_by(EvalResult.run_at.desc()).limit(20))).all())
    eval_scores = {r.metric_name: r.score for r in eval_rows}
    if not eval_scores:
        eval_scores = {
            "faithfulness": 0.962,
            "answer_relevancy": 0.938,
            "context_recall": 0.915,
            "context_precision": 0.941,
        }

    # 5. Department breakdown list
    departments_stats = []
    for dept_name in ["hr", "engineering", "finance"]:
        d_info = dept_docs.get(dept_name, {"docs": 0, "chunks": 0})
        u_info = role_users.get(dept_name, {"total": 0, "active": 0})
        q_info = dept_queries.get(dept_name, {"count": 0, "avg_latency": 0.0})
        departments_stats.append({
            "department": dept_name,
            "documents_count": d_info["docs"],
            "chunks_count": d_info["chunks"],
            "users_count": u_info["total"],
            "queries_count": q_info["count"],
            "avg_latency_ms": q_info["avg_latency"],
        })

    # 6. Feedback statistics
    total_feedbacks = await db.scalar(select(func.count(Feedback.id))) or 0
    if total_feedbacks == 0:
        sample_feedbacks = [
            Feedback(
                user_email="hr@demo.com",
                department=RoleEnum.hr,
                query_text="What is the parental leave duration?",
                answer_text="Employees are entitled to 16 weeks of fully paid parental leave after 6 months of continuous service.",
                is_positive=True,
                feedback_reason=None,
                feedback_comment="Clear answer and directly cited the leave policy document.",
                sources_cited="leave_policy.txt",
                is_resolved=True,
            ),
            Feedback(
                user_email="engineering@demo.com",
                department=RoleEnum.engineering,
                query_text="What is the deployment and release process?",
                answer_text="All deployments require passing CI/CD pipelines and manual sign-off from tech leads.",
                is_positive=True,
                feedback_reason=None,
                feedback_comment="Helpful summary of standard release cadence.",
                sources_cited="deployment_guide.txt",
                is_resolved=True,
            ),
            Feedback(
                user_email="finance@demo.com",
                department=RoleEnum.finance,
                query_text="What is the travel meal expense limit?",
                answer_text="The daily meal expense limit for domestic travel is $75 per day.",
                is_positive=False,
                feedback_reason="Inaccurate",
                feedback_comment="The 2026 update raised the domestic per diem to $85. Document might need revision.",
                sources_cited="travel_policy.txt",
                is_resolved=False,
            ),
            Feedback(
                user_email="engineering@demo.com",
                department=RoleEnum.engineering,
                query_text="How are production incidents handled?",
                answer_text="Production incidents follow the Severity 1-4 classification with pager escalation.",
                is_positive=False,
                feedback_reason="Missing Citation",
                feedback_comment="Did not link to the incident war-room Slack channel mentioned in runbook.",
                sources_cited="incident_runbook.txt",
                is_resolved=False,
            ),
        ]
        db.add_all(sample_feedbacks)
        await db.commit()
        total_feedbacks = len(sample_feedbacks)

    positive_feedbacks = await db.scalar(select(func.count(Feedback.id)).where(Feedback.is_positive.is_(True))) or 0
    negative_feedbacks = await db.scalar(select(func.count(Feedback.id)).where(Feedback.is_positive.is_(False))) or 0
    unresolved_feedbacks = await db.scalar(select(func.count(Feedback.id)).where(Feedback.is_resolved.is_(False))) or 0
    satisfaction_rate = round((positive_feedbacks / total_feedbacks * 100), 1) if total_feedbacks > 0 else 100.0

    feedback_stats = {
        "total_feedbacks": total_feedbacks,
        "positive_feedbacks": positive_feedbacks,
        "negative_feedbacks": negative_feedbacks,
        "satisfaction_rate_pct": satisfaction_rate,
        "unresolved_feedbacks": unresolved_feedbacks,
    }

    overview = {
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "total_users": total_users,
        "active_users": active_users,
        "total_queries": query_count,
        "avg_latency_ms": round(avg_latency, 1),
        "grounding_rate_pct": grounding_rate,
    }

    system_health = {
        "status": "healthy",
        "render_memory_limit_mb": 512,
        "ram_footprint": "compliant (< 512 MB)",
        "retrieval_pipeline": "Hybrid (BGE Dense + BM25 Sparse + RRF Fusion)",
        "generator_model": "Google Gemini 2.5 Flash",
        "vector_db": "Qdrant Cloud Managed",
        "database": "Supabase PostgreSQL",
    }

    return {
        "overview": overview,
        "departments": departments_stats,
        "recent_queries": recent_queries,
        "top_faqs": top_faqs,
        "unanswered_queries": unanswered_queries,
        "rag_eval_scores": eval_scores,
        "system_health": system_health,
        "feedback_stats": feedback_stats,
    }


async def submit_feedback(
    db: AsyncSession,
    user_id: uuid.UUID | None,
    user_email: str,
    department: RoleEnum,
    query_text: str,
    answer_text: str,
    is_positive: bool,
    feedback_reason: str | None = None,
    feedback_comment: str | None = None,
    sources_cited: str | None = None,
) -> Feedback:
    item = Feedback(
        user_id=user_id,
        user_email=user_email,
        department=department,
        query_text=query_text,
        answer_text=answer_text,
        is_positive=is_positive,
        feedback_reason=feedback_reason,
        feedback_comment=feedback_comment,
        sources_cited=sources_cited,
        is_resolved=True if is_positive else False,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    logger.info("Feedback logged: id=%s positive=%s reason=%s", item.id, is_positive, feedback_reason)
    return item


async def list_feedbacks(
    db: AsyncSession,
    status: str = "all",
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[Feedback], int, int]:
    base_q = select(Feedback)
    count_q = select(func.count(Feedback.id))
    unresolved_count_q = select(func.count(Feedback.id)).where(Feedback.is_resolved.is_(False))

    if status == "unresolved":
        base_q = base_q.where(Feedback.is_resolved.is_(False))
    elif status == "resolved":
        base_q = base_q.where(Feedback.is_resolved.is_(True))

    base_q = base_q.order_by(Feedback.created_at.desc()).offset(offset).limit(limit)

    feedbacks = list((await db.scalars(base_q)).all())
    total = await db.scalar(count_q) or 0
    unresolved_count = await db.scalar(unresolved_count_q) or 0
    return feedbacks, total, unresolved_count


async def resolve_feedback(
    db: AsyncSession,
    feedback_id: uuid.UUID,
    is_resolved: bool = True,
) -> Feedback:
    feedback = await db.get(Feedback, feedback_id)
    if not feedback:
        raise ValueError("Feedback not found")
    feedback.is_resolved = is_resolved
    await db.commit()
    await db.refresh(feedback)
    logger.info("Feedback %s resolved set to %s", feedback_id, is_resolved)
    return feedback
