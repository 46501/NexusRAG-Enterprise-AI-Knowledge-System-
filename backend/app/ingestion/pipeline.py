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
    texts = [c.contextual_text for c in chunks]
    vectors = embed(texts)

    _ensure_collection(client, vector_size=len(vectors[0]))

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vectors[i],
            payload={
                "text": chunks[i].text,
                "contextual_text": chunks[i].contextual_text,
                "section": chunks[i].section,
                "context_prefix": chunks[i].context_prefix,
                "chunk_index": chunks[i].chunk_index,
                "total_chunks": len(chunks),
                "doc_id": doc_meta.doc_id,
                "source": doc_meta.source,
                "role_access": doc_meta.role_access,
            },
        )
        for i in range(len(chunks))
    ]
    client.upsert(collection_name=_s.qdrant_collection, points=points)
    logger.info("Upserted %d chunks to Qdrant for doc_id=%s", len(points), doc_meta.doc_id)

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
    all_points = []
    while True:
        batch, next_offset = client.scroll(
            collection_name=_s.qdrant_collection,
            scroll_filter=None,
            limit=1000,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        all_points.extend(batch)
        if next_offset is None:
            break
        offset = next_offset

    for point in all_points:
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

    save_sparse_index(corpus_texts, doc_metadata)
    logger.info("BM25 index rebuilt with %d chunks", len(corpus_texts))
