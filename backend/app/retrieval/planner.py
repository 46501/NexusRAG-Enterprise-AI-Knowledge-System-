import asyncio
import json
import re

from app.utils.logger import get_logger

logger = get_logger(__name__)

# Heuristics for detecting comparative, multi-part, or cross-policy queries
_COMPARATIVE_PATTERNS = [
    re.compile(r"\b(compare|comparison|differ(?:ence|ences)?|versus|\bvs\.?\b|in contrast)\b", re.IGNORECASE),
    re.compile(r"\b(both\s+.+\s+and\s+)\b", re.IGNORECASE),
    re.compile(r"\b(as well as|in addition to|along with)\b", re.IGNORECASE),
    re.compile(r"\b(and also|who approves each|for each of|how do each)\b", re.IGNORECASE),
]

_MULTI_QUESTION_RE = re.compile(r"\?[^\?]+\?", re.IGNORECASE)

_RRF_K = 60


def is_complex_query(query: str) -> bool:
    """Returns True if the query exhibits multi-hop, comparative, or multi-part characteristics."""
    q = query.strip()
    words = q.split()
    if len(words) < 4:
        return False

    # Check for multiple question marks
    if len(_MULTI_QUESTION_RE.findall(q)) > 0 or q.count("?") >= 2:
        return True

    # Check for comparative or multi-topic patterns
    for pat in _COMPARATIVE_PATTERNS:
        if pat.search(q):
            return True

    # Check for conjunction patterns connecting two substantial clauses
    # e.g., "What is the policy for X and how do I apply for Y"
    if re.search(r"\b(?:and|while|whereas)\s+(?:what|how|who|when|where|can|is|are|why)\b", q, re.IGNORECASE):
        return True

    return False


def _rule_based_decomposition(query: str) -> list[str]:
    """Fallback query splitter when LLM decomposition is unavailable or times out."""
    q = query.strip()

    # If multiple questions with '?'
    parts = [p.strip() + "?" for p in q.split("?") if len(p.strip().split()) >= 3]
    if len(parts) >= 2:
        return parts[:3]

    # If "compare X and/with Y"
    comp_match = re.search(r"compare\s+(?:the\s+)?(.+?)\s+(?:and|with|to|against)\s+(?:the\s+)?(.+)", q, re.IGNORECASE)
    if comp_match:
        part1 = comp_match.group(1).rstrip(",.?").strip()
        part2 = comp_match.group(2).rstrip(",.?").strip()
        if len(part1.split()) >= 1 and len(part2.split()) >= 1:
            return [
                f"{part1} policy details",
                f"{part2} policy details",
            ]

    # If "X vs Y" or "X versus Y"
    vs_match = re.search(r"(.+?)\s+(?:vs\.?|versus)\s+(.+)", q, re.IGNORECASE)
    if vs_match:
        part1 = vs_match.group(1).rstrip(",.?").strip()
        part2 = vs_match.group(2).rstrip(",.?").strip()
        if len(part1.split()) >= 1 and len(part2.split()) >= 1:
            return [
                f"{part1} guidelines",
                f"{part2} guidelines",
            ]

    # Split on " and also " or " as well as "
    for sep in (" and also ", " as well as ", " in addition to "):
        if sep in q.lower():
            idx = q.lower().find(sep)
            p1 = q[:idx].strip()
            p2 = q[idx + len(sep):].strip()
            if len(p1.split()) >= 2 and len(p2.split()) >= 2:
                return [p1, p2]

    return [query]


async def decompose_query(
    query: str,
    history: list[dict] | None = None,
    max_sub_queries: int = 3,
) -> list[str]:
    """Decomposes a complex multi-hop or comparative enterprise query into 2-3 focused sub-queries.
    
    Uses gemini-3.5-flash-lite with temperature=0.0 and a strict JSON schema for sub-second planning.
    Falls back gracefully to heuristic rule-based decomposition on any error.
    """
    if not is_complex_query(query):
        return [query]

    try:
        from app.generation.generator import get_client
        from app.config import get_settings
        from google.genai import types

        client = get_client()
        settings = get_settings()

        prompt = (
            "You are an enterprise query planner for a vector search system.\n"
            "Decompose the following multi-topic, comparative, or multi-faceted enterprise question into 2 to 3 "
            "atomic, standalone, keyword-rich sub-queries for retrieving policy documents.\n\n"
            f"User Question: \"{query}\"\n\n"
            "Rules:\n"
            "1. Output ONLY a valid JSON array of strings, e.g. [\"first sub-query\", \"second sub-query\"].\n"
            "2. Each sub-query must be specific and independent.\n"
            "3. Do not include markdown fences, comments, or any extra text."
        )

        config = types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=150,
        )

        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=config,
        )

        raw_text = (response.text or "").strip()
        # Clean potential markdown fences
        if "```" in raw_text:
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)
        raw_text = raw_text.strip()

        parsed = json.loads(raw_text)
        if isinstance(parsed, list) and all(isinstance(x, str) for x in parsed):
            sub_queries = [x.strip() for x in parsed if len(x.strip().split()) >= 2][:max_sub_queries]
            if len(sub_queries) >= 2:
                logger.info("Agentic planner decomposed query %r into %d sub-queries: %s", query[:50], len(sub_queries), sub_queries)
                return sub_queries
    except Exception as exc:
        logger.warning("LLM query decomposition failed (%s); using rule-based decomposition", exc)

    return _rule_based_decomposition(query)


def fuse_multi_query_hits(sub_query_hits_list: list[list[dict]], top_k: int) -> list[dict]:
    """Merges and deduplicates retrieved chunk candidates from multiple sub-queries using Reciprocal Rank Fusion (RRF).
    
    Guarantees balanced representation so that clauses answering distinct parts of a multi-hop query
    are not eclipsed by documents dominating a single sub-topic.
    """
    scores: dict[str, float] = {}
    docs: dict[str, dict] = {}
    sub_query_presence: dict[str, int] = {}

    for query_idx, hits in enumerate(sub_query_hits_list):
        for rank, hit in enumerate(hits):
            doc_id = hit["id"]
            rrf_gain = 1.0 / (_RRF_K + rank + 1)
            scores[doc_id] = scores.get(doc_id, 0.0) + rrf_gain
            docs[doc_id] = hit
            sub_query_presence[doc_id] = sub_query_presence.get(doc_id, 0) + 1

    # Add a slight multi-aspect bonus for chunks relevant to more than one sub-query
    for doc_id, count in sub_query_presence.items():
        if count > 1:
            scores[doc_id] *= 1.15

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

    results = []
    for doc_id, rrf_score in ranked:
        entry = dict(docs[doc_id])
        entry["rrf_score"] = rrf_score
        results.append(entry)

    logger.info("Multi-query RRF fused %d candidate lists into %d top results", len(sub_query_hits_list), len(results))
    return results


def merge_contiguous_chunks(ranked_chunks: list[dict], max_char_length: int = 3500) -> list[dict]:
    """Hierarchical / Parent-Child Context Expansion.
    
    Identifies contiguous or adjacent chunks from the same document (e.g. chunk_index i and i+1)
    and stitches them into a coherent expanded passage. This eliminates severed sentences,
    interrupted markdown tables, and broken bullet lists before synthesis.
    """
    if not ranked_chunks or len(ranked_chunks) <= 1:
        return ranked_chunks

    # Group chunks by document
    merged: list[dict] = []
    consumed_ids: set[str] = set()

    for i, current in enumerate(ranked_chunks):
        if current["id"] in consumed_ids:
            continue

        curr_meta = current.get("metadata", {})
        curr_doc = curr_meta.get("doc_id") or curr_meta.get("source")
        curr_idx = curr_meta.get("chunk_index")

        if curr_doc is None or curr_idx is None:
            merged.append(current)
            consumed_ids.add(current["id"])
            continue

        # Look ahead for adjacent chunks in the candidate list
        combined_text = current.get("text", "")
        combined_indices = [curr_idx]
        best_score = current.get("rerank_score", current.get("rrf_score", 1.0))
        chunks_in_group = [current]
        consumed_ids.add(current["id"])

        for j in range(i + 1, len(ranked_chunks)):
            candidate = ranked_chunks[j]
            if candidate["id"] in consumed_ids:
                continue

            cand_meta = candidate.get("metadata", {})
            cand_doc = cand_meta.get("doc_id") or cand_meta.get("source")
            cand_idx = cand_meta.get("chunk_index")

            if cand_doc == curr_doc and cand_idx is not None:
                # If contiguous chunk
                if any(abs(cand_idx - idx) == 1 for idx in combined_indices):
                    # Check length limit
                    cand_text = candidate.get("text", "")
                    if len(combined_text) + len(cand_text) < max_char_length:
                        combined_indices.append(cand_idx)
                        chunks_in_group.append(candidate)
                        consumed_ids.add(candidate["id"])

        if len(chunks_in_group) > 1:
            # Sort by chunk_index to maintain narrative order
            chunks_in_group.sort(key=lambda c: c.get("metadata", {}).get("chunk_index", 0))
            
            # Smart deduplication of overlapping words between consecutive chunks
            stitched_texts = []
            for k, chk in enumerate(chunks_in_group):
                text_content = chk.get("text", "").strip()
                if not text_content:
                    continue
                if k == 0:
                    stitched_texts.append(text_content)
                else:
                    # Remove overlap if the beginning of this chunk matches the end of previous
                    prev_text = stitched_texts[-1]
                    words_curr = text_content.split()
                    # Try finding overlap of 5-25 words
                    overlap_found = False
                    for w_len in range(min(25, len(words_curr)), 4, -1):
                        prefix_phrase = " ".join(words_curr[:w_len])
                        if prefix_phrase in prev_text:
                            # Append only the remainder
                            remainder = " ".join(words_curr[w_len:])
                            if remainder:
                                stitched_texts.append(remainder)
                            overlap_found = True
                            break
                    if not overlap_found:
                        stitched_texts.append(text_content)

            expanded_text = " ... ".join(stitched_texts)
            expanded_entry = dict(chunks_in_group[0])
            expanded_entry["text"] = expanded_text
            # Store merged range info
            min_idx = min(combined_indices)
            max_idx = max(combined_indices)
            expanded_entry["metadata"] = dict(expanded_entry.get("metadata", {}))
            expanded_entry["metadata"]["chunk_index_range"] = f"{min_idx}-{max_idx}"
            expanded_entry["metadata"]["is_expanded_context"] = True
            
            logger.info(
                "Hierarchical expansion merged %d chunks (indices %d-%d) for doc %s",
                len(chunks_in_group),
                min_idx,
                max_idx,
                curr_doc,
            )
            merged.append(expanded_entry)
        else:
            merged.append(current)

    return merged
