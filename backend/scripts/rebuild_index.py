import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from qdrant_client import QdrantClient

from app.config import get_settings
from app.retrieval.embedder import load_embedder
from app.retrieval.sparse import save_sparse_index
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()


def scroll_all_chunks(client: QdrantClient) -> list[dict]:
    corpus_texts: list[str] = []
    doc_metadata: list[dict] = []
    offset = None

    while True:
        results, next_offset = client.scroll(
            collection_name=_s.qdrant_collection,
            offset=offset,
            limit=1000,
            with_payload=True,
            with_vectors=False,
        )

        for point in results:
            p = point.payload
            text = p.get("text", "")
            if not text:
                continue
            corpus_texts.append(text)
            doc_metadata.append({
                "id": str(point.id),
                "text": text,
                "doc_id": p.get("doc_id", ""),
                "source": p.get("source", ""),
                "role_access": p.get("role_access", ""),
                "chunk_index": p.get("chunk_index", 0),
            })

        if next_offset is None:
            break
        offset = next_offset

    return corpus_texts, doc_metadata


def main() -> None:
    logger.info("Loading embedder (required by bm25s tokeniser path)...")
    load_embedder()

    client = QdrantClient(host=_s.qdrant_host, port=_s.qdrant_port)

    collections = [c.name for c in client.get_collections().collections]
    if _s.qdrant_collection not in collections:
        logger.error("Collection '%s' does not exist in Qdrant. Run ingestion first.", _s.qdrant_collection)
        sys.exit(1)

    logger.info("Scrolling all chunks from Qdrant collection '%s'...", _s.qdrant_collection)
    corpus_texts, doc_metadata = scroll_all_chunks(client)

    if not corpus_texts:
        logger.error("No chunks found in Qdrant. Nothing to index.")
        sys.exit(1)

    logger.info("Building BM25 index from %d chunks...", len(corpus_texts))
    save_sparse_index(corpus_texts, doc_metadata)
    logger.info("BM25 index rebuild complete.")


if __name__ == "__main__":
    main()
