import asyncio
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SecurityAuditLog
from app.db.postgres import AsyncSessionLocal
from app.security.token_blacklist import get_security_stats
from app.utils.logger import get_logger

logger = get_logger(__name__)


class SecurityEventType(str, Enum):
    PROMPT_INJECTION_BLOCKED = "PROMPT_INJECTION_BLOCKED"
    PII_REDACTED = "PII_REDACTED"
    UNAUTHORIZED_ACCESS_403 = "UNAUTHORIZED_ACCESS_403"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    FAILED_LOGIN = "FAILED_LOGIN"
    TOKEN_REVOKED = "TOKEN_REVOKED"
    ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED"
    USER_DEACTIVATED = "USER_DEACTIVATED"


class SecuritySeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


# In-memory fast ring-buffer of recent security events (last 100)
# Serves as instant fallback and ultra-fast cache for dashboard
_recent_events_cache: deque[dict[str, Any]] = deque(maxlen=100)


async def _persist_event_async(
    event_type: str,
    severity: str,
    endpoint: str,
    summary: str,
    user_id: uuid.UUID | None = None,
    user_email: str | None = None,
    department: str | None = None,
    client_ip: str | None = None,
    details: dict | None = None,
) -> None:
    """Internal task to write audit record to Supabase PostgreSQL."""
    try:
        async with AsyncSessionLocal() as session:
            entry = SecurityAuditLog(
                event_type=event_type,
                severity=severity,
                endpoint=endpoint,
                summary=summary,
                user_id=user_id,
                user_email=user_email,
                department=department,
                client_ip=client_ip,
                details=details,
            )
            session.add(entry)
            await session.commit()
    except Exception as exc:
        logger.error("Failed to persist security audit event: %s", exc)


def log_security_event(
    event_type: SecurityEventType | str,
    severity: SecuritySeverity | str,
    endpoint: str,
    summary: str,
    user_id: uuid.UUID | str | None = None,
    user_email: str | None = None,
    department: str | None = None,
    client_ip: str | None = None,
    details: dict | None = None,
) -> None:
    """Record an enterprise security event asynchronously.

    Does NOT block caller execution or API response latency.
    """
    ev_type = event_type.value if isinstance(event_type, SecurityEventType) else str(event_type)
    sev = severity.value if isinstance(severity, SecuritySeverity) else str(severity)

    u_id = None
    if user_id:
        try:
            u_id = uuid.UUID(str(user_id))
        except (ValueError, TypeError):
            u_id = None

    now_iso = datetime.now(timezone.utc).isoformat()
    cache_item = {
        "id": str(uuid.uuid4()),
        "event_type": ev_type,
        "severity": sev,
        "endpoint": endpoint,
        "summary": summary,
        "user_email": user_email,
        "department": department,
        "client_ip": client_ip,
        "details": details or {},
        "created_at": now_iso,
    }
    _recent_events_cache.appendleft(cache_item)

    logger.warning("SECURITY EVENT [%s - %s]: %s (user=%s ip=%s)", sev, ev_type, summary, user_email, client_ip)

    # Spawn async non-blocking task for persistence
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            _persist_event_async(
                event_type=ev_type,
                severity=sev,
                endpoint=endpoint,
                summary=summary,
                user_id=u_id,
                user_email=user_email,
                department=department,
                client_ip=client_ip,
                details=details,
            )
        )
    except RuntimeError:
        pass


# -----------------------------------------------------------------------------
# Convenience Helper Loggers
# -----------------------------------------------------------------------------
def log_prompt_injection(
    query: str,
    threat_category: str,
    matched_pattern: str | None,
    user_email: str | None = None,
    department: str | None = None,
    client_ip: str | None = None,
    endpoint: str = "/api/v1/query",
) -> None:
    """Log blocked prompt injection or jailbreak attempt."""
    log_security_event(
        event_type=SecurityEventType.PROMPT_INJECTION_BLOCKED,
        severity=SecuritySeverity.CRITICAL if "OVERRIDE" in str(threat_category) else SecuritySeverity.HIGH,
        endpoint=endpoint,
        summary=f"Blocked {threat_category} prompt attack: {matched_pattern or 'Adversarial pattern'}",
        user_email=user_email,
        department=department,
        client_ip=client_ip,
        details={
            "threat_category": threat_category,
            "matched_pattern": matched_pattern,
            "query_preview": query[:80] if query else "",
        },
    )


def log_pii_redaction(
    entity_types: list[str],
    count: int,
    user_email: str | None = None,
    department: str | None = None,
    client_ip: str | None = None,
    endpoint: str = "/api/v1/query",
) -> None:
    """Log detection and masking of sensitive PII or secrets."""
    log_security_event(
        event_type=SecurityEventType.PII_REDACTED,
        severity=SecuritySeverity.HIGH if any(t in ("API_KEY", "PRIVATE_KEY", "SSN") for t in entity_types) else SecuritySeverity.MEDIUM,
        endpoint=endpoint,
        summary=f"Redacted {count} sensitive entities ({', '.join(set(entity_types))})",
        user_email=user_email,
        department=department,
        client_ip=client_ip,
        details={
            "entity_types": entity_types,
            "redaction_count": count,
        },
    )


def log_unauthorized_access(
    user_email: str,
    user_role: str,
    target_resource: str,
    client_ip: str | None = None,
    endpoint: str = "/api/v1/query",
) -> None:
    """Log unauthorized cross-department access attempt (HTTP 403)."""
    log_security_event(
        event_type=SecurityEventType.UNAUTHORIZED_ACCESS_403,
        severity=SecuritySeverity.HIGH,
        endpoint=endpoint,
        summary=f"Unauthorized access rejected: user with role '{user_role}' attempted to access '{target_resource}'",
        user_email=user_email,
        department=user_role,
        client_ip=client_ip,
        details={
            "user_role": user_role,
            "target_resource": target_resource,
        },
    )


def log_account_lockout(
    email: str,
    client_ip: str | None = None,
    attempt_count: int = 5,
    endpoint: str = "/api/v1/auth/login",
) -> None:
    """Log account brute-force lockout trigger."""
    log_security_event(
        event_type=SecurityEventType.ACCOUNT_LOCKED,
        severity=SecuritySeverity.CRITICAL,
        endpoint=endpoint,
        summary=f"Account locked for 15 minutes due to {attempt_count} consecutive failed login attempts",
        user_email=email,
        client_ip=client_ip,
        details={
            "attempt_count": attempt_count,
            "lockout_minutes": 15,
        },
    )


def log_token_revocation(
    user_email: str | None,
    reason: str,
    client_ip: str | None = None,
    endpoint: str = "/api/v1/auth/logout",
) -> None:
    """Log access token revocation event."""
    log_security_event(
        event_type=SecurityEventType.TOKEN_REVOKED,
        severity=SecuritySeverity.INFO,
        endpoint=endpoint,
        summary=f"Session token invalidated ({reason})",
        user_email=user_email,
        client_ip=client_ip,
        details={"reason": reason},
    )


# -----------------------------------------------------------------------------
# Database Queries & Aggregations for Admin Dashboard
# -----------------------------------------------------------------------------
async def get_security_summary(db: AsyncSession) -> dict[str, Any]:
    """Calculate executive security metrics and threat distributions."""
    now = datetime.now(timezone.utc)
    one_day_ago = now - timedelta(days=1)
    seven_days_ago = now - timedelta(days=7)

    # 1. Total events in last 24h & 7d
    total_24h = await db.scalar(
        select(func.count(SecurityAuditLog.id)).where(SecurityAuditLog.created_at >= one_day_ago)
    ) or 0

    total_7d = await db.scalar(
        select(func.count(SecurityAuditLog.id)).where(SecurityAuditLog.created_at >= seven_days_ago)
    ) or 0

    # 2. Critical events in 7d
    critical_count = await db.scalar(
        select(func.count(SecurityAuditLog.id))
        .where(SecurityAuditLog.created_at >= seven_days_ago)
        .where(SecurityAuditLog.severity == "CRITICAL")
    ) or 0

    # 3. Severity breakdown (last 7d)
    sev_rows = (await db.execute(
        select(SecurityAuditLog.severity, func.count(SecurityAuditLog.id))
        .where(SecurityAuditLog.created_at >= seven_days_ago)
        .group_by(SecurityAuditLog.severity)
    )).all()
    severity_breakdown = {s: cnt for s, cnt in sev_rows}

    # 4. Event type breakdown (last 7d)
    ev_rows = (await db.execute(
        select(SecurityAuditLog.event_type, func.count(SecurityAuditLog.id))
        .where(SecurityAuditLog.created_at >= seven_days_ago)
        .group_by(SecurityAuditLog.event_type)
    )).all()
    event_type_breakdown = {ev: cnt for ev, cnt in ev_rows}

    # 5. In-memory live stats (lockouts & blacklisted tokens)
    live_stats = get_security_stats()

    return {
        "total_events_24h": total_24h,
        "total_events_7d": total_7d,
        "critical_events_7d": critical_count,
        "severity_breakdown": severity_breakdown,
        "event_type_breakdown": event_type_breakdown,
        "active_locked_accounts": live_stats.get("locked_accounts_count", 0),
        "active_revoked_tokens": live_stats.get("revoked_tokens_count", 0),
        "recent_cached_count": len(_recent_events_cache),
    }


async def list_security_logs(
    db: AsyncSession,
    event_type: str | None = None,
    severity: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Retrieve paginated and filtered security audit logs."""
    query = select(SecurityAuditLog)
    count_query = select(func.count(SecurityAuditLog.id))

    if event_type:
        query = query.where(SecurityAuditLog.event_type == event_type)
        count_query = count_query.where(SecurityAuditLog.event_type == event_type)

    if severity:
        query = query.where(SecurityAuditLog.severity == severity.upper())
        count_query = count_query.where(SecurityAuditLog.severity == severity.upper())

    if search:
        s_term = f"%{search}%"
        cond = (
            SecurityAuditLog.summary.ilike(s_term)
            | SecurityAuditLog.user_email.ilike(s_term)
            | SecurityAuditLog.endpoint.ilike(s_term)
        )
        query = query.where(cond)
        count_query = count_query.where(cond)

    total = await db.scalar(count_query) or 0
    query = query.order_by(desc(SecurityAuditLog.created_at)).offset(offset).limit(limit)
    rows = (await db.scalars(query)).all()

    items = [
        {
            "id": str(r.id),
            "event_type": r.event_type,
            "severity": r.severity,
            "summary": r.summary,
            "endpoint": r.endpoint,
            "user_email": r.user_email,
            "department": r.department,
            "client_ip": r.client_ip,
            "details": r.details or {},
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]

    return items, total

