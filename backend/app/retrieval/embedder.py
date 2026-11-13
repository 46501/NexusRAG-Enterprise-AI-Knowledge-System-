import gc
import os
import torch
import numpy as np
from sentence_transformers import SentenceTransformer

# Optimize PyTorch CPU memory for memory-constrained containers (e.g. Render 512MB)
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("TORCH_NUM_THREADS", "1")

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
    if not texts:
        return []
    # Conservative batching (16) prevents peak activation spikes on 512MB RAM
    batch_size = 16 if len(texts) > 1 else 1
    with torch.inference_mode():
        vecs: np.ndarray = get_embedder().encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
    res = vecs.tolist()
    if len(texts) >= 16:
        gc.collect()
    return res
