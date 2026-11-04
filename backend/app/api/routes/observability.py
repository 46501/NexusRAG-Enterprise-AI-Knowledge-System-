import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.models import RoleEnum, User
from app.db.postgres import get_db
from app.observability.drift_detector import detect_telemetry_drift, get_observability_overview
from app.observability.eval_scheduler import (
    get_regression_matrix,
    run_background_evaluation,
    get_eval_status,
    set_schedule_interval,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/admin/observability", tags=["observability"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (RoleEnum.admin, RoleEnum.demo_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


class ScheduleRequest(BaseModel):
    interval: str # "manual" | "6h" | "12h" | "24h"


class EvalTriggerRequest(BaseModel):
    sample_limit: int | None = None


@router.get("/overview")
async def get_overview_endpoint(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """
    Returns unified telemetry, drift analysis, regression scorecard, and topic gaps.
    """
    try:
        overview = await get_observability_overview(db)
        regression = await get_regression_matrix(db)
        return {
            "status": "success",
            "overview": overview,
            "regression": regression,
            "eval_status": get_eval_status(),
        }
    except Exception as exc:
        logger.exception("Failed to load observability overview: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load enterprise observability telemetry",
        )


@router.get("/drift")
async def get_drift_endpoint(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """
    Returns full telemetry drift analysis across Grounding, Latency, Feedback, and Knowledge Gaps.
    """
    try:
        drift = await detect_telemetry_drift(db)
        return drift
    except Exception as exc:
        logger.exception("Failed to compute telemetry drift: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compute telemetry drift",
        )


@router.get("/regression")
async def get_regression_endpoint(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """
    Returns baseline vs latest run regression scorecards with delta % and SLA compliance.
    """
    try:
        matrix = await get_regression_matrix(db)
        return matrix
    except Exception as exc:
        logger.exception("Failed to load regression matrix: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load regression matrix",
        )


@router.post("/eval/run", status_code=status.HTTP_202_ACCEPTED)
async def trigger_eval_endpoint(
    body: EvalTriggerRequest | None = None,
    current_user: User = Depends(_require_admin),
):
    """
    Triggers an asynchronous evaluation run across benchmark test cases.
    """
    if current_user.role == RoleEnum.demo_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo admin has read-only access to evaluation runs.",
        )

    sample_limit = body.sample_limit if body else None
    try:
        res = await run_background_evaluation(sample_limit=sample_limit)
        return res
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except Exception as exc:
        logger.exception("Failed to trigger background evaluation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start evaluation runner",
        )


@router.get("/eval/status")
async def get_eval_status_endpoint(
    _: User = Depends(_require_admin),
):
    """
    Polls active evaluation status or returns last completed run.
    """
    return get_eval_status()


@router.post("/eval/schedule")
async def set_eval_schedule_endpoint(
    req: ScheduleRequest,
    current_user: User = Depends(_require_admin),
):
    """
    Sets the continuous evaluation schedule interval.
    """
    if current_user.role == RoleEnum.demo_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo admin cannot modify schedule intervals.",
        )
    return set_schedule_interval(req.interval)

