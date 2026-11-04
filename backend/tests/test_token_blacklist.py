import asyncio
import sys
import uuid
from pathlib import Path
from httpx import ASGITransport, AsyncClient

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth.jwt_handler import create_access_token
from app.main import app
from app.security.token_blacklist import (
    check_account_lockout,
    clear_all_blacklist_data,
    get_security_stats,
    is_token_revoked,
    record_failed_login,
    record_successful_login,
    revoke_all_user_tokens,
    revoke_token,
    unlock_account,
)


def test_single_token_revocation():
    print("\n--- TEST 1: SINGLE TOKEN REVOCATION & BLACKLISTING ---")
    clear_all_blacklist_data()

    user_id = str(uuid.uuid4())
    token = create_access_token(user_id=user_id, role="engineering")

    # 1. Before revocation: must be valid
    assert not is_token_revoked(token), "New token should not be revoked"
    print("  [+] Fresh token verified: not revoked")

    # 2. Revoke the token
    revoked = revoke_token(token, reason="user_logout")
    assert revoked, "revoke_token should return True"
    print("  [+] Token revoked successfully")

    # 3. After revocation: must be recognized as revoked
    assert is_token_revoked(token), "Revoked token must be recognized as revoked"
    print("  [+] Verified revoked token is rejected")

    print("  -> Passed single token revocation test.")


def test_account_wide_token_revocation():
    print("\n--- TEST 2: ACCOUNT-WIDE TOKEN REVOCATION CUTOFF ---")
    clear_all_blacklist_data()

    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    token_a = create_access_token(user_id=user_a, role="hr")
    token_b = create_access_token(user_id=user_b, role="finance")

    assert not is_token_revoked(token_a)
    assert not is_token_revoked(token_b)

    # Revoke all tokens for user A
    revoke_all_user_tokens(user_a)
    print(f"  [+] Revoked all tokens for user A ({user_a[:8]}...)")

    # Token A must be revoked
    assert is_token_revoked(token_a), "Token A must be revoked after account cutoff"
    # Token B must remain valid
    assert not is_token_revoked(token_b), "Token B must remain valid"
    print("  [+] User A tokens revoked; User B unaffected")

    print("  -> Passed account-wide token revocation test.")


def test_brute_force_lockout_progression_and_unlock():
    print("\n--- TEST 3: BRUTE-FORCE LOCKOUT PROGRESSION & ADMIN UNLOCK ---")
    clear_all_blacklist_data()

    target_email = "victim_account@apexcorp.com"
    other_email = "innocent_user@apexcorp.com"

    # Initially not locked
    locked, rem = check_account_lockout(target_email)
    assert not locked, "Account should not be locked initially"

    # Simulate 4 failed attempts
    for i in range(1, 5):
        cnt = record_failed_login(target_email, client_ip="192.168.1.100")
        assert cnt == i
        locked, _ = check_account_lockout(target_email)
        assert not locked, f"Account should not lock on attempt {i}"
    print("  [+] Recorded 4 failed attempts: account still active")

    # 5th failed attempt: triggers lockout
    cnt = record_failed_login(target_email, client_ip="192.168.1.100")
    assert cnt == 5
    locked, remaining_sec = check_account_lockout(target_email)
    assert locked, "Account MUST be locked after 5 failed attempts"
    assert remaining_sec > 800, f"Lockout seconds remaining too low: {remaining_sec}"
    print(f"  [+] 5th failed attempt triggered lockout! (Remaining: {remaining_sec}s)")

    # Other account must be completely unaffected
    other_locked, _ = check_account_lockout(other_email)
    assert not other_locked, "Unrelated account must not be locked"
    print("  [+] Unrelated account unaffected")

    # Admin manual unlock
    unlocked = unlock_account(target_email)
    assert unlocked, "unlock_account should return True"
    locked_after, _ = check_account_lockout(target_email)
    assert not locked_after, "Account must be unlocked after admin action"
    print("  [+] Admin unlock verified: account restored")

    # Test successful login clears failed attempts
    record_failed_login(target_email)
    record_failed_login(target_email)
    record_successful_login(target_email)
    locked_cleared, _ = check_account_lockout(target_email)
    assert not locked_cleared
    print("  [+] Successful login resets failure counters")

    print("  -> Passed brute-force lockout and unlock tests.")


async def test_end_to_end_api_token_revocation():
    print("\n--- TEST 4: END-TO-END API LOGOUT & TOKEN REVOCATION ---")
    clear_all_blacklist_data()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://testserver") as client:
        # 1. Log in with seeded demo HR credentials
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "hr@demo.com", "password": "hr-demo-2026"},
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        access_token = login_res.json()["access_token"]
        print("  [+] Logged in successfully, received access token")

        # 2. Access /auth/me with Bearer token
        headers = {"Authorization": f"Bearer {access_token}"}
        me_res = await client.get("/api/v1/auth/me", headers=headers)
        assert me_res.status_code == 200, f"/auth/me failed: {me_res.text}"
        assert me_res.json()["email"] == "hr@demo.com"
        print("  [+] Verified /auth/me returns 200 OK with valid token")

        # 3. Call /auth/logout with Bearer token
        logout_res = await client.post("/api/v1/auth/logout", headers=headers)
        assert logout_res.status_code == 204, f"Logout failed: {logout_res.status_code}"
        print("  [+] Called /auth/logout -> 204 No Content")

        # 4. Attempt to access /auth/me with the REVOKED token
        me_after = await client.get("/api/v1/auth/me", headers=headers)
        print("  [+] Accessing /auth/me with revoked token -> status:", me_after.status_code)
        assert me_after.status_code == 401, f"Expected 401 for revoked token, got {me_after.status_code}"
        assert "revoked" in me_after.json()["detail"].lower(), f"Unexpected detail: {me_after.json()}"
        print("  [+] Confirmed revoked token is instantly rejected with 401!")

    print("  -> Passed end-to-end API logout token revocation test.")


async def test_end_to_end_api_account_lockout():
    print("\n--- TEST 5: END-TO-END API BRUTE-FORCE LOCKOUT ON /LOGIN ---")
    clear_all_blacklist_data()

    target_email = "lockout_test_user@apex.com"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="https://testserver") as client:
        # Attempt 5 consecutive invalid logins
        for i in range(1, 6):
            res = await client.post(
                "/api/v1/auth/login",
                json={"email": target_email, "password": "WrongPassword123!"},
            )
            assert res.status_code == 401, f"Attempt {i} should be 401, got {res.status_code}"
            print(f"  [+] Attempt {i}: correctly rejected with 401 Invalid credentials")

        # 6th attempt: Account is locked! Must return 429 Too Many Requests
        lockout_res = await client.post(
            "/api/v1/auth/login",
            json={"email": target_email, "password": "AnyPassword!"},
        )
        print("  [+] 6th attempt status:", lockout_res.status_code, "detail:", lockout_res.json())
        assert lockout_res.status_code == 429, f"Expected 429 Locked, got {lockout_res.status_code}"
        assert "locked" in lockout_res.json()["detail"].lower()
        print("  [+] Verified account is locked via API with HTTP 429!")

        # Clean up
        unlock_account(target_email)

    print("  -> Passed end-to-end API brute-force lockout test.")


async def main():
    print("================================================================================")
    print("NEXUSRAG TOKEN BLACKLIST & ACCOUNT LOCKOUT TEST SUITE")
    print("================================================================================")
    test_single_token_revocation()
    test_account_wide_token_revocation()
    test_brute_force_lockout_progression_and_unlock()
    await test_end_to_end_api_token_revocation()
    await test_end_to_end_api_account_lockout()
    print("================================================================================")
    print("ALL TOKEN BLACKLIST & LOCKOUT TESTS PASSED (100% SUCCESS)!")
    print("================================================================================")


if __name__ == "__main__":
    asyncio.run(main())
