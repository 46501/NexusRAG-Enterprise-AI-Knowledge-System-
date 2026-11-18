import gc
import os
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel
from app.utils.logger import get_logger

logger = get_logger(__name__)

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

_MODEL_NAME = "BAAI/bge-small-en-v1.5"
_tokenizer: AutoTokenizer | None = None
_model: AutoModel | None = None


def load_embedder() -> None:
    global _tokenizer, _model
    if _model is None or _tokenizer is None:
        logger.info("Loading lightweight embedder (%s) via Transformers AutoModel...", _MODEL_NAME)
        _tokenizer = AutoTokenizer.from_pretrained(_MODEL_NAME)
        _model = AutoModel.from_pretrained(_MODEL_NAME)
        _model.eval()
        gc.collect()
        logger.info("Embedder (%s) loaded successfully", _MODEL_NAME)


def get_embedder() -> tuple[AutoTokenizer, AutoModel]:
    if _model is None or _tokenizer is None:
        load_embedder()
    return _tokenizer, _model


def embed(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    tokenizer, model = get_embedder()
    batch_size = 16 if len(texts) > 1 else 1
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i : i + batch_size]
        encoded = tokenizer(
            batch_texts,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        with torch.inference_mode():
            outputs = model(**encoded)
            # BAAI/bge-small-en-v1.5 uses [CLS] token representation normalized with L2
            cls_embeddings = outputs[0][:, 0]
            normalized = F.normalize(cls_embeddings, p=2, dim=1)
            all_embeddings.extend(normalized.cpu().numpy().tolist())

    if len(texts) >= 16:
        gc.collect()

    return all_embeddings
