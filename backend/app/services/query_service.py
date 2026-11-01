import re
from collections.abc import AsyncIterator

from langsmith import traceable

from app.auth.rbac import get_allowed_collections
from app.db.models import RoleEnum
from app.generation.generator import generate, generate_stream
import app.state as _state
from app.retrieval.hybrid import hybrid_search
from app.retrieval.reranker import rerank
from app.utils.logger import get_logger

logger = get_logger(__name__)

REFUSAL_TEXT = "I can only answer questions based on your department's documents"

_CITATION_RE = re.compile(r"\[\d+\]")

_FILLER_RE = re.compile(
    r"^(?:"
    r"tell me about|"
    r"what (?:is|are) the|"
    r"can you explain|"
    r"i want to know about|"
    r"explain to me|"
    r"describe|"
    r"give me information about|"
    r"how does|"
    r"what does"
    r")\s+",
    re.IGNORECASE,
)

_GREETING_RE = re.compile(
    r"^\s*(hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening|"
    r"how\s+are\s+you|howdy|greetings|sup|what'?s\s+up)\b",
    re.IGNORECASE,
)


def _is_greeting(query: str) -> bool:
    return bool(_GREETING_RE.match(query.strip()))


def _normalize_rerank_scores(chunks: list[dict]) -> list[dict]:
    if not chunks:
        return chunks
    scores = [c.get("rerank_score") or 0.0 for c in chunks]
    min_s, max_s = min(scores), max(scores)
    spread = max_s - min_s
    for chunk, raw in zip(chunks, scores):
        chunk["rerank_score"] = round((raw - min_s) / spread * 100, 1) if spread > 0 else 100.0
    return chunks


def _preprocess_query(query: str) -> str:
    stripped = _FILLER_RE.sub("", query).strip()
    if stripped != query:
        logger.info("Query preprocessed: %r -> %r", query[:60], stripped[:60])
    else:
        logger.debug("Query unchanged by preprocessing: %r", query[:60])
    return stripped


@traceable(name="run_query", run_type="chain")
async def run_query(query: str, role: RoleEnum, top_k: int) -> dict:
    if _is_greeting(query):
        logger.info("Greeting detected, skipping retrieval query=%r", query[:60])
        result = await generate(query, [])
        result["sources"] = []
        return result

    allowed_roles = get_allowed_collections(role)
    retrieval_query = _preprocess_query(query)

    try:
        async with _state.rag_semaphore:
            logger.info("RAG query start role=%s query=%r retrieval_query=%r", role, query[:60], retrieval_query[:60])
            fused = await hybrid_search(retrieval_query, allowed_roles, top_k=top_k * 3)
            ranked = _normalize_rerank_scores(rerank(retrieval_query, fused, top_k=top_k))
            result = await generate(query, ranked)
    except Exception:
        logger.exception("RAG query failed role=%s query=%r", role, query[:60])
        raise

    if not _CITATION_RE.search(result["answer"]):
        result["sources"] = []
        logger.info("No citations in answer, clearing sources query=%r", query[:60])

    logger.info("RAG query complete role=%s sources=%d", role, len(result["sources"]))
    return result


@traceable(name="run_query_stream", run_type="chain")
async def run_query_stream(
    query: str, role: RoleEnum, top_k: int
) -> tuple[AsyncIterator[str], list[dict]]:
    if _is_greeting(query):
        logger.info("Greeting detected, skipping retrieval query=%r", query[:60])
        return generate_stream(query, []), []

    allowed_roles = get_allowed_collections(role)
    retrieval_query = _preprocess_query(query)

    try:
        async with _state.rag_semaphore:
            logger.info("RAG stream start role=%s query=%r retrieval_query=%r", role, query[:60], retrieval_query[:60])
            fused = await hybrid_search(retrieval_query, allowed_roles, top_k=top_k * 3)
            ranked = _normalize_rerank_scores(rerank(retrieval_query, fused, top_k=top_k))
    except Exception:
        logger.exception("RAG stream retrieval failed role=%s query=%r", role, query[:60])
        raise

    sources = [
        {
            "index": i + 1,
            "source": c.get("metadata", {}).get("source", "unknown"),
            "department": c.get("metadata", {}).get("role_access", "unknown"),
            "chunk_id": c.get("id"),
            "rerank_score": c.get("rerank_score"),
        }
        for i, c in enumerate(ranked)
    ]

    return generate_stream(query, ranked), sources
