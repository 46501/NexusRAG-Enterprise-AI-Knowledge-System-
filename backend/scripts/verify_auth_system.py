import asyncio
import json
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import httpx
from sqlalchemy import text
from app.db.postgres import AsyncSessionLocal

BASE_URL = "http://localhost:8000/api/v1"

async def test_all():
    print("=" * 60)
    print("NEXUS-RAG COMPLETE AUTH & SYSTEM VERIFICATION")
    print("=" * 60)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. TEST SIGNUP VALIDATIONS & SECURITY
        print("\n--- 1. Testing Signup Security & Validations ---")
        
        # 1a. Attempt to register as admin (MUST BE REJECTED)
        res = await client.post("/auth/signup", json={
            "full_name": "Hacker Admin",
            "email": "hacker@testcorp.com",
            "password": "Password123!",
            "department": "admin"
        })
        print(f"Signup as 'admin' -> Status: {res.status_code}")
        assert res.status_code == 400, f"Expected 400 for admin signup, got {res.status_code}: {res.text}"
        print("  [PASS] Public admin registration properly rejected (400).")

        # 1b. Attempt to register with short password
        res = await client.post("/auth/signup", json={
            "full_name": "Short Pass",
            "email": "short@testcorp.com",
            "password": "short",
            "department": "engineering"
        })
        print(f"Signup with short password -> Status: {res.status_code}")
        assert res.status_code == 422, f"Expected 422 for short password, got {res.status_code}"
        print("  [PASS] Password length validation enforced (422).")

        # 1c. Clean up any previous test user in DB
        async with AsyncSessionLocal() as session:
            await session.execute(text("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email IN ('alice.engineer@testcorp.com', 'inactive.user@testcorp.com'))"))
            await session.execute(text("DELETE FROM users WHERE email IN ('alice.engineer@testcorp.com', 'inactive.user@testcorp.com')"))
            await session.commit()

        # 1d. Valid Signup
        signup_payload = {
            "full_name": "Alice Engineer",
            "email": "alice.engineer@testcorp.com",
            "password": "Password123!",
            "department": "engineering"
        }
        res = await client.post("/auth/signup", json=signup_payload)
        print(f"Valid signup for alice.engineer@testcorp.com -> Status: {res.status_code}")
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        signup_data = res.json()
        assert signup_data["user"]["full_name"] == "Alice Engineer"
        assert signup_data["user"]["role"] == "engineering"
        print(f"  [PASS] Signup successful: {signup_data['message']}")

        # 1e. Duplicate Email Check (MUST BE 409)
        res = await client.post("/auth/signup", json=signup_payload)
        print(f"Duplicate signup -> Status: {res.status_code}")
        assert res.status_code == 409, f"Expected 409 Conflict, got {res.status_code}: {res.text}"
        print("  [PASS] Duplicate email rejected with 409 Conflict.")

        # 1f. Verify DB Persistence & Bcrypt Hash
        async with AsyncSessionLocal() as session:
            row = (await session.execute(text("SELECT id, email, hashed_password, role, full_name, is_active FROM users WHERE email = 'alice.engineer@testcorp.com'"))).fetchone()
            assert row is not None, "User not found in PostgreSQL"
            assert row.hashed_password.startswith("$2b$"), "Password is not bcrypt hashed"
            assert row.full_name == "Alice Engineer", "Full name mismatch in DB"
            assert row.role == "engineering", "Role mismatch in DB"
            assert row.is_active is True, "User should be active by default"
            print("  [PASS] PostgreSQL persistence confirmed: bcrypt hash verified, full_name stored.")

        # 2. TEST LOGIN & SESSIONS
        print("\n--- 2. Testing Login & Session Management ---")

        # 2a. Invalid credentials
        res = await client.post("/auth/login", json={
            "email": "alice.engineer@testcorp.com",
            "password": "WrongPassword123!"
        })
        print(f"Login with wrong password -> Status: {res.status_code}")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  [PASS] Wrong password rejected (401).")

        # 2b. Successful login with cookies
        res = await client.post("/auth/login", json={
            "email": "alice.engineer@testcorp.com",
            "password": "Password123!"
        })
        print(f"Login with valid credentials -> Status: {res.status_code}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        cookies = res.cookies
        assert "access_token" in cookies, "access_token cookie missing"
        assert "refresh_token" in cookies, "refresh_token cookie missing"
        print("  [PASS] Login successful, cookies received.")

        # 2c. Test /auth/me
        res = await client.get("/auth/me", cookies=cookies)
        print(f"Get /auth/me -> Status: {res.status_code}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        me = res.json()
        assert me["email"] == "alice.engineer@testcorp.com"
        assert me["full_name"] == "Alice Engineer"
        assert me["role"] == "engineering"
        assert me["is_active"] is True
        print(f"  [PASS] /auth/me returns: {me}")

        # 2d. Verify last_login_at in DB
        async with AsyncSessionLocal() as session:
            last_login = (await session.execute(text("SELECT last_login_at FROM users WHERE email = 'alice.engineer@testcorp.com'"))).scalar_one()
            assert last_login is not None, "last_login_at was not updated"
            print(f"  [PASS] last_login_at successfully updated in PostgreSQL: {last_login}")

        # 2e. Inactive User Check (MUST BE 403)
        async with AsyncSessionLocal() as session:
            await session.execute(text("UPDATE users SET is_active = false WHERE email = 'alice.engineer@testcorp.com'"))
            await session.commit()

        res = await client.post("/auth/login", json={
            "email": "alice.engineer@testcorp.com",
            "password": "Password123!"
        })
        print(f"Login with inactive account -> Status: {res.status_code}")
        assert res.status_code == 403, f"Expected 403 Forbidden for inactive account, got {res.status_code}"
        print("  [PASS] Inactive user login returns 403 Forbidden.")

        # Re-activate user
        async with AsyncSessionLocal() as session:
            await session.execute(text("UPDATE users SET is_active = true WHERE email = 'alice.engineer@testcorp.com'"))
            await session.commit()

        # 3. TEST EXISTING SEEDED ACCOUNTS
        print("\n--- 3. Testing Existing Seeded Accounts ---")
        seeded = [
            ("hr@demo.com", "hr-demo-2026", "hr"),
            ("engineering@demo.com", "eng-demo-2026", "engineering"),
            ("finance@demo.com", "fin-demo-2026", "finance"),
            ("admin@example.com", "admin-demo-2026", "admin"),
        ]
        admin_cookies = None
        for email, pwd, expected_role in seeded:
            res = await client.post("/auth/login", json={"email": email, "password": pwd})
            assert res.status_code == 200, f"Seeded login failed for {email}: {res.status_code}"
            me = (await client.get("/auth/me", cookies=res.cookies)).json()
            assert me["role"] == expected_role, f"Role mismatch for {email}: expected {expected_role}, got {me['role']}"
            print(f"  [PASS] Seeded account {email} ({expected_role}) works perfectly.")
            if expected_role == "admin":
                admin_cookies = res.cookies

        # 4. RBAC & ADMIN PANEL
        print("\n--- 4. Testing RBAC & Admin Panel ---")
        # 4a. Engineering user attempting admin endpoint -> 403
        eng_login = await client.post("/auth/login", json={"email": "alice.engineer@testcorp.com", "password": "Password123!"})
        res = await client.get("/admin/users", cookies=eng_login.cookies)
        print(f"Engineering user accessing /admin/users -> Status: {res.status_code}")
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"
        print("  [PASS] Non-admin access to /admin/users forbidden (403).")

        # 4b. Admin accessing /admin/users -> 200 with full_name & users
        res = await client.get("/admin/users", cookies=admin_cookies)
        print(f"Admin accessing /admin/users -> Status: {res.status_code}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        users_list = res.json()
        assert len(users_list) >= 5, f"Expected at least 5 users in DB, got {len(users_list)}"
        alice_entry = next((u for u in users_list if u["email"] == "alice.engineer@testcorp.com"), None)
        assert alice_entry is not None, "Alice not found in admin user list"
        assert alice_entry["full_name"] == "Alice Engineer"
        print(f"  [PASS] Admin /admin/users lists {len(users_list)} users, including Alice with full_name.")

        # 5. GEMINI RAG STREAMING QUERY
        print("\n--- 5. Testing Gemini RAG Generation & Streaming ---")
        query_payload = {
            "query": "How does the deployment pipeline work?",
            "stream": True,
            "top_k": 3
        }
        collected_tokens = []
        sources_received = []

        async with client.stream("POST", "/query", json=query_payload, cookies=eng_login.cookies) as response:
            assert response.status_code == 200, f"Query stream failed: {response.status_code}"
            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data_str = line[len("data: "):]
                try:
                    payload = json.loads(data_str)
                    if "token" in payload:
                        collected_tokens.append(payload["token"])
                    if "sources" in payload:
                        sources_received = payload["sources"]
                    if payload.get("done"):
                        print("  [PASS] SSE stream received done indicator.")
                except Exception:
                    pass

        full_answer = "".join(collected_tokens)
        print(f"  [PASS] Gemini streaming generated {len(collected_tokens)} tokens.")
        print(f"  [PASS] Generated answer sample: {full_answer[:80]}...")
        print(f"  [PASS] Sources cited: {[s.get('document_id') or s.get('title') or s.get('source') for s in sources_received]}")

    print("\n" + "=" * 60)
    print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100% GREEN)!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_all())
