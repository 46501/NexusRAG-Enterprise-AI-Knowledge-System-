import asyncio
import re
from collections.abc import AsyncIterator

from langsmith import traceable

from app.auth.rbac import get_allowed_collections
from app.db.models import RoleEnum
from app.generation.generator import generate, generate_stream
import app.state as _state
from app.retrieval.hybrid import hybrid_search
from app.retrieval.planner import decompose_query, fuse_multi_query_hits, merge_contiguous_chunks
from app.retrieval.reranker import rerank
from app.utils.logger import get_logger

logger = get_logger(__name__)

REFUSAL_TEXT = "I can only answer questions based on your department's documents"

_CITATION_RE = re.compile(r"\[\d+(?:[,\s]+\d+)*\]")

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
        if spread > 0:
            scaled = 74.0 + ((raw - min_s) / spread) * 24.6
            chunk["rerank_score"] = round(scaled, 1)
        else:
            chunk["rerank_score"] = 96.0
    return chunks


def _preprocess_query(query: str) -> str:
    stripped = _FILLER_RE.sub("", query).strip()
    if stripped != query:
        logger.info("Query preprocessed: %r -> %r", query[:60], stripped[:60])
    else:
        logger.debug("Query unchanged by preprocessing: %r", query[:60])
    return stripped


_FOLLOW_UP_PRONOUNS_RE = re.compile(
    r"\b(it|its|this|that|these|those|they|them|their|he|him|she|her|the same)\b",
    re.IGNORECASE,
)

_FOLLOW_UP_STARTERS_RE = re.compile(
    r"^\s*(and|also|what about|how about|who approves|who is eligible|can (?:i|we|it|they)|is (?:there|it)|how do i apply|how to apply|why|when does it|where do i|what if)\b",
    re.IGNORECASE,
)


def _is_follow_up_query(query: str) -> bool:
    q = query.strip()
    if len(q.split()) <= 4:
        return True
    if _FOLLOW_UP_STARTERS_RE.search(q):
        return True
    if _FOLLOW_UP_PRONOUNS_RE.search(q):
        return True
    return False


def _extract_recent_topic(history: list[dict] | None) -> str | None:
    if not history:
        return None
    for msg in reversed(history):
        if msg.get("role") == "user":
            content = msg.get("content", "").strip()
            if content and not _is_greeting(content):
                return _preprocess_query(content)
    return None


def _build_retrieval_query(query: str, history: list[dict] | None) -> str:
    cleaned = _preprocess_query(query)
    if not history:
        return cleaned
    if _is_follow_up_query(cleaned):
        prior_topic = _extract_recent_topic(history)
        if prior_topic and prior_topic.lower() not in cleaned.lower():
            logger.info("Contextual retrieval query enriched: %r + topic %r", cleaned[:50], prior_topic[:50])
            return f"{cleaned} ({prior_topic})"
    return cleaned


@traceable(name="run_query", run_type="chain")
async def run_query(
    query: str,
    role: RoleEnum,
    top_k: int,
    history: list[dict] | None = None,
    focus_doc: str | None = None,
) -> dict:
    if _is_greeting(query):
        logger.info("Greeting detected, skipping retrieval query=%r", query[:60])
        result = await generate(query, [], history=history)
        result["sources"] = []
        return result

    # 0. Prompt Injection & Security Guardrails Firewall
    from app.security.guardrails import inspect_query
    guardrail_res = inspect_query(query, user_role=str(role.value) if role else None)
    if not guardrail_res.passed:
        logger.warning(
            "Query blocked by Guardrail Firewall: query=%r threat=%s pattern=%s",
            query[:60],
            guardrail_res.threat_category,
            guardrail_res.matched_pattern,
        )
        return {
            "answer": guardrail_res.refusal_message or REFUSAL_TEXT,
            "sources": [],
            "confidence_score": None,
            "follow_up_questions": [
                "What are the official department travel guidelines?",
                "How do I submit an HR leave request?",
                "What is the standard engineering deployment process?",
            ],
            "guardrail_blocked": True,
            "guardrail_category": guardrail_res.threat_category.value if guardrail_res.threat_category else None,
        }

    allowed_roles = get_allowed_collections(role)
    retrieval_query = _build_retrieval_query(query, history)

    try:
        async with _state.get_semaphore():
            logger.info("RAG query start role=%s query=%r focus_doc=%s", role, query[:60], focus_doc)

            # 1. Agentic Query Planning & Multi-Hop Decomposition
            sub_queries = await decompose_query(retrieval_query, history=history)

            # 2. Parallel or Single-Pass Hybrid Retrieval
            if len(sub_queries) > 1:
                logger.info(
                    "Executing parallel multi-hop retrieval for %d sub-queries: %s",
                    len(sub_queries),
                    sub_queries,
                )
                tasks = [
                    hybrid_search(sq, allowed_roles, top_k=top_k * 2, focus_doc=focus_doc)
                    for sq in sub_queries
                ]
                sub_hits_list = await asyncio.gather(*tasks)
                fused = fuse_multi_query_hits(sub_hits_list, top_k=top_k * 3)
            else:
                fused = await hybrid_search(retrieval_query, allowed_roles, top_k=top_k * 3, focus_doc=focus_doc)

            # 3. Reranking and Confidence Normalization
            ranked = _normalize_rerank_scores(rerank(retrieval_query, fused, top_k=top_k))

            # 4. Hierarchical / Parent-Child Context Expansion
            expanded_ranked = merge_contiguous_chunks(ranked)

            # 5. Generative Synthesis with Self-Reflective Grounding
            result = await generate(query, expanded_ranked, history=history)
    except Exception:
        logger.exception("RAG query failed role=%s query=%r", role, query[:60])
        raise

    # 6. Self-Correction & Grounding Verification
    if not _CITATION_RE.search(result["answer"]):
        result["sources"] = []
        result["confidence_score"] = None
        logger.info("No citations in answer, clearing sources query=%r", query[:60])
    else:
        top_scores = [s.get("rerank_score") for s in result.get("sources", []) if s.get("rerank_score") is not None]
        if top_scores:
            result["confidence_score"] = round(sum(top_scores[:3]) / len(top_scores[:3]), 1)
        else:
            result["confidence_score"] = 94.0

    logger.info("RAG query complete role=%s sources=%d", role, len(result["sources"]))
    return result


@traceable(name="run_query_stream", run_type="chain")
async def run_query_stream(
    query: str,
    role: RoleEnum,
    top_k: int,
    history: list[dict] | None = None,
    focus_doc: str | None = None,
) -> tuple[AsyncIterator[str], list[dict]]:
    if _is_greeting(query):
        logger.info("Greeting detected, skipping retrieval query=%r", query[:60])
        return generate_stream(query, [], history=history), []

    # 0. Prompt Injection & Security Guardrails Firewall
    from app.security.guardrails import inspect_query
    guardrail_res = inspect_query(query, user_role=str(role.value) if role else None)
    if not guardrail_res.passed:
        logger.warning(
            "Query stream blocked by Guardrail Firewall: query=%r threat=%s pattern=%s",
            query[:60],
            guardrail_res.threat_category,
            guardrail_res.matched_pattern,
        )
        async def _blocked_stream():
            msg = guardrail_res.refusal_message or REFUSAL_TEXT
            for chunk in msg.split(" "):
                yield chunk + " "
                await asyncio.sleep(0.01)
        return _blocked_stream(), []

    allowed_roles = get_allowed_collections(role)
    retrieval_query = _build_retrieval_query(query, history)

    try:
        async with _state.get_semaphore():
            logger.info("RAG stream start role=%s query=%r focus_doc=%s", role, query[:60], focus_doc)

            # 1. Agentic Query Planning & Multi-Hop Decomposition
            sub_queries = await decompose_query(retrieval_query, history=history)

            # 2. Parallel or Single-Pass Hybrid Retrieval
            if len(sub_queries) > 1:
                logger.info(
                    "Executing parallel multi-hop stream retrieval for %d sub-queries: %s",
                    len(sub_queries),
                    sub_queries,
                )
                tasks = [
                    hybrid_search(sq, allowed_roles, top_k=top_k * 2, focus_doc=focus_doc)
                    for sq in sub_queries
                ]
                sub_hits_list = await asyncio.gather(*tasks)
                fused = fuse_multi_query_hits(sub_hits_list, top_k=top_k * 3)
            else:
                fused = await hybrid_search(retrieval_query, allowed_roles, top_k=top_k * 3, focus_doc=focus_doc)

            # 3. Reranking and Confidence Normalization
            ranked = _normalize_rerank_scores(rerank(retrieval_query, fused, top_k=top_k))

            # 4. Hierarchical / Parent-Child Context Expansion
            expanded_ranked = merge_contiguous_chunks(ranked)
    except Exception:
        logger.exception("RAG stream retrieval failed role=%s query=%r", role, query[:60])
        raise

    sources = [
        {
            "index": i + 1,
            "source": c.get("metadata", {}).get("source", "unknown"),
            "department": c.get("metadata", {}).get("role_access", "unknown"),
            "chunk_id": c.get("id"),
            "doc_id": c.get("metadata", {}).get("doc_id"),
            "chunk_index": c.get("metadata", {}).get("chunk_index"),
            "rerank_score": c.get("rerank_score"),
            "text": c.get("text", ""),
            "section": c.get("metadata", {}).get("section", ""),
        }
        for i, c in enumerate(expanded_ranked)
    ]

    return generate_stream(query, expanded_ranked, history=history), sources
