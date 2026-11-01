import json
from pathlib import Path

import bm25s
import numpy as np

from app.utils.logger import get_logger

logger = get_logger(__name__)

_INDEX_PATH = Path("data/bm25_index")

_retriever: bm25s.BM25 | None = None
_doc_store: list[dict] | None = None


def load_sparse_index() -> None:
    global _retriever, _doc_store
    if not _INDEX_PATH.exists():
        logger.info("No BM25 index found at %s — sparse search disabled until ingestion runs", _INDEX_PATH)
        return
    _retriever = bm25s.BM25.load(str(_INDEX_PATH), load_corpus=False)
    with open(_INDEX_PATH / "doc_store.json") as f:
        _doc_store = json.load(f)
    logger.info("BM25 index loaded with %d documents", len(_doc_store))


def clear_sparse_index() -> None:
    global _retriever, _doc_store
    _retriever = None
    _doc_store = None
    if _INDEX_PATH.exists():
        for f in _INDEX_PATH.iterdir():
            f.unlink(missing_ok=True)
        logger.info("BM25 index files cleared from %s", _INDEX_PATH)
    logger.info("BM25 in-memory index cleared")


def reload_sparse_index() -> None:
    global _retriever, _doc_store
    if not _INDEX_PATH.exists():
        logger.warning("reload_sparse_index: index path %s not found, clearing in-memory index", _INDEX_PATH)
        _retriever = None
        _doc_store = None
        return
    _retriever = bm25s.BM25.load(str(_INDEX_PATH), load_corpus=False)
    with open(_INDEX_PATH / "doc_store.json") as f:
        _doc_store = json.load(f)
    logger.info("BM25 index reloaded from disk with %d documents", len(_doc_store))


def save_sparse_index(corpus_texts: list[str], doc_metadata: list[dict]) -> None:
    _INDEX_PATH.mkdir(parents=True, exist_ok=True)
    retriever = bm25s.BM25()
    tokens = bm25s.tokenize(corpus_texts)
    retriever.index(tokens)
    retriever.save(str(_INDEX_PATH))
    with open(_INDEX_PATH / "doc_store.json", "w") as f:
        json.dump(doc_metadata, f)
    logger.info("BM25 index saved with %d documents", len(corpus_texts))


def sparse_search(
    query: str,
    allowed_roles: list[str],
    top_k: int = 20,
) -> list[dict]:
    if _retriever is None or _doc_store is None:
        logger.info("Sparse index not available, returning empty results")
        return []

    tokens = bm25s.tokenize([query])
    raw_results, scores = _retriever.retrieve(tokens, k=min(top_k * 3, len(_doc_store)))

    hits = []
    for idx, score in zip(raw_results[0], scores[0]):
        doc = _doc_store[int(idx)]
        if doc.get("role_access") not in allowed_roles:
            continue
        hits.append({
            "id": doc["id"],
            "score": float(score),
            "text": doc.get("text", ""),
            "metadata": {k: v for k, v in doc.items() if k not in ("text", "id")},
        })
        if len(hits) >= top_k:
            break

    logger.info("Sparse search returned %d hits", len(hits))
    return hits
