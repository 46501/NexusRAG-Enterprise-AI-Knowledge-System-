import asyncio
import io
import json
import sys
import uuid
from pathlib import Path

# Add backend directory to path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import httpx
from sqlalchemy import text
from app.db.postgres import AsyncSessionLocal

BASE_URL = "http://localhost:8000/api/v1"
HEALTH_URL = "http://localhost:8000/health"

class TestReport:
    def __init__(self):
        self.results = []

    def record(self, category: str, test_name: str, passed: bool, details: str = ""):
        self.results.append({
            "category": category,
            "name": test_name,
            "passed": passed,
            "details": details
        })
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status} {test_name}: {details}")

    def summary(self):
        total = len(self.results)
        passed = sum(1 for r in self.results if r["passed"])
        failed = total - passed
        print("\n" + "=" * 70)
        print(f"TEST SUITE SUMMARY: {passed}/{total} Passed ({(passed/total)*100:.1f}%) | {failed} Failed")
        print("=" * 70)
        return total, passed, failed

report = TestReport()

async def run_e2e_tests():
    print("=" * 70)
    print("NEXUS-RAG COMPREHENSIVE END-TO-END QA & VERIFICATION TEST SUITE")
    print("=" * 70)

    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=45.0) as client:
        # -------------------------------------------------------------
        # MODULE 1: HEALTH & INFRASTRUCTURE
        # -------------------------------------------------------------
        print("\n>>> MODULE 1: Health & Infrastructure Checks")
        
        # 1.1 /health
        res = await client.get("/health")
        report.record("Infrastructure", "Health Endpoint (/health)", res.status_code == 200 and res.json().get("status") == "ok", f"Status: {res.status_code}, Body: {res.text}")

        # 1.2 CORS Headers
        res = await client.options("/api/v1/query", headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type,Authorization"
        })
        cors_ok = res.headers.get("access-control-allow-origin") is not None or res.status_code == 200
        report.record("Infrastructure", "CORS Preflight (OPTIONS /api/v1/query)", cors_ok, f"Status: {res.status_code}, Headers: {dict(res.headers)}")

        # -------------------------------------------------------------
        # MODULE 2: AUTHENTICATION & SESSION MANAGEMENT
        # -------------------------------------------------------------
        print("\n>>> MODULE 2: Authentication & Session Management")

        # 2.1 Public Admin Registration Rejection
        res = await client.post("/api/v1/auth/signup", json={
            "full_name": "Infiltrator Admin",
            "email": "hacker_admin@testcorp.com",
            "password": "Password123!",
            "department": "admin"
        })
        report.record("Auth", "Reject Admin Signup (400)", res.status_code == 400, f"Status: {res.status_code}")

        # 2.2 Short Password Rejection
        res = await client.post("/api/v1/auth/signup", json={
            "full_name": "Short Pwd",
            "email": "short_pwd@testcorp.com",
            "password": "123",
            "department": "hr"
        })
        report.record("Auth", "Password Length Validation (422)", res.status_code == 422, f"Status: {res.status_code}")

        # 2.3 Cleanup existing test users in DB
        async with AsyncSessionLocal() as session:
            await session.execute(text("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email IN ('test.qa.hr@testcorp.com', 'test.qa.eng@testcorp.com', 'test.qa.inactive@testcorp.com'))"))
            await session.execute(text("DELETE FROM users WHERE email IN ('test.qa.hr@testcorp.com', 'test.qa.eng@testcorp.com', 'test.qa.inactive@testcorp.com')"))
            await session.commit()

        # 2.4 Valid Signup
        qa_hr_payload = {
            "full_name": "QA HR Specialist",
            "email": "test.qa.hr@testcorp.com",
            "password": "Password123!",
            "department": "hr"
        }
        res = await client.post("/api/v1/auth/signup", json=qa_hr_payload)
        report.record("Auth", "Valid HR User Signup (201)", res.status_code == 201, f"Status: {res.status_code}")

        # 2.5 Duplicate Email Rejection
        res = await client.post("/api/v1/auth/signup", json=qa_hr_payload)
        report.record("Auth", "Duplicate Email Conflict (409)", res.status_code == 409, f"Status: {res.status_code}")

        # 2.6 DB Password Bcrypt & Integrity Check
        async with AsyncSessionLocal() as session:
            row = (await session.execute(text("SELECT id, email, hashed_password, role, full_name, is_active FROM users WHERE email = 'test.qa.hr@testcorp.com'"))).fetchone()
            db_ok = row is not None and row.hashed_password.startswith("$2b$") and row.role == "hr"
            report.record("Auth", "PostgreSQL Persistence & Bcrypt Hash", db_ok, f"User: {row.email if row else None}, Hash prefix: {row.hashed_password[:7] if row else None}")

        # 2.7 Login with Wrong Password
        res = await client.post("/api/v1/auth/login", json={
            "email": "test.qa.hr@testcorp.com",
            "password": "WrongPassword999!"
        })
        report.record("Auth", "Invalid Password Rejection (401)", res.status_code == 401, f"Status: {res.status_code}")

        # 2.8 Login with Non-Existent User
        res = await client.post("/api/v1/auth/login", json={
            "email": "nonexistent.user.404@testcorp.com",
            "password": "Password123!"
        })
        report.record("Auth", "Non-Existent User Login Rejection (401)", res.status_code == 401, f"Status: {res.status_code}")

        # 2.9 Successful Login (Cookie + Access Token in JSON)
        res = await client.post("/api/v1/auth/login", json={
            "email": "test.qa.hr@testcorp.com",
            "password": "Password123!"
        })
        hr_login_data = res.json() if res.status_code == 200 else {}
        hr_cookies = res.cookies
        hr_bearer_token = hr_login_data.get("access_token")
        login_ok = res.status_code == 200 and "access_token" in hr_cookies and hr_bearer_token is not None
        report.record("Auth", "Successful Login (200 + Tokens)", login_ok, f"Status: {res.status_code}, Cookie present: {'access_token' in hr_cookies}")

        # 2.10 /auth/me with Cookie
        res = await client.get("/api/v1/auth/me", cookies=hr_cookies)
        me_cookie_ok = res.status_code == 200 and res.json().get("email") == "test.qa.hr@testcorp.com"
        report.record("Auth", "Session Verification via Cookie (/auth/me)", me_cookie_ok, f"Status: {res.status_code}")

        # 2.11 /auth/me with Authorization: Bearer Token
        res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {hr_bearer_token}"})
        me_bearer_ok = res.status_code == 200 and res.json().get("email") == "test.qa.hr@testcorp.com"
        report.record("Auth", "Session Verification via Bearer Token (/auth/me)", me_bearer_ok, f"Status: {res.status_code}")

        # 2.12 /auth/me Unauthenticated
        client.cookies.clear()
        res = await client.get("/api/v1/auth/me")
        report.record("Auth", "Unauthenticated /auth/me Rejection (401)", res.status_code == 401, f"Status: {res.status_code}")

        # 2.13 Inactive User Login Block
        async with AsyncSessionLocal() as session:
            await session.execute(text("UPDATE users SET is_active = false WHERE email = 'test.qa.hr@testcorp.com'"))
            await session.commit()

        res = await client.post("/api/v1/auth/login", json={
            "email": "test.qa.hr@testcorp.com",
            "password": "Password123!"
        })
        report.record("Auth", "Inactive User Login Rejection (403)", res.status_code == 403, f"Status: {res.status_code}")

        # Reactivate HR User
        async with AsyncSessionLocal() as session:
            await session.execute(text("UPDATE users SET is_active = true WHERE email = 'test.qa.hr@testcorp.com'"))
            await session.commit()

        # Login seeded users for comprehensive testing
        res_hr = await client.post("/api/v1/auth/login", json={"email": "hr@demo.com", "password": "hr-demo-2026"})
        res_eng = await client.post("/api/v1/auth/login", json={"email": "engineering@demo.com", "password": "eng-demo-2026"})
        res_fin = await client.post("/api/v1/auth/login", json={"email": "finance@demo.com", "password": "fin-demo-2026"})
        res_adm = await client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "admin-demo-2026"})

        seeded_ok = all(r.status_code == 200 for r in [res_hr, res_eng, res_fin, res_adm])
        report.record("Auth", "Seeded Multi-Department Accounts Login", seeded_ok, "HR, Engineering, Finance, Admin seeded logins verified")

        hr_headers = {"Authorization": f"Bearer {res_hr.json()['access_token']}"}
        eng_headers = {"Authorization": f"Bearer {res_eng.json()['access_token']}"}
        fin_headers = {"Authorization": f"Bearer {res_fin.json()['access_token']}"}
        adm_headers = {"Authorization": f"Bearer {res_adm.json()['access_token']}"}

        # -------------------------------------------------------------
        # MODULE 3: RBAC & MULTI-TENANT ISOLATION
        # -------------------------------------------------------------
        print("\n>>> MODULE 3: RBAC & Department Isolation")

        # 3.1 HR user accessing HR documents
        res = await client.get("/api/v1/documents", headers=hr_headers)
        hr_docs = res.json().get("documents", []) if res.status_code == 200 else []
        hr_docs_ok = res.status_code == 200 and len(hr_docs) > 0 and all(d["department"] == "hr" for d in hr_docs)
        report.record("RBAC", "HR User Fetches HR Documents Exclusively", hr_docs_ok, f"Found {len(hr_docs)} docs, all HR")

        # 3.2 HR user attempting to fetch Engineering documents via query param
        res = await client.get("/api/v1/documents?department=engineering", headers=hr_headers)
        report.record("RBAC", "HR Blocked from /documents?department=engineering (403)", res.status_code == 403, f"Status: {res.status_code}")

        # 3.3 HR user attempting to fetch Engineering documents via path param
        res = await client.get("/api/v1/documents/engineering", headers=hr_headers)
        report.record("RBAC", "HR Blocked from /documents/engineering (403)", res.status_code == 403, f"Status: {res.status_code}")

        # 3.4 HR user attempting query with department="engineering"
        res = await client.post("/api/v1/query", json={"query": "test", "department": "engineering"}, headers=hr_headers)
        report.record("RBAC", "HR Blocked from Querying Engineering Department (403)", res.status_code == 403, f"Status: {res.status_code}")

        # 3.5 HR user attempting query focusing on Engineering document
        res = await client.post("/api/v1/query", json={"query": "test", "focus_doc": "deployment_guide.txt"}, headers=hr_headers)
        report.record("RBAC", "HR Blocked from Focusing on Engineering Document (403)", res.status_code == 403, f"Status: {res.status_code}")

        # 3.6 Non-admin user accessing /admin/users
        res = await client.get("/api/v1/admin/users", headers=eng_headers)
        report.record("RBAC", "Non-Admin Blocked from /admin/users (403)", res.status_code == 403, f"Status: {res.status_code}")

        # 3.7 Non-admin user accessing /admin/analytics
        res = await client.get("/api/v1/admin/analytics", headers=fin_headers)
        report.record("RBAC", "Non-Admin Blocked from /admin/analytics (403)", res.status_code == 403, f"Status: {res.status_code}")

        # 3.8 Non-admin user accessing /admin/feedbacks
        res = await client.get("/api/v1/admin/feedbacks", headers=hr_headers)
        report.record("RBAC", "Non-Admin Blocked from /admin/feedbacks (403)", res.status_code == 403, f"Status: {res.status_code}")

        # 3.9 Admin user accessing /admin/users
        res = await client.get("/api/v1/admin/users", headers=adm_headers)
        adm_users = res.json() if res.status_code == 200 else []
        report.record("RBAC", "Admin Access to /admin/users (200)", res.status_code == 200 and len(adm_users) > 0, f"Total users: {len(adm_users)}")

        # 3.10 Admin user accessing /admin/analytics
        res = await client.get("/api/v1/admin/analytics", headers=adm_headers)
        analytics_data = res.json() if res.status_code == 200 else {}
        overview = analytics_data.get("overview", {})
        report.record("RBAC", "Admin Access to /admin/analytics (200)", res.status_code == 200 and "total_queries" in overview, f"Queries: {overview.get('total_queries')}, Docs: {overview.get('total_documents')}")

        # -------------------------------------------------------------
        # MODULE 4: DOCUMENT INGESTION & DOCUMENT READER
        # -------------------------------------------------------------
        print("\n>>> MODULE 4: Document Ingestion & Document Reader")

        # 4.1 Unsupported File Extension Rejection (.sh)
        fake_sh_file = ("script.sh", b"#!/bin/bash\necho 'hello'", "text/x-sh")
        res = await client.post("/api/v1/ingest", files={"file": fake_sh_file}, headers=hr_headers)
        report.record("Ingestion", "Reject Unsupported File Extension (422)", res.status_code == 422, f"Status: {res.status_code}")

        # 4.2 Cross-Department Ingestion Attempt by Non-Admin
        test_txt = ("qa_test_doc.txt", b"This is a confidential QA test document for NexusRAG.", "text/plain")
        res = await client.post("/api/v1/ingest", files={"file": test_txt}, data={"department": "finance"}, headers=hr_headers)
        report.record("Ingestion", "Reject Non-Admin Cross-Department Ingest (403)", res.status_code == 403, f"Status: {res.status_code}")

        # 4.3 Valid Document Ingestion (.txt) into User's Authorized Department
        unique_qa_doc_name = f"qa_test_policy_{uuid.uuid4().hex[:6]}.txt"
        doc_content = (
            f"=== {unique_qa_doc_name} ===\n"
            "NEXUSRAG ENTERPRISE SPECIAL COMPLIANCE AND REST BREAK DIRECTIVE\n"
            "1. Overview: All engineering personnel are granted 45 minutes of scheduled focus time daily.\n"
            "2. Shift allowances: Overtime approval requires Lead Principal Architect signoff within 4 hours.\n"
            "3. Verification Code: QA-VERIFY-DELTA-7749.\n"
        ).encode("utf-8")
        test_valid_file = (unique_qa_doc_name, doc_content, "text/plain")
        
        res = await client.post("/api/v1/ingest", files={"file": test_valid_file}, headers=eng_headers)
        ingest_ok = res.status_code == 201
        ingest_json = res.json() if ingest_ok else {}
        created_doc_id = ingest_json.get("doc_id")
        report.record("Ingestion", "Valid TXT Ingestion & Qdrant Chunking (201)", ingest_ok and created_doc_id is not None, f"Doc ID: {created_doc_id}, Chunks: {ingest_json.get('chunk_count')}")

        # 4.4 Document Reader: Authorized Department Access
        if created_doc_id:
            res = await client.get(f"/api/v1/documents/{created_doc_id}/content", headers=eng_headers)
            content_ok = res.status_code == 200 and "document" in res.json() and "chunks" in res.json()
            report.record("Document Reader", "Read Ingested Document Content & Chunks (200)", content_ok, f"Status: {res.status_code}, Chunks returned: {len(res.json().get('chunks', [])) if content_ok else 0}")

            # 4.5 Document Reader: Cross-Department Access Rejection
            res = await client.get(f"/api/v1/documents/{created_doc_id}/content", headers=hr_headers)
            report.record("Document Reader", "Cross-Department Document Read Blocked (403)", res.status_code == 403, f"Status: {res.status_code}")

        # 4.6 Document Reader: Non-Existent Document (404)
        random_uuid = str(uuid.uuid4())
        res = await client.get(f"/api/v1/documents/{random_uuid}/content", headers=eng_headers)
        report.record("Document Reader", "Non-Existent Document Content (404)", res.status_code == 404, f"Status: {res.status_code}")

        # 4.7 Clean up Ingested QA Test Document via Admin API
        if created_doc_id:
            res = await client.delete(f"/api/v1/admin/documents/{created_doc_id}", headers=adm_headers)
            report.record("Ingestion", "Admin Document Deletion Cleanup (204)", res.status_code == 204, f"Status: {res.status_code}")

        # -------------------------------------------------------------
        # MODULE 5: RAG RETRIEVAL & SYNTHESIS PIPELINE
        # -------------------------------------------------------------
        print("\n>>> MODULE 5: RAG Retrieval, Synthesis & Streaming")

        # 5.1 Non-streaming Query with Citations & Confidence Score
        hr_query_payload = {
            "query": "What are the rules regarding bereavement leave and maternity leave?",
            "stream": False,
            "top_k": 3
        }
        res = await client.post("/api/v1/query", json=hr_query_payload, headers=hr_headers)
        rag_ok = res.status_code == 200
        rag_json = res.json() if rag_ok else {}
        answer = rag_json.get("answer", "")
        sources = rag_json.get("sources", [])
        follow_ups = rag_json.get("suggested_questions", [])
        conf_score = rag_json.get("confidence_score")

        rag_verified = rag_ok and len(answer) > 20 and len(sources) > 0 and all(s.get("department") == "hr" for s in sources)
        report.record("RAG Pipeline", "Non-Streaming RAG Synthesis & Citation Mapping", rag_verified, f"Length: {len(answer)} chars, Sources: {[s.get('source') for s in sources]}, Confidence: {conf_score}%")

        # 5.2 Streaming Query (SSE)
        eng_stream_payload = {
            "query": "What is the standard procedure for deploying services to production?",
            "stream": True,
            "top_k": 3
        }
        tokens_received = []
        stream_sources = []
        done_flag = False

        async with client.stream("POST", "/api/v1/query", json=eng_stream_payload, headers=eng_headers) as response:
            stream_http_ok = response.status_code == 200
            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data_str = line[len("data: "):]
                try:
                    payload = json.loads(data_str)
                    if "token" in payload:
                        tokens_received.append(payload["token"])
                    if payload.get("done"):
                        done_flag = True
                        stream_sources = payload.get("sources", [])
                except Exception:
                    pass

        stream_verified = stream_http_ok and len(tokens_received) > 0 and done_flag and len(stream_sources) > 0
        report.record("RAG Pipeline", "Streaming SSE Token Delivery & Final Event", stream_verified, f"Tokens: {len(tokens_received)}, Done: {done_flag}, Sources: {[s.get('source') for s in stream_sources]}")

        # 5.3 Grounding Guardrail / Hallucination Rejection
        out_of_domain_payload = {
            "query": "What is the capital of Peru and what are the best tourist hotels there?",
            "stream": False,
            "top_k": 3
        }
        res = await client.post("/api/v1/query", json=out_of_domain_payload, headers=hr_headers)
        out_domain_answer = res.json().get("answer", "") if res.status_code == 200 else ""
        out_domain_sources = res.json().get("sources", []) if res.status_code == 200 else []
        # Gemini guardrails should either decline or cite 0 sources
        guardrail_ok = ("only answer questions based" in out_domain_answer.lower() or "department's documents" in out_domain_answer.lower() or len(out_domain_sources) == 0)
        report.record("RAG Pipeline", "Out-of-Domain Hallucination Guardrail", guardrail_ok, f"Answer: {out_domain_answer[:80]}... Citations: {len(out_domain_sources)}")

        # 5.4 Conversational Memory & Follow-Up Context Handling
        multi_turn_payload = {
            "query": "How many days of bereavement leave are granted?",
            "history": [
                {"role": "user", "content": "What leave policies exist for family emergencies?"},
                {"role": "assistant", "content": "NexusRAG provides bereavement leave for immediate and extended family members according to the leave policy [leave_policy.txt]."}
            ],
            "stream": False,
            "top_k": 3
        }
        res = await client.post("/api/v1/query", json=multi_turn_payload, headers=hr_headers)
        multi_turn_ok = res.status_code == 200 and len(res.json().get("answer", "")) > 10
        report.record("RAG Pipeline", "Conversational Memory & Context Resolution", multi_turn_ok, f"Status: {res.status_code}")

        # -------------------------------------------------------------
        # MODULE 6: MULTI-DOCUMENT COMPARISON MATRIX
        # -------------------------------------------------------------
        print("\n>>> MODULE 6: Multi-Document Comparison Matrix")

        comparison_query = (
            "Please perform a detailed, side-by-side comparative analysis between 'performance_review.txt' and 'employee_handbook.txt' regarding review timelines, cycles, and rating scales.\n"
            "Structure your output into:\n"
            "1. ### Executive Summary: High-level overview of similarities and critical differences.\n"
            "2. ### Comparative Matrix: A clean, structured markdown table with columns:\n"
            "| Dimension / Criteria | performance_review.txt | employee_handbook.txt | Divergence & Key Notes |\n"
            "3. ### Key Differences & Recommendations: Bulleted summary.\n"
            "Cite your sources with bracketed numbers like [1], [2]."
        )
        compare_payload = {
            "query": comparison_query,
            "stream": False,
            "top_k": 8
        }
        res = await client.post("/api/v1/query", json=compare_payload, headers=hr_headers)
        compare_ok = res.status_code == 200
        comp_ans = res.json().get("answer", "") if compare_ok else ""
        has_table = "|" in comp_ans and ("Executive Summary" in comp_ans or "Comparative" in comp_ans or "Matrix" in comp_ans or "Divergence" in comp_ans)
        report.record("Comparison Matrix", "Side-by-Side Document Comparison Synthesis", compare_ok and has_table, f"Answer length: {len(comp_ans)} chars, Contains Table: {has_table}")

        # -------------------------------------------------------------
        # MODULE 7: USER FEEDBACK & RESOLUTION WORKFLOW
        # -------------------------------------------------------------
        print("\n>>> MODULE 7: User Feedback & Resolution Workflow")

        # 7.1 User Submits Positive Feedback
        fb_pos_payload = {
            "query_text": "What is the vacation policy?",
            "answer_text": "Employees receive 20 days paid vacation annually [leave_policy.txt].",
            "is_positive": True,
            "sources_cited": ["leave_policy.txt"]
        }
        res = await client.post("/api/v1/feedback", json=fb_pos_payload, headers=hr_headers)
        fb_pos_ok = res.status_code == 200
        pos_id = res.json().get("id") if fb_pos_ok else None
        report.record("Feedback", "User Submits Positive Feedback (200)", fb_pos_ok and pos_id is not None, f"Feedback ID: {pos_id}")

        # 7.2 User Submits Negative Feedback with Reason & Comment
        fb_neg_payload = {
            "query_text": "What is the per diem rate for travel?",
            "answer_text": "I can only answer questions based on your department documents.",
            "is_positive": False,
            "feedback_reason": "Incomplete Answer",
            "feedback_comment": "Expected per diem table for international travel.",
            "sources_cited": []
        }
        res = await client.post("/api/v1/feedback", json=fb_neg_payload, headers=hr_headers)
        fb_neg_ok = res.status_code == 200
        neg_id = res.json().get("id") if fb_neg_ok else None
        report.record("Feedback", "User Submits Negative Feedback with Reason (200)", fb_neg_ok and neg_id is not None, f"Feedback ID: {neg_id}")

        # 7.3 Admin Lists Feedbacks
        res = await client.get("/api/v1/admin/feedbacks?status=all", headers=adm_headers)
        fb_list_ok = res.status_code == 200 and "feedbacks" in res.json()
        report.record("Feedback", "Admin Feedbacks List (200)", fb_list_ok, f"Total feedbacks: {res.json().get('total') if fb_list_ok else 0}")

        # 7.4 Admin Resolves Negative Feedback
        if neg_id:
            res = await client.patch(f"/api/v1/admin/feedbacks/{neg_id}/resolve?resolved=true", headers=adm_headers)
            res_ok = res.status_code == 200 and res.json().get("is_resolved") is True
            report.record("Feedback", "Admin Resolves Feedback Flag (200)", res_ok, f"Feedback {neg_id} resolved: {res.json().get('is_resolved') if res_ok else False}")

        # -------------------------------------------------------------
        # MODULE 8: ADMIN ANALYTICS & AUDIT OBSERVABILITY
        # -------------------------------------------------------------
        print("\n>>> MODULE 8: Admin Analytics & Observability")

        # 8.1 Query Logs in Supabase
        async with AsyncSessionLocal() as session:
            count = (await session.execute(text("SELECT count(*) FROM query_logs"))).scalar_one()
            report.record("Observability", "PostgreSQL Query Logging Audit Trail", count > 0, f"Total logged queries in DB: {count}")

        # 8.2 Admin Dashboard Analytics Payload
        res = await client.get("/api/v1/admin/analytics", headers=adm_headers)
        an_ok = res.status_code == 200
        an_data = res.json() if an_ok else {}
        req_keys = {"overview", "departments", "recent_queries", "top_faqs", "rag_eval_scores", "system_health"}
        has_keys = req_keys.issubset(set(an_data.keys()))
        an_overview = an_data.get("overview", {})
        report.record("Observability", "Admin Dashboard Analytics Schema & Calculations", an_ok and has_keys, f"Metrics: queries={an_overview.get('total_queries')}, latency={an_overview.get('avg_latency_ms')}ms, users={an_overview.get('active_users')}")

        # 8.3 RAGAS Evaluation Results Route
        res = await client.get("/api/v1/admin/eval/results", headers=adm_headers)
        report.record("Observability", "Admin Eval Results Endpoint (200)", res.status_code == 200, f"Status: {res.status_code}, Rows: {len(res.json()) if res.status_code == 200 else 0}")

        # -------------------------------------------------------------
        # SUMMARY
        # -------------------------------------------------------------
        total, passed, failed = report.summary()
        return total, passed, failed

if __name__ == "__main__":
    t, p, f = asyncio.run(run_e2e_tests())
    sys.exit(0 if f == 0 else 1)
