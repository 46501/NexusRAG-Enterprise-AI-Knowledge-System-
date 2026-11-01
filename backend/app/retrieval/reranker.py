from sentence_transformers import CrossEncoder

from app.utils.logger import get_logger

logger = get_logger(__name__)

_model: CrossEncoder | None = None


def load_reranker() -> None:
    global _model
    _model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", device="cpu")


def get_reranker() -> CrossEncoder:
    if _model is None:
        raise RuntimeError("Reranker not loaded. Call load_reranker() at startup.")
    return _model


def rerank(query: str, hits: list[dict], top_k: int = 5) -> list[dict]:
    if not hits:
        return []

    pairs = [[query, hit["text"]] for hit in hits]
    scores = get_reranker().predict(pairs, show_progress_bar=False)

    ranked = sorted(zip(scores, hits), key=lambda x: x[0], reverse=True)
    results = []
    for score, hit in ranked[:top_k]:
        entry = dict(hit)
        entry["rerank_score"] = float(score)
        results.append(entry)

    logger.info("Reranker selected %d results from %d candidates", len(results), len(hits))
    return results
