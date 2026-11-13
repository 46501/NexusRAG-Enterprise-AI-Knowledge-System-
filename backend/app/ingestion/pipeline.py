import uuid
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
    OptimizersConfigDiff,
    HnswConfigDiff,
)
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Document, RoleEnum
from app.ingestion.chunker import chunk_text
from app.ingestion.loader import load_document
from app.ingestion.metadata import build_doc_meta
from app.retrieval.embedder import embed
from app.retrieval.sparse import save_sparse_index
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()


def _ensure_collection(client: QdrantClient, vector_size: int) -> None:
    existing = [c.name for c in client.get_collections().collections]
    if _s.qdrant_collection in existing:
        return
    client.create_collection(
        collection_name=_s.qdrant_collection,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        hnsw_config=HnswConfigDiff(on_disk=True),
        optimizers_config=OptimizersConfigDiff(memmap_threshold=20000),
        on_disk_payload=True,
    )
    logger.info("Created Qdrant collection %s", _s.qdrant_collection)


def ingest_file(
    file_path: Path,
    role_access: str,
    db: Session,
    uploader_id: str | None = None,
    original_filename: str | None = None,
) -> str:
    display_name = original_filename or file_path.name
    logger.info("Ingesting %s as role_access=%s", display_name, role_access)

    raw_text = load_document(file_path)
    from app.security.guardrails import sanitize_text_for_ingestion
    clean_text, warnings = sanitize_text_for_ingestion(raw_text)
    if warnings:
        for w in warnings:
            logger.warning("Ingestion security notice for %s: %s", display_name, w)
    chunks = chunk_text(clean_text, doc_title=display_name, department=role_access)

    doc_meta = build_doc_meta(file_path, role_access, original_filename=original_filename)

    if _s.qdrant_url:
        client = QdrantClient(url=_s.qdrant_url, api_key=_s.qdrant_api_key, check_compatibility=False, timeout=10.0)
    else:
        client = QdrantClient(host=_s.qdrant_host, port=_s.qdrant_port, check_compatibility=False, timeout=10.0)

    # Process and upsert chunks in slices of 16 to avoid large in-memory tensor arrays
    INGEST_BATCH_SIZE = 16
    total_chunks = len(chunks)
    vector_dim = None

    for start_idx in range(0, total_chunks, INGEST_BATCH_SIZE):
        chunk_slice = chunks[start_idx : start_idx + INGEST_BATCH_SIZE]
        texts_slice = [c.contextual_text for c in chunk_slice]
        vectors_slice = embed(texts_slice)
        if vector_dim is None and vectors_slice:
            vector_dim = len(vectors_slice[0])
            _ensure_collection(client, vector_size=vector_dim)

        points_slice = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vectors_slice[j],
                payload={
                    "text": chunk_slice[j].text,
                    "contextual_text": chunk_slice[j].contextual_text,
                    "section": chunk_slice[j].section,
                    "context_prefix": chunk_slice[j].context_prefix,
                    "chunk_index": chunk_slice[j].chunk_index,
                    "total_chunks": total_chunks,
                    "doc_id": doc_meta.doc_id,
                    "source": doc_meta.source,
                    "role_access": doc_meta.role_access,
                },
            )
            for j in range(len(chunk_slice))
        ]
        client.upsert(collection_name=_s.qdrant_collection, points=points_slice)

    logger.info("Upserted %d chunks to Qdrant for doc_id=%s in batches of %d", total_chunks, doc_meta.doc_id, INGEST_BATCH_SIZE)

    doc_record = Document(
        id=uuid.UUID(doc_meta.doc_id),
        name=display_name,
        department=RoleEnum(role_access),
        chunk_count=len(chunks),
        uploaded_by=uuid.UUID(uploader_id) if uploader_id else None,
    )
    db.add(doc_record)
    db.flush()

    logger.info("Saved Document record %s to Postgres", doc_meta.doc_id)
    return doc_meta.doc_id


def rebuild_bm25_index(db: Session | None = None) -> None:
    corpus_texts: list[str] = []
    doc_metadata: list[dict] = []

    if _s.qdrant_url:
        client = QdrantClient(url=_s.qdrant_url, api_key=_s.qdrant_api_key, check_compatibility=False, timeout=10.0)
    else:
        client = QdrantClient(host=_s.qdrant_host, port=_s.qdrant_port, check_compatibility=False, timeout=10.0)

    offset = None
    while True:
        batch, next_offset = client.scroll(
            collection_name=_s.qdrant_collection,
            scroll_filter=None,
            limit=500,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for point in batch:
            payload = point.payload or {}
            corpus_texts.append(payload.get("contextual_text") or payload.get("text", ""))
            doc_metadata.append({
                "id": str(point.id),
                "text": payload.get("text", ""),
                "contextual_text": payload.get("contextual_text", ""),
                "section": payload.get("section", ""),
                "doc_id": payload.get("doc_id"),
                "source": payload.get("source"),
                "role_access": payload.get("role_access"),
                "chunk_index": payload.get("chunk_index"),
                "total_chunks": payload.get("total_chunks"),
            })
        if next_offset is None:
            break
        offset = next_offset

    save_sparse_index(corpus_texts, doc_metadata)
    from app.retrieval.sparse import reload_sparse_index
    reload_sparse_index()
    import gc
    gc.collect()
    logger.info("BM25 index rebuilt and reloaded with %d chunks", len(corpus_texts))
