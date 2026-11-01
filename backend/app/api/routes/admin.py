import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.models import RoleEnum, User
from app.db.postgres import get_db
from app.schemas.admin import (
    DocumentListResponse,
    DocumentResponse,
    EvalResultResponse,
    EvalRunStartResponse,
    SetActiveRequest,
    UserAdminResponse,
)
from app.services.admin_service import (
    ServerUnderLoadError,
    delete_document,
    get_eval_results,
    list_documents,
    list_users,
    set_user_active,
    trigger_eval_run,
)
from app.utils.logger import get_logger

router = APIRouter(prefix="/admin", tags=["admin"])
logger = get_logger(__name__)


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (RoleEnum.admin, RoleEnum.demo_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/documents", response_model=DocumentListResponse)
async def get_documents(
    department: RoleEnum | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    docs, total = await list_documents(db, department=department, offset=offset, limit=limit)
    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    logger.info("DELETE /admin/documents/%s — handler entered", document_id)
    try:
        await delete_document(db, document_id)
        logger.info("DELETE /admin/documents/%s — completed successfully", document_id)
    except ValueError:
        logger.warning("DELETE /admin/documents/%s — not found", document_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    except Exception:
        logger.exception("DELETE /admin/documents/%s — unexpected error", document_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document",
        )


@router.get("/users", response_model=list[UserAdminResponse])
async def get_users(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    users = await list_users(db, offset=offset, limit=limit)
    return [UserAdminResponse.model_validate(u) for u in users]


@router.patch("/users/{user_id}/active", response_model=UserAdminResponse)
async def update_user_active(
    user_id: uuid.UUID,
    body: SetActiveRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    try:
        user = await set_user_active(db, user_id, body.is_active)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserAdminResponse.model_validate(user)


@router.get("/eval/results", response_model=list[EvalResultResponse])
async def get_eval_results_route(
    metric_name: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    rows = await get_eval_results(db, metric_name=metric_name, limit=limit)
    return [EvalResultResponse.model_validate(r) for r in rows]


@router.post(
    "/eval/run",
    response_model=EvalRunStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def post_eval_run(_: User = Depends(_require_admin)):
    try:
        result = await trigger_eval_run()
    except ServerUnderLoadError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return EvalRunStartResponse(**result)
