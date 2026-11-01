from app.retrieval.dense import dense_search
from app.retrieval.sparse import sparse_search
from app.utils.logger import get_logger

logger = get_logger(__name__)

_RRF_K = 60


def _rrf_score(rank: int) -> float:
    return 1.0 / (_RRF_K + rank + 1)


def _reciprocal_rank_fusion(
    dense_hits: list[dict],
    sparse_hits: list[dict],
    top_k: int,
) -> list[dict]:
    scores: dict[str, float] = {}
    docs: dict[str, dict] = {}

    for rank, hit in enumerate(dense_hits):
        doc_id = hit["id"]
        scores[doc_id] = scores.get(doc_id, 0.0) + _rrf_score(rank)
        docs[doc_id] = hit

    for rank, hit in enumerate(sparse_hits):
        doc_id = hit["id"]
        scores[doc_id] = scores.get(doc_id, 0.0) + _rrf_score(rank)
        if doc_id not in docs:
            docs[doc_id] = hit

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

    results = []
    for doc_id, rrf_score in ranked:
        entry = dict(docs[doc_id])
        entry["rrf_score"] = rrf_score
        results.append(entry)

    return results


async def hybrid_search(
    query: str,
    allowed_roles: list[str],
    top_k: int = 10,
    dense_k: int = 20,
    sparse_k: int = 20,
) -> list[dict]:
    dense_hits = await dense_search(query, allowed_roles, top_k=dense_k)
    sparse_hits = sparse_search(query, allowed_roles, top_k=sparse_k)

    fused = _rrf_fusion(dense_hits, sparse_hits, top_k=top_k)
    logger.info("Hybrid search fused to %d results", len(fused))
    return fused


def _rrf_fusion(dense_hits: list[dict], sparse_hits: list[dict], top_k: int) -> list[dict]:
    return _reciprocal_rank_fusion(dense_hits, sparse_hits, top_k)
