from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.models import RoleEnum, User
from app.db.postgres import get_db
from app.knowledge_ops.contradiction_radar import run_full_contradiction_radar
from app.knowledge_ops.decay_scorer import calculate_document_decay_scores
from app.knowledge_ops.demand_forecaster import generate_demand_forecast
from app.knowledge_ops.health_index import compute_enterprise_health_index
from app.knowledge_ops.models import (
    ContradictionScanResult,
    DocumentDecayItem,
    EnterpriseHealthIndex,
    PolicyDraftRequest,
    PolicyDraftResponse,
    PublishDraftRequest,
    DemandForecastItem,
)
from app.knowledge_ops.policy_drafter import (
    generate_policy_draft,
    publish_draft_to_knowledge_base,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/admin/knowledge-ops", tags=["knowledge-ops"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (RoleEnum.admin, RoleEnum.demo_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/overview")
async def get_knowledge_ops_overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """
    Returns unified executive dashboard with Health Index, Contradictions,
    Decay Rankings, and Demand Forecast.
    """
    try:
        radar = await run_full_contradiction_radar(db)
        decay = await calculate_document_decay_scores(db)
        health = await compute_enterprise_health_index(db, radar=radar, decay_items=decay)
        forecast = await generate_demand_forecast(db)

        return {
            "status": "success",
            "health_index": health,
            "contradictions": radar,
            "decay_ranking": decay[:8],
            "demand_forecast": forecast,
        }
    except Exception as exc:
        logger.exception("Failed to assemble Knowledge Ops overview: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load Knowledge Operations overview",
        )


@router.post("/contradictions/scan", response_model=ContradictionScanResult)
async def scan_contradictions_endpoint(
    department: RoleEnum | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """
    Triggers an on-demand Contradiction Radar scan across department policy documents.
    """
    try:
        result = await run_full_contradiction_radar(db, department=department)
        return result
    except Exception as exc:
        logger.exception("Contradiction scan failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to scan policy contradictions",
        )


@router.get("/freshness", response_model=list[DocumentDecayItem])
async def get_freshness_endpoint(
    department: RoleEnum | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """
    Returns document freshness ratings, temporal decay, and query velocity.
    """
    try:
        decay_list = await calculate_document_decay_scores(db, department=department)
        return decay_list
    except Exception as exc:
        logger.exception("Failed to compute freshness scores: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate document decay",
        )


@router.post("/draft", response_model=PolicyDraftResponse)
async def draft_policy_endpoint(
    req: PolicyDraftRequest,
    _: User = Depends(_require_admin),
):
    """
    Autonomously drafts a complete, structured corporate policy manual
    to close an identified knowledge gap.
    """
    try:
        draft = await generate_policy_draft(req)
        return draft
    except Exception as exc:
        logger.exception("Policy drafting failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to draft policy document",
        )


@router.post("/draft/publish")
async def publish_draft_endpoint(
    req: PublishDraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """
    Publishes an approved policy draft directly into PostgreSQL and Qdrant.
    """
    if current_user.role == RoleEnum.demo_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo admin accounts have read-only access to document publishing.",
        )

    try:
        dept_enum = RoleEnum(req.department)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid department: {req.department}")

    try:
        res = await publish_draft_to_knowledge_base(
            db=db,
            filename=req.filename,
            department=dept_enum,
            content=req.content,
            uploader=current_user,
        )
        return res
    except Exception as exc:
        logger.exception("Publishing policy draft failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to publish document draft: {exc}",
        )


@router.get("/forecast", response_model=list[DemandForecastItem])
async def get_forecast_endpoint(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """
    Returns 30-day proactive knowledge demand forecasts and checklists.
    """
    try:
        forecast = await generate_demand_forecast(db)
        return forecast
    except Exception as exc:
        logger.exception("Demand forecasting failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate demand forecast",
        )


@router.get("/health-index", response_model=EnterpriseHealthIndex)
async def get_health_index_endpoint(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """
    Returns the composite Enterprise Knowledge Health Index (0-100) and grade.
    """
    try:
        health = await compute_enterprise_health_index(db)
        return health
    except Exception as exc:
        logger.exception("Health index calculation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate Enterprise Health Index",
        )
