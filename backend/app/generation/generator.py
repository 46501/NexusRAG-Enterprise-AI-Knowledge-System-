from collections.abc import AsyncIterator

from google import genai
from google.genai import types, errors

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

_client: genai.Client | None = None

SYSTEM_INSTRUCTION = (
    "You are a helpful enterprise knowledge assistant. "
    "IMPORTANT: If the user's message is a greeting or very short casual message with no question "
    "(like 'hi', 'hello', 'thanks', 'good'), do NOT use the context documents at all. "
    "Just respond warmly and briefly as a helpful assistant would, then invite them to ask about their department's documents. "
    "The context documents below are only relevant when the user asks an actual question. "
    "You are a helpful enterprise knowledge assistant. "
    "Answer the user's question using only the context provided. "
    "Cite sources by their bracketed number, e.g. [1]. "
    "Only if the question is a genuine off-topic request unrelated to work (e.g. write me a poem, what is the weather), "
    "respond with exactly: "
    "\"I can only answer questions based on your department's documents.\""
)

GREETING_SYSTEM_INSTRUCTION = (
    "You are a helpful enterprise knowledge assistant. "
    "If the user sends a greeting or casual message, respond warmly and briefly, "
    "then invite them to ask about their department's documents. "
    "If the question is genuinely off-topic (not a greeting), respond with exactly: "
    "'I can only answer questions based on your department's documents.'"
)

_FALLBACK = "I can only answer questions based on your department's documents."


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
        dept = chunk.get("metadata", {}).get("role_access", "unknown")
        source = chunk.get("metadata", {}).get("source", "unknown")
        context_parts.append(f"[{i}] (department={dept}, source={source})\n{chunk['text']}")
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
            "rerank_score": chunk.get("rerank_score"),
        })
    return sources


async def generate(query: str, chunks: list[dict]) -> dict:
    client = get_client()

    if not chunks:
        logger.info("No chunks retrieved for query=%r, calling Gemini for greeting handling", query[:60])
        config = types.GenerateContentConfig(
            system_instruction=GREETING_SYSTEM_INSTRUCTION,
            temperature=0.2,
            max_output_tokens=256,
        )
        try:
            response = await client.aio.models.generate_content(
                model=_s.gemini_model,
                contents=query,
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
    prompt = f"Context:\n{context}\n\nQuestion: {query}"

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.2,
        max_output_tokens=1024,
    )

    try:
        response = await client.aio.models.generate_content(
            model=_s.gemini_model,
            contents=prompt,
            config=config,
        )
        answer = response.text or _FALLBACK
        usage = getattr(response, "usage_metadata", None)
        token_count = getattr(usage, "total_token_count", 0) if usage else 0
        logger.info(
            "Generated answer for query=%r using %d chunks, total_tokens=%d",
            query[:60],
            len(chunks),
            token_count,
        )
        return {"answer": answer, "sources": sources}
    except errors.APIError as exc:
        logger.error("Gemini API error during generation: code=%s, status=%s", exc.code, exc.status)
        raise
    except Exception as exc:
        logger.error("Gemini error during generation: %s", type(exc).__name__)
        raise


async def generate_stream(query: str, chunks: list[dict]) -> AsyncIterator[str]:
    client = get_client()

    if not chunks:
        logger.info("No chunks retrieved for query=%r, calling Gemini stream for greeting handling", query[:60])
        config = types.GenerateContentConfig(
            system_instruction=GREETING_SYSTEM_INSTRUCTION,
            temperature=0.2,
            max_output_tokens=256,
        )
        try:
            stream = await client.aio.models.generate_content_stream(
                model=_s.gemini_model,
                contents=query,
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
    prompt = f"Context:\n{context}\n\nQuestion: {query}"

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.2,
        max_output_tokens=1024,
    )

    try:
        stream = await client.aio.models.generate_content_stream(
            model=_s.gemini_model,
            contents=prompt,
            config=config,
        )
        async for chunk in stream:
            text = chunk.text
            if text:
                yield text
        logger.info("Streamed answer for query=%r using %d chunks", query[:60], len(chunks))
    except errors.APIError as exc:
        logger.error("Gemini stream API error: code=%s, status=%s", exc.code, exc.status)
        raise
    except Exception as exc:
        logger.error("Gemini stream error: %s", type(exc).__name__)
        raise
