import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.models import RoleEnum, User
from app.db.postgres import get_db
from app.security.audit_logger import (
    SecurityEventType,
    SecuritySeverity,
    get_security_summary,
    list_security_logs,
    log_security_event,
)
from app.security.token_blacklist import revoke_all_user_tokens, unlock_account
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/admin/security", tags=["security-admin"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (RoleEnum.admin, RoleEnum.demo_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for security operations",
        )
    return current_user


class UnlockAccountRequest(BaseModel):
    email: str = Field(..., description="Target email address to unlock.")


class RevokeSessionsRequest(BaseModel):
    user_id: str = Field(..., description="Target User UUID to revoke sessions for.")


@router.get("/summary")
async def get_summary_endpoint(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """Retrieve executive security overview metrics and threat distribution."""
    summary = await get_security_summary(db)
    return summary


@router.get("/logs")
async def get_logs_endpoint(
    event_type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    """List paginated security audit trail logs with filtering."""
    items, total = await list_security_logs(
        db,
        event_type=event_type,
        severity=severity,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/unlock-account")
async def unlock_account_endpoint(
    body: UnlockAccountRequest,
    current_user: User = Depends(_require_admin),
):
    """Manually unlock an account previously locked by brute-force triggers."""
    unlocked = unlock_account(body.email)
    log_security_event(
        event_type=SecurityEventType.ACCOUNT_UNLOCKED,
        severity=SecuritySeverity.INFO,
        endpoint="/api/v1/admin/security/unlock-account",
        summary=f"Admin {current_user.email} unlocked account {body.email}",
        user_email=current_user.email,
        details={"unlocked_email": body.email},
    )
    return {
        "success": True,
        "message": f"Account '{body.email}' unlocked successfully.",
        "was_locked": unlocked,
    }


@router.post("/revoke-user-sessions")
async def revoke_user_sessions_endpoint(
    body: RevokeSessionsRequest,
    current_user: User = Depends(_require_admin),
):
    """Instantly terminate and revoke all active sessions for a target user."""
    revoke_all_user_tokens(body.user_id)
    log_security_event(
        event_type=SecurityEventType.TOKEN_REVOKED,
        severity=SecuritySeverity.HIGH,
        endpoint="/api/v1/admin/security/revoke-user-sessions",
        summary=f"Admin {current_user.email} revoked all sessions for user {body.user_id}",
        user_email=current_user.email,
        details={"target_user_id": body.user_id},
    )
    return {
        "success": True,
        "message": f"All sessions for user '{body.user_id}' have been revoked.",
    }
