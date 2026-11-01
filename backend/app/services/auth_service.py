from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt_handler import create_access_token, create_refresh_token, decode_token, hash_token
from app.auth.password import hash_password, verify_password
from app.db.models import RefreshToken, User
from app.utils.logger import get_logger
from app.config import get_settings

logger = get_logger(__name__)
_s = get_settings()


async def register_user(db: AsyncSession, email: str, password: str, role: str) -> User:
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise ValueError(f"Email already registered: {email}")
    user = User(email=email, hashed_password=hash_password(password), role=role)
    db.add(user)
    await db.flush()
    logger.info("Registered user %s with role %s", email, role)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(password, user.hashed_password):
        raise ValueError("Invalid email or password")
    if not user.is_active:
        raise ValueError("Account is inactive")
    logger.info("Authenticated user %s", email)
    return user


async def create_tokens(db: AsyncSession, user: User) -> tuple[str, str]:
    access = create_access_token(str(user.id), user.role.value)
    refresh = create_refresh_token(str(user.id))

    token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=_s.jwt_refresh_token_expire_days),
    )
    db.add(token_record)
    await db.flush()
    logger.info("Issued tokens for user %s", user.id)
    return access, refresh


async def rotate_refresh_token(db: AsyncSession, raw_refresh: str) -> tuple[str, str, User]:
    payload = decode_token(raw_refresh, "refresh")
    user_id = payload["sub"]

    stored = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_refresh))
    )
    if not stored or stored.expires_at < datetime.now(timezone.utc):
        raise ValueError("Refresh token invalid or expired")

    await db.execute(delete(RefreshToken).where(RefreshToken.id == stored.id))

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise ValueError("User not found or inactive")

    access, refresh = await create_tokens(db, user)
    logger.info("Rotated refresh token for user %s", user_id)
    return access, refresh, user


async def revoke_refresh_token(db: AsyncSession, raw_refresh: str) -> None:
    await db.execute(
        delete(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_refresh))
    )
    logger.info("Revoked refresh token")
