import torch
import numpy as np
from sentence_transformers import SentenceTransformer

# Optimize PyTorch CPU memory for memory-constrained containers (e.g. Render 512MB)
torch.set_num_threads(1)
try:
    torch.set_grad_enabled(False)
except Exception:
    pass

_model: SentenceTransformer | None = None


def load_embedder() -> None:
    global _model
    if _model is None:
        _model = SentenceTransformer("BAAI/bge-small-en-v1.5", device="cpu")
        _model.eval()


def get_embedder() -> SentenceTransformer:
    if _model is None:
        load_embedder()
    return _model


def embed(texts: list[str]) -> list[list[float]]:
    vecs: np.ndarray = get_embedder().encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return vecs.tolist()
