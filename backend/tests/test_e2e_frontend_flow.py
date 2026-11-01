import http.cookiejar
import io
import json
import sys
import urllib.parse
import urllib.request

# Ensure UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE_URL = "http://localhost:5173/api/v1"  # Test through Vite proxy directly!
DIRECT_URL = "http://localhost:8000/api/v1"


def test_user_flow(email, password, expected_role, query):
    print(f"\n=======================================================")
    print(f"Testing flow for user: {email} (role: {expected_role})")
    print(f"=======================================================")

    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    # 1. Login
    login_data = json.dumps({"email": email, "password": password}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with opener.open(req) as resp:
        assert resp.status == 200, f"Login failed with status {resp.status}"
        body = json.loads(resp.read().decode("utf-8"))
        assert "access_token" in body, "access_token not returned"
        print(f"[✓] Login successful, access token received")

    # 2. Get current user
    req = urllib.request.Request(f"{BASE_URL}/auth/me")
    with opener.open(req) as resp:
        assert resp.status == 200
        me = json.loads(resp.read().decode("utf-8"))
        print(f"[✓] /auth/me verified: {me.get('email')} role={me.get('role')}")
        assert me.get("role") == expected_role, f"Role mismatch: {me.get('role')} != {expected_role}"

    # 3. Documents list for department
    req = urllib.request.Request(f"{BASE_URL}/documents")
    with opener.open(req) as resp:
        assert resp.status == 200
        docs = json.loads(resp.read().decode("utf-8")).get("documents", [])
        print(f"[✓] /documents loaded: {len(docs)} documents")
        for d in docs:
            assert d.get("department") == expected_role, f"Document department leak: {d.get('department')}"
        print(f"[✓] Verified all {len(docs)} returned documents belong exclusively to {expected_role}")

    # 4. Streaming Query
    print(f"\nSubmitting streaming query: {query!r}")
    q_data = json.dumps({"query": query, "stream": True, "top_k": 3}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/query",
        data=q_data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    tokens = []
    sources = []
    done_received = False

    with opener.open(req) as resp:
        assert resp.status == 200, f"Query returned status {resp.status}"
        assert "text/event-stream" in resp.headers.get("Content-Type", ""), "Not SSE"

        buffer = ""
        while True:
            chunk = resp.read(256)
            if not chunk:
                break
            buffer += chunk.decode("utf-8", errors="ignore")
            lines = buffer.split("\n")
            buffer = lines.pop()

            for line in lines:
                line = line.strip()
                if line.startswith("data: "):
                    payload = json.loads(line[6:])
                    if "token" in payload:
                        tokens.append(payload["token"])
                        # Print progressive streaming output
                        sys.stdout.write(payload["token"])
                        sys.stdout.flush()
                    if payload.get("done"):
                        done_received = True
                        sources = payload.get("sources", [])

    print("\n")
    assert len(tokens) > 0, "No tokens received from stream"
    assert done_received, "Done event was not received"
    print(f"[✓] Stream completed successfully! Total tokens received: {len(tokens)}")
    print(f"[✓] Sources returned ({len(sources)}): {[s.get('source') for s in sources]}")
    for s in sources:
        assert s.get("department") == expected_role, f"Source department mismatch: {s.get('department')}"
    print(f"[✓] All cited sources verified to belong to {expected_role}!")


def main():
    print("Testing Vite Proxy & Backend Integration on http://localhost:5173 ...")

    # HR User Test
    test_user_flow(
        "hr@demo.com",
        "hr-demo-2026",
        "hr",
        "What is the vacation and PTO policy?",
    )

    # Engineering User Test
    test_user_flow(
        "engineering@demo.com",
        "eng-demo-2026",
        "engineering",
        "What are the incident severity levels and resolution SLA targets?",
    )

    # Finance User Test
    test_user_flow(
        "finance@demo.com",
        "fin-demo-2026",
        "finance",
        "What is the expense reimbursement and per diem policy?",
    )

    print("\n=======================================================")
    print("ALL FRONTEND INTEGRATION TESTS PASSED PERFECTLY!")
    print("=======================================================")


if __name__ == "__main__":
    main()
