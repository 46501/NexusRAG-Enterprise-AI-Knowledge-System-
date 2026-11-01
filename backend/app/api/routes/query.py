import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_current_user
from app.db.models import RoleEnum, User
from app.schemas.query import QueryRequest, QueryResponse
from app.services.query_service import run_query, run_query_stream, _CITATION_RE
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/query", tags=["query"])


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
    if not body.stream:
        try:
            result = await run_query(body.query, current_user.role, body.top_k)
        except Exception:
            logger.exception("Query route error user=%s", current_user.id)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Query failed")
        return QueryResponse(answer=result["answer"], sources=result["sources"])

    try:
        stream, sources = await run_query_stream(body.query, current_user.role, body.top_k)
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

            final_sources = sources if _CITATION_RE.search("".join(tokens)) else []
            yield f"data: {json.dumps({'sources': final_sources, 'done': True})}\n\n"
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
