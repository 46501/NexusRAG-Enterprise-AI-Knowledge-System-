from sentence_transformers import SentenceTransformer
import numpy as np

_model: SentenceTransformer | None = None


def load_embedder() -> None:
    global _model
    _model = SentenceTransformer("BAAI/bge-small-en-v1.5", device="cpu")


def get_embedder() -> SentenceTransformer:
    if _model is None:
        raise RuntimeError("Embedder not loaded. Call load_embedder() at startup.")
    return _model


def embed(texts: list[str]) -> list[list[float]]:
    vecs: np.ndarray = get_embedder().encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return vecs.tolist()
