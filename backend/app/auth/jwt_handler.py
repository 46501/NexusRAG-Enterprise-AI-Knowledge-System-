import hashlib
from datetime import datetime, timedelta, timezone
from typing import Literal

from jose import JWTError, jwt

from app.config import get_settings

_s = get_settings()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "exp": _now() + timedelta(minutes=_s.jwt_access_token_expire_minutes),
        "iat": _now(),
    }
    return jwt.encode(payload, _s.jwt_secret_key, algorithm=_s.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": _now() + timedelta(days=_s.jwt_refresh_token_expire_days),
        "iat": _now(),
    }
    return jwt.encode(payload, _s.jwt_secret_key, algorithm=_s.jwt_algorithm)


def decode_token(token: str, expected_type: Literal["access", "refresh"]) -> dict:
    try:
        payload = jwt.decode(token, _s.jwt_secret_key, algorithms=[_s.jwt_algorithm])
    except JWTError:
        raise ValueError("Invalid or expired token")
    if payload.get("type") != expected_type:
        raise ValueError(f"Expected {expected_type} token")
    return payload


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
