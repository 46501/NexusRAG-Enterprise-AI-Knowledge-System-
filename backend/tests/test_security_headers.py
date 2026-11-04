import sys
from pathlib import Path
from httpx import ASGITransport, AsyncClient

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.security.headers import (
    DEFAULT_CSP,
    DEFAULT_PERMISSIONS_POLICY,
    get_default_security_headers,
)


async def test_standard_security_headers_on_health_endpoint():
    print("\n--- TEST 1: STANDARD SECURITY HEADERS ON API ENDPOINTS ---")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://testserver") as client:
        res = await client.get("/health")
        print("  [+] GET /health status:", res.status_code)
        headers = res.headers

        # 1. MIME Sniffing defense
        assert headers.get("x-content-type-options") == "nosniff", "Missing X-Content-Type-Options"
        print("  [+] Verified X-Content-Type-Options: nosniff")

        # 2. Clickjacking defense
        assert headers.get("x-frame-options") == "DENY", "Missing X-Frame-Options"
        print("  [+] Verified X-Frame-Options: DENY")

        # 3. Content Security Policy (CSP)
        assert "default-src 'self'" in headers.get("content-security-policy", ""), "Missing default-src in CSP"
        assert "frame-ancestors 'none'" in headers.get("content-security-policy", ""), "Missing frame-ancestors in CSP"
        print("  [+] Verified Content-Security-Policy (CSP) with frame-ancestors 'none'")

        # 4. Referrer Policy
        assert headers.get("referrer-policy") == "strict-origin-when-cross-origin", "Missing Referrer-Policy"
        print("  [+] Verified Referrer-Policy: strict-origin-when-cross-origin")

        # 5. Permissions Policy
        assert "camera=()" in headers.get("permissions-policy", ""), "Missing camera=() in Permissions-Policy"
        assert "microphone=()" in headers.get("permissions-policy", ""), "Missing microphone=() in Permissions-Policy"
        print("  [+] Verified Permissions-Policy sandboxing")

        # 6. HSTS (Strict-Transport-Security) on HTTPS
        assert "max-age=31536000" in headers.get("strict-transport-security", ""), "Missing HSTS on HTTPS request"
        assert "includeSubDomains" in headers.get("strict-transport-security", ""), "Missing includeSubDomains in HSTS"
        print("  [+] Verified Strict-Transport-Security (HSTS)")

        # 7. Cross-Origin-Opener-Policy
        assert headers.get("cross-origin-opener-policy") == "same-origin-allow-popups", "Missing COOP header"
        print("  [+] Verified Cross-Origin-Opener-Policy")

    print("  -> Passed standard security headers on API endpoints.")


async def test_anti_caching_on_sensitive_auth_endpoints():
    print("\n--- TEST 2: ANTI-CACHING ON SENSITIVE AUTH & ADMIN ENDPOINTS ---")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://testserver") as client:
        # Check /api/v1/auth/me (unauthenticated 401 response should still have anti-cache headers)
        res_auth = await client.get("/api/v1/auth/me")
        print("  [+] GET /api/v1/auth/me status:", res_auth.status_code)
        headers = res_auth.headers

        assert "no-store" in headers.get("cache-control", ""), "Missing no-store in Cache-Control on /auth"
        assert headers.get("pragma") == "no-cache", "Missing Pragma: no-cache on /auth"
        assert headers.get("expires") == "0", "Missing Expires: 0 on /auth"
        print("  [+] Verified anti-caching headers on /api/v1/auth/me")

        # Check /api/v1/admin/documents (unauthenticated 401 response should have anti-cache headers)
        res_admin = await client.get("/api/v1/admin/documents")
        print("  [+] GET /api/v1/admin/documents status:", res_admin.status_code)
        headers_admin = res_admin.headers

        assert "no-store" in headers_admin.get("cache-control", ""), "Missing no-store in Cache-Control on /admin"
        assert headers_admin.get("pragma") == "no-cache", "Missing Pragma: no-cache on /admin"
        print("  [+] Verified anti-caching headers on /api/v1/admin/documents")

    print("  -> Passed anti-caching tests on sensitive endpoints.")


def test_helper_get_default_security_headers():
    print("\n--- TEST 3: HELPER FUNCTION get_default_security_headers ---")
    h = get_default_security_headers(is_https=True)
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert "strict-transport-security" in h
    assert "camera=()" in h["permissions-policy"]
    print("  [+] Verified default security headers dict structure.")
    print("  -> Passed helper dictionary tests.")


async def main():
    print("================================================================================")
    print("NEXUSRAG ENTERPRISE SECURITY HEADERS TEST SUITE (app/security/headers.py)")
    print("================================================================================")
    await test_standard_security_headers_on_health_endpoint()
    await test_anti_caching_on_sensitive_auth_endpoints()
    test_helper_get_default_security_headers()
    print("================================================================================")
    print("ALL SECURITY HEADERS TESTS PASSED (100% SUCCESS)!")
    print("================================================================================")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
