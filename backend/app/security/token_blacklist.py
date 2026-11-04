import hashlib
import threading
import time
from datetime import datetime, timezone
from typing import NamedTuple

from jose import JWTError, jwt

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

# Lockout Policy Constants
MAX_FAILED_ATTEMPTS = 5
ATTEMPT_WINDOW_SECONDS = 600       # 10 minutes rolling window
LOCKOUT_DURATION_SECONDS = 900     # 15 minutes lockout

# Thread safety lock for in-memory security structures
_lock = threading.Lock()

# -----------------------------------------------------------------------------
# In-Memory Security Stores (Memory Footprint < 1 MB)
# -----------------------------------------------------------------------------
# Mapping: token_identifier (jti or sha256) -> expiration timestamp (float)
_revoked_tokens: dict[str, float] = {}

# Mapping: user_id -> cutoff timestamp (tokens issued <= cutoff are revoked)
_user_revocation_cutoffs: dict[str, float] = {}

# Mapping: email / identifier -> list of failed attempt timestamps
_failed_attempts: dict[str, list[float]] = {}

# Mapping: email -> lockout expiration timestamp
_locked_accounts: dict[str, float] = {}


def _now_ts() -> float:
    return time.time()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _purge_expired_entries() -> None:
    """Internal cleanup routine: evict expired tokens and past lockouts."""
    now = _now_ts()

    # 1. Purge expired revoked tokens (their natural JWT exp has passed)
    expired_tokens = [k for k, exp in _revoked_tokens.items() if exp <= now]
    for k in expired_tokens:
        del _revoked_tokens[k]

    # 2. Purge expired lockouts
    expired_lockouts = [k for k, exp in _locked_accounts.items() if exp <= now]
    for k in expired_lockouts:
        del _locked_accounts[k]

    # 3. Purge stale attempt records older than the window
    cutoff = now - ATTEMPT_WINDOW_SECONDS
    for k in list(_failed_attempts.keys()):
        _failed_attempts[k] = [t for t in _failed_attempts[k] if t > cutoff]
        if not _failed_attempts[k]:
            del _failed_attempts[k]


# -----------------------------------------------------------------------------
# Part 1: Instant Token Revocation (Blacklist)
# -----------------------------------------------------------------------------
def revoke_token(token: str, reason: str = "logout") -> bool:
    """Immediately revoke an access or refresh token so it cannot be reused.

    Extracts the token's JTI or SHA256 hash and retains it until its natural exp.
    """
    if not token:
        return False

    now = _now_ts()
    token_key = None
    exp_ts = now + (_s.jwt_access_token_expire_minutes * 60)

    # Attempt to parse payload to retrieve exact exp and jti
    try:
        # Decode without verification to read claims for blacklist retention
        unverified = jwt.get_unverified_claims(token)
        token_key = unverified.get("jti") or _hash_token(token)
        if "exp" in unverified:
            exp_ts = float(unverified["exp"])
    except Exception:
        token_key = _hash_token(token)

    with _lock:
        _purge_expired_entries()
        _revoked_tokens[token_key] = exp_ts
        logger.info("Token revoked: key=%s exp_in=%.0fs reason=%s", token_key[:12], exp_ts - now, reason)

    return True


def is_token_revoked(token: str, payload: dict | None = None) -> bool:
    """Check if a token has been revoked individually or via account-wide cutoff."""
    if not token:
        return True

    now = _now_ts()

    # Extract claims if not passed
    claims = payload
    if claims is None:
        try:
            claims = jwt.decode(token, _s.jwt_secret_key, algorithms=[_s.jwt_algorithm])
        except Exception:
            claims = {}

    jti = claims.get("jti")
    hashed = _hash_token(token)
    user_id = claims.get("sub")
    iat = float(claims.get("iat", 0))

    with _lock:
        _purge_expired_entries()

        # 1. Check if token JTI or hash is in blacklist
        if jti and jti in _revoked_tokens:
            logger.warning("Revoked token access attempt (by JTI: %s)", jti[:12])
            return True
        if hashed in _revoked_tokens:
            logger.warning("Revoked token access attempt (by hash: %s)", hashed[:12])
            return True

        # 2. Check if user has an account-wide revocation cutoff
        if user_id and user_id in _user_revocation_cutoffs:
            cutoff = _user_revocation_cutoffs[user_id]
            if iat <= cutoff:
                logger.warning("Token access attempt after account revocation cutoff (user=%s)", user_id)
                return True

    return False


def revoke_all_user_tokens(user_id: str) -> None:
    """Revoke ALL existing tokens issued for a specific user.

    Useful when an admin deactivates an account or changes a user's role.
    """
    if not user_id:
        return
    now = _now_ts()
    with _lock:
        _user_revocation_cutoffs[str(user_id)] = now
        logger.info("Revoked all active sessions for user=%s at ts=%.0f", user_id, now)


# -----------------------------------------------------------------------------
# Part 2: Brute-Force Account Lockout Guard
# -----------------------------------------------------------------------------
def check_account_lockout(email: str, client_ip: str | None = None) -> tuple[bool, int]:
    """Check if an account or IP is currently locked due to brute-force attempts.

    Returns:
        (is_locked: bool, seconds_remaining: int)
    """
    if not email:
        return False, 0

    norm_email = email.strip().lower()
    now = _now_ts()

    with _lock:
        _purge_expired_entries()

        # Check account-specific lockout
        if norm_email in _locked_accounts:
            lock_until = _locked_accounts[norm_email]
            if lock_until > now:
                remaining = int(lock_until - now)
                return True, remaining
            else:
                del _locked_accounts[norm_email]

    return False, 0


def record_failed_login(email: str, client_ip: str | None = None) -> int:
    """Record a failed login attempt. If attempts exceed threshold, locks the account.

    Returns:
        The total count of failed attempts within the active sliding window.
    """
    if not email:
        return 0

    norm_email = email.strip().lower()
    now = _now_ts()

    with _lock:
        _purge_expired_entries()

        # Append failed attempt timestamp
        attempts = _failed_attempts.setdefault(norm_email, [])
        attempts.append(now)

        # Count recent attempts within the active window
        cutoff = now - ATTEMPT_WINDOW_SECONDS
        recent_attempts = [t for t in attempts if t > cutoff]
        _failed_attempts[norm_email] = recent_attempts
        failed_count = len(recent_attempts)

        logger.warning(
            "Failed login attempt for email=%s (attempt %d/%d from ip=%s)",
            norm_email,
            failed_count,
            MAX_FAILED_ATTEMPTS,
            client_ip,
        )

        # Trigger lockout if max attempts exceeded
        if failed_count >= MAX_FAILED_ATTEMPTS:
            lockout_until = now + LOCKOUT_DURATION_SECONDS
            _locked_accounts[norm_email] = lockout_until
            logger.error(
                "SECURITY LOCKOUT ACTIVATED: email=%s locked for %d seconds due to %d consecutive failed attempts.",
                norm_email,
                LOCKOUT_DURATION_SECONDS,
                failed_count,
            )

        return failed_count


def record_successful_login(email: str, client_ip: str | None = None) -> None:
    """Clear failed login attempts upon successful authentication."""
    if not email:
        return
    norm_email = email.strip().lower()
    with _lock:
        _failed_attempts.pop(norm_email, None)
        _locked_accounts.pop(norm_email, None)
        logger.info("Cleared failed login history for email=%s after successful login", norm_email)


def unlock_account(email: str) -> bool:
    """Manually unlock an account (admin action)."""
    if not email:
        return False
    norm_email = email.strip().lower()
    with _lock:
        existed = norm_email in _locked_accounts or norm_email in _failed_attempts
        _locked_accounts.pop(norm_email, None)
        _failed_attempts.pop(norm_email, None)
        logger.info("Admin manually unlocked account email=%s", norm_email)
        return existed


def get_security_stats() -> dict:
    """Return runtime security metrics for admin observability."""
    now = _now_ts()
    with _lock:
        _purge_expired_entries()
        return {
            "revoked_tokens_count": len(_revoked_tokens),
            "locked_accounts_count": len(_locked_accounts),
            "tracked_attempt_accounts": len(_failed_attempts),
            "account_cutoffs_count": len(_user_revocation_cutoffs),
        }


def clear_all_blacklist_data() -> None:
    """Reset all security structures (used primarily for test isolation)."""
    with _lock:
        _revoked_tokens.clear()
        _user_revocation_cutoffs.clear()
        _failed_attempts.clear()
        _locked_accounts.clear()
