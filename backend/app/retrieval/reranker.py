import torch
from sentence_transformers import CrossEncoder

from app.utils.logger import get_logger

logger = get_logger(__name__)

# Optimize PyTorch CPU memory
torch.set_num_threads(1)
try:
    torch.set_grad_enabled(False)
except Exception:
    pass

_model: CrossEncoder | None = None


def load_reranker() -> None:
    # Deferred / lazy-loaded on first query to prevent OOM on 512MB RAM instances
    pass


def get_reranker() -> CrossEncoder:
    global _model
    if _model is None:
        logger.info("Lazy-loading reranker model...")
        _model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", device="cpu")
        try:
            _model.model.eval()
        except Exception:
            pass
        logger.info("Reranker model loaded successfully")
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
