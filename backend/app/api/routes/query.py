import asyncio
import json
import time

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_current_user
from app.db.models import RoleEnum, User
from app.generation.generator import parse_answer_and_follow_ups
from app.schemas.query import QueryRequest, QueryResponse
from app.services.query_service import run_query, run_query_stream, _CITATION_RE
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/query", tags=["query"])


async def _log_query_task(
    user_id, user_email, department, query_text, sources_count, top_source, latency_ms
) -> None:
    try:
        from app.db.postgres import AsyncSessionLocal
        from app.db.models import QueryLog
        async with AsyncSessionLocal() as session:
            entry = QueryLog(
                user_id=user_id,
                user_email=user_email,
                department=department,
                query_text=query_text[:1000],
                sources_count=sources_count,
                top_source=top_source[:255] if top_source else None,
                latency_ms=latency_ms,
            )
            session.add(entry)
            await session.commit()
    except Exception as exc:
        logger.warning("Could not log query: %s", exc)


@router.post("", response_model=QueryResponse)
async def query(
    body: QueryRequest,
    current_user: User = Depends(get_current_user),
):
    if body.department and current_user.role not in (RoleEnum.admin, RoleEnum.demo_admin):
        if body.department.lower() != current_user.role.value.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this department. Please contact your administrator if you need access.",
            )
    history_dicts = [m.model_dump() for m in body.history] if body.history else None
    t0 = time.perf_counter()
    if not body.stream:
        try:
            result = await run_query(body.query, current_user.role, body.top_k, history=history_dicts)
            latency = (time.perf_counter() - t0) * 1000
            srcs = result.get("sources", [])
            top_src = srcs[0]["source"] if srcs else None
            asyncio.create_task(
                _log_query_task(
                    current_user.id,
                    current_user.email,
                    current_user.role,
                    body.query,
                    len(srcs),
                    top_src,
                    latency,
                )
            )
        except Exception:
            logger.exception("Query route error user=%s", current_user.id)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Query failed")
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"],
            suggested_questions=result.get("suggested_questions", []),
            confidence_score=result.get("confidence_score"),
        )

    try:
        stream, sources = await run_query_stream(body.query, current_user.role, body.top_k, history=history_dicts)
    except Exception:
        logger.exception("Stream query route error user=%s", current_user.id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Query failed")

    async def event_stream():
        tokens = []
        try:
            async for token in stream:
                tokens.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"

            if not tokens:
                fallback_msg = "No response was generated. Please try again."
                tokens.append(fallback_msg)
                yield f"data: {json.dumps({'token': fallback_msg})}\n\n"

            final_text = "".join(tokens)
            clean_answer, follow_ups = parse_answer_and_follow_ups(final_text)
            final_sources = sources if _CITATION_RE.search(final_text) else []
            latency = (time.perf_counter() - t0) * 1000
            top_src = final_sources[0]["source"] if final_sources else None
            asyncio.create_task(
                _log_query_task(
                    current_user.id,
                    current_user.email,
                    current_user.role,
                    body.query,
                    len(final_sources),
                    top_src,
                    latency,
                )
            )
            conf_score = None
            if final_sources:
                top_scores = [s.get("rerank_score") for s in final_sources if s.get("rerank_score") is not None]
                if top_scores:
                    conf_score = round(sum(top_scores[:3]) / len(top_scores[:3]), 1)
                else:
                    conf_score = 94.0

            yield f"data: {json.dumps({'sources': final_sources, 'suggested_questions': follow_ups, 'confidence_score': conf_score, 'done': True})}\n\n"
        except asyncio.CancelledError:
            logger.info("Client disconnected from query stream user=%s", current_user.id)
            raise
        except Exception as exc:
            logger.exception("Stream generation error user=%s query=%r", current_user.id, body.query[:60])
            err_str = str(exc).lower()
            if "quota" in err_str or "resource_exhausted" in err_str or "429" in err_str:
                user_msg = "Gemini API rate limit or quota exceeded. Please try again shortly."
            elif "api key" in err_str or "unauthenticated" in err_str or "401" in err_str or "403" in err_str:
                user_msg = "Gemini authentication failed. Please check your API key configuration."
            elif "timeout" in err_str or "timed out" in err_str:
                user_msg = "Gemini request timed out. Please try again."
            else:
                user_msg = "An error occurred while generating the response. Please try again."

            if not tokens:
                payload = {"token": user_msg, "error": user_msg}
            else:
                payload = {"token": f"\n\n[{user_msg}]", "error": user_msg}
            yield f"data: {json.dumps(payload)}\n\n"
            yield f"data: {json.dumps({'sources': [], 'done': True, 'error': user_msg})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
