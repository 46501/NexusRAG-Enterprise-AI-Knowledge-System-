from collections.abc import AsyncIterator

from google import genai
from google.genai import types, errors

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

_client: genai.Client | None = None

SYSTEM_INSTRUCTION = (
    "You are an enterprise AI knowledge assistant for corporate documents and policies.\n"
    "EVALUATION & GROUNDING RULES:\n"
    "1. If the message is a greeting or very short casual pleasantry (e.g. 'hi', 'hello', 'thanks'), respond warmly and invite questions about company documents without citing sources.\n"
    "2. For all document questions, answer accurately and comprehensively using ONLY the provided Context.\n"
    "3. Every factual statement or policy detail must be explicitly cited using the bracketed source number, e.g. [1] or [1][2].\n"
    "4. RETRIEVAL SUFFICIENCY & SELF-REFLECTION: If the provided Context does not contain the answer, or only partially answers a multi-part question, explicitly state what is not found in the documents (e.g. 'The documents do not specify...'). Never fabricate or extrapolate unstated policies.\n"
    "5. If the request is a completely off-topic casual query unrelated to work (e.g. write a poem, tell a joke, current weather), respond with: 'I can only answer questions based on your department\'s documents.'\n\n"
    "At the end of your response based on documents, provide 2 to 3 concise relevant follow-up questions formatted exactly as:\n"
    "---FOLLOW_UPS---\n"
    "- [First follow-up question]\n"
    "- [Second follow-up question]\n"
    "- [Third follow-up question]"
)

GREETING_SYSTEM_INSTRUCTION = (
    "You are a helpful enterprise knowledge assistant. "
    "If the user sends a greeting or casual message, respond warmly and briefly, "
    "then invite them to ask about their department's documents. "
    "If the question is genuinely off-topic (not a greeting), respond with exactly: "
    "'I can only answer questions based on your department's documents.'"
)

_FALLBACK = "I can only answer questions based on your department's documents."


def parse_answer_and_follow_ups(raw_text: str) -> tuple[str, list[str]]:
    if not raw_text:
        return "", []
    if "---FOLLOW_UPS---" in raw_text:
        parts = raw_text.split("---FOLLOW_UPS---", 1)
        answer = parts[0].strip()
        follow_ups = [
            line.strip().lstrip("-*•0123456789. ").strip()
            for line in parts[1].splitlines()
            if line.strip() and len(line.strip().lstrip("-*•0123456789. ").strip()) > 3
        ]
        return answer, follow_ups[:3]
    return raw_text, []


def _format_history_contents(
    history: list[dict] | None, prompt_text: str
) -> list[types.Content]:
    contents: list[types.Content] = []
    if history:
        for msg in history[-6:]:
            role = "user" if msg.get("role") == "user" else "model"
            raw_text = msg.get("content", "")
            text = raw_text.split("---FOLLOW_UPS---")[0].strip()
            if not text:
                continue
            if contents and contents[-1].role == role:
                contents[-1].parts.append(types.Part.from_text(text=text))
            else:
                contents.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))

    if contents and contents[-1].role == "user":
        contents[-1].parts.append(types.Part.from_text(text=prompt_text))
    else:
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=prompt_text)]))
    return contents


def load_generator() -> None:
    global _client
    if not _s.gemini_api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")
    http_options = types.HttpOptions(
        timeout=_s.gemini_timeout_seconds * 1000
    )
    _client = genai.Client(
        api_key=_s.gemini_api_key,
        http_options=http_options,
    )
    logger.info("Google Gemini generator loaded with model %s", _s.gemini_model)


def get_client() -> genai.Client:
    if _client is None:
        raise RuntimeError("Generator not loaded. Call load_generator() at startup.")
    return _client


def _build_context(chunks: list[dict]) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        meta = chunk.get("metadata", {})
        dept = meta.get("role_access", "unknown")
        source = meta.get("source", "unknown")
        sec = meta.get("section")
        range_info = meta.get("chunk_index_range")
        extra_parts = [f"department={dept}", f"source={source}"]
        if sec:
            extra_parts.append(f"section={sec}")
        if range_info:
            extra_parts.append(f"chunks={range_info}")
        context_parts.append(f"[{i}] ({', '.join(extra_parts)})\n{chunk['text']}")
    return "\n\n".join(context_parts)


def _extract_sources(chunks: list[dict]) -> list[dict]:
    sources = []
    for i, chunk in enumerate(chunks, 1):
        meta = chunk.get("metadata", {})
        sources.append({
            "index": i,
            "source": meta.get("source", "unknown"),
            "department": meta.get("role_access", "unknown"),
            "chunk_id": chunk.get("id"),
            "doc_id": meta.get("doc_id"),
            "chunk_index": meta.get("chunk_index"),
            "rerank_score": chunk.get("rerank_score"),
            "text": chunk.get("text", ""),
            "section": meta.get("section", ""),
        })
    return sources


async def generate(
    query: str, chunks: list[dict], history: list[dict] | None = None
) -> dict:
    client = get_client()

    if not chunks:
        logger.info("No chunks retrieved for query=%r, calling Gemini for greeting handling", query[:60])
        config = types.GenerateContentConfig(
            system_instruction=GREETING_SYSTEM_INSTRUCTION,
            temperature=0.2,
            max_output_tokens=256,
        )
        try:
            contents = _format_history_contents(history, query)
            response = await client.aio.models.generate_content(
                model=_s.gemini_model,
                contents=contents,
                config=config,
            )
            answer = response.text or _FALLBACK
            return {"answer": answer, "sources": []}
        except errors.APIError as exc:
            logger.error("Gemini API error during greeting generation: code=%s, status=%s", exc.code, exc.status)
            raise
        except Exception as exc:
            logger.error("Gemini error during greeting generation: %s", type(exc).__name__)
            raise

    context = _build_context(chunks)
    sources = _extract_sources(chunks)
    prompt = (
        f"Context:\n{context}\n\n"
        f"Question: {query}\n\n"
        "At the end of your response based on the documents, provide 2 to 3 concise relevant follow-up questions formatted exactly as:\n"
        "---FOLLOW_UPS---\n"
        "- [First follow-up question]\n"
        "- [Second follow-up question]\n"
        "- [Third follow-up question]"
    )

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.2,
        max_output_tokens=2048,
    )

    models_to_try = [_s.gemini_model]
    for alt in ("gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"):
        if alt not in models_to_try:
            models_to_try.append(alt)

    contents = _format_history_contents(history, prompt)
    last_exc = None
    for model_name in models_to_try:
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
            answer = response.text or _FALLBACK
            usage = getattr(response, "usage_metadata", None)
            token_count = getattr(usage, "total_token_count", 0) if usage else 0
            clean_answer, follow_ups = parse_answer_and_follow_ups(answer)
            logger.info(
                "Generated answer for query=%r using %d chunks model=%s, total_tokens=%d, follow_ups=%d",
                query[:60],
                len(chunks),
                model_name,
                token_count,
                len(follow_ups),
            )
            return {"answer": clean_answer, "sources": sources, "suggested_questions": follow_ups}
        except (errors.APIError, Exception) as exc:
            err_msg = str(exc)
            if any(k in err_msg for k in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "quota")):
                logger.warning("Gemini model %s transient error: %s, trying fallback", model_name, exc)
                last_exc = exc
                continue
            logger.error("Gemini API error during generation model=%s: %s", model_name, exc)
            raise

    if last_exc:
        raise last_exc
    return {"answer": _FALLBACK, "sources": sources, "suggested_questions": []}


async def generate_stream(
    query: str, chunks: list[dict], history: list[dict] | None = None
) -> AsyncIterator[str]:
    client = get_client()

    if not chunks:
        logger.info("No chunks retrieved for query=%r, calling Gemini stream for greeting handling", query[:60])
        config = types.GenerateContentConfig(
            system_instruction=GREETING_SYSTEM_INSTRUCTION,
            temperature=0.2,
            max_output_tokens=256,
        )
        try:
            contents = _format_history_contents(history, query)
            stream = await client.aio.models.generate_content_stream(
                model=_s.gemini_model,
                contents=contents,
                config=config,
            )
            async for chunk in stream:
                text = chunk.text
                if text:
                    yield text
        except errors.APIError as exc:
            logger.error("Gemini stream API error during greeting: code=%s, status=%s", exc.code, exc.status)
            raise
        except Exception as exc:
            logger.error("Gemini stream error during greeting: %s", type(exc).__name__)
            raise
        return

    context = _build_context(chunks)
    prompt = (
        f"Context:\n{context}\n\n"
        f"Question: {query}\n\n"
        "At the end of your response based on the documents, provide 2 to 3 concise relevant follow-up questions formatted exactly as:\n"
        "---FOLLOW_UPS---\n"
        "- [First follow-up question]\n"
        "- [Second follow-up question]\n"
        "- [Third follow-up question]"
    )

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.2,
        max_output_tokens=2048,
    )

    models_to_try = [_s.gemini_model]
    for alt in ("gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"):
        if alt not in models_to_try:
            models_to_try.append(alt)

    contents = _format_history_contents(history, prompt)
    last_exc = None
    for model_name in models_to_try:
        try:
            stream = await client.aio.models.generate_content_stream(
                model=model_name,
                contents=contents,
                config=config,
            )
            yielded_any = False
            async for chunk in stream:
                text = chunk.text
                if text:
                    yielded_any = True
                    yield text
            if yielded_any:
                logger.info("Streamed answer for query=%r using %d chunks model=%s", query[:60], len(chunks), model_name)
                return
        except (errors.APIError, Exception) as exc:
            err_msg = str(exc)
            if any(k in err_msg for k in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "quota")):
                logger.warning("Gemini stream model %s transient error: %s, trying fallback", model_name, exc)
                last_exc = exc
                continue
            logger.error("Gemini stream error model=%s: %s", model_name, exc)
            raise

    if last_exc:
        raise last_exc
