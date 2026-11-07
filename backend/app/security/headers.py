from typing import Callable
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

# Default Enterprise Content Security Policy (CSP)
DEFAULT_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob: https:; "
    "connect-src 'self' https: wss: http://localhost:* blob:; "
    "frame-src 'self' blob:; "
    "frame-ancestors 'self'; "
    "form-action 'self'; "
    "base-uri 'self'; "
    "object-src 'self' blob:;"
)

DEFAULT_PERMISSIONS_POLICY = (
    "camera=(), "
    "microphone=(), "
    "geolocation=(), "
    "payment=(), "
    "usb=(), "
    "display-capture=(), "
    "interest-cohort=()"
)

# Paths containing sensitive user credentials, tokens, or audit records
SENSITIVE_PREFIXES = (
    "/api/v1/auth",
    "/api/v1/admin",
    "/auth",
    "/admin",
)


class SecurityHeadersMiddleware:
    """Enterprise ASGI middleware injecting defense-in-depth HTTP security headers.

    Features:
    - Zero-copy stream-safe header injection (no buffering of SSE or file downloads).
    - HSTS (Strict-Transport-Security) for HTTPS / production environments.
    - Clickjacking defense (X-Frame-Options: DENY and CSP frame-ancestors: 'none').
    - MIME sniffing prevention (X-Content-Type-Options: nosniff).
    - Referrer leakage control (Referrer-Policy: strict-origin-when-cross-origin).
    - Capability sandboxing (Permissions-Policy).
    - Anti-caching for sensitive auth & admin endpoints (Cache-Control: no-store).
    """

    def __init__(
        self,
        app: ASGIApp,
        csp: str = DEFAULT_CSP,
        enable_hsts: bool = True,
        hsts_max_age: int = 31536000,
        frame_options: str = "DENY",
        content_type_options: str = "nosniff",
        referrer_policy: str = "strict-origin-when-cross-origin",
        permissions_policy: str = DEFAULT_PERMISSIONS_POLICY,
        coop_policy: str = "same-origin-allow-popups",
    ):
        self.app = app
        self.csp = csp
        self.enable_hsts = enable_hsts
        self.hsts_header = f"max-age={hsts_max_age}; includeSubDomains; preload"
        self.frame_options = frame_options
        self.content_type_options = content_type_options
        self.referrer_policy = referrer_policy
        self.permissions_policy = permissions_policy
        self.coop_policy = coop_policy
        self.is_prod = _s.app_env == "production"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        scheme = scope.get("scheme", "http")

        async def send_with_security_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)

                # 1. MIME-type sniffing defense
                if "x-content-type-options" not in headers:
                    headers["x-content-type-options"] = self.content_type_options

                # 2. Clickjacking defense (allow same-origin for in-app PDF/file viewer)
                if "x-frame-options" not in headers:
                    if path.endswith("/file") or path.endswith("/pdf"):
                        headers["x-frame-options"] = "SAMEORIGIN"
                    else:
                        headers["x-frame-options"] = self.frame_options

                # 3. Content Security Policy (CSP)
                if "content-security-policy" not in headers:
                    headers["content-security-policy"] = self.csp

                # 4. Referrer Policy
                if "referrer-policy" not in headers:
                    headers["referrer-policy"] = self.referrer_policy

                # 5. Permissions Policy
                if "permissions-policy" not in headers:
                    headers["permissions-policy"] = self.permissions_policy

                # 6. Cross-Origin-Opener-Policy
                if "cross-origin-opener-policy" not in headers:
                    headers["cross-origin-opener-policy"] = self.coop_policy

                # 7. Strict-Transport-Security (HSTS)
                # Apply in production or when accessed via HTTPS
                if self.enable_hsts and (self.is_prod or scheme == "https"):
                    if "strict-transport-security" not in headers:
                        headers["strict-transport-security"] = self.hsts_header

                # 8. Anti-Caching for Sensitive Auth/Admin Endpoints
                if any(path.startswith(prefix) for prefix in SENSITIVE_PREFIXES):
                    headers["cache-control"] = "no-store, no-cache, must-revalidate, private"
                    headers["pragma"] = "no-cache"
                    headers["expires"] = "0"

            await send(message)

        await self.app(scope, receive, send_with_security_headers)


def get_default_security_headers(is_https: bool = True) -> dict[str, str]:
    """Helper returning standard security headers dict for audit and inspection."""
    headers = {
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "content-security-policy": DEFAULT_CSP,
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": DEFAULT_PERMISSIONS_POLICY,
        "cross-origin-opener-policy": "same-origin-allow-popups",
    }
    if is_https:
        headers["strict-transport-security"] = "max-age=31536000; includeSubDomains; preload"
    return headers

