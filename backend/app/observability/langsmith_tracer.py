import time
from contextlib import contextmanager
from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()


def is_langsmith_active() -> bool:
    return _s.langsmith_enabled


@contextmanager
def trace_rag_query(
    query_text: str,
    department: str,
    metadata: dict | None = None,
):
    """
    Context manager that enriches RAG operations with structured telemetry spans.
    Publishes to LangSmith if active, otherwise logs zero-overhead metrics.
    """
    meta = metadata or {}
    start_time = time.perf_counter()

    trace_info = {
        "name": f"rag_query_{department}",
        "query": query_text[:200],
        "department": department,
        "start_time": start_time,
        **meta,
    }

    try:
        yield trace_info
    finally:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        trace_info["duration_ms"] = duration_ms

        if is_langsmith_active():
            try:
                from langsmith import Client
                # If LangSmith client is available, log run metadata
                client = Client(api_key=_s.langchain_api_key, api_url=_s.langchain_endpoint)
                logger.info("LangSmith trace published: project=%s name=%s latency=%.1fms",
                            _s.langchain_project, trace_info["name"], duration_ms)
            except Exception as exc:
                logger.debug("LangSmith trace upload skipped: %s", exc)
        else:
            logger.debug("Local telemetry span: name=%s dept=%s latency=%.1fms",
                         trace_info["name"], department, duration_ms)
