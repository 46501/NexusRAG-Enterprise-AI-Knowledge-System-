"""
Tier 3: Enterprise Observability & Continuous Eval Loop Verification Suite.
Validates:
  1. Telemetry Drift Detection Engine (Grounding, Latency Percentiles, Sentiment, Knowledge Gaps)
  2. Native Gemini LLM-as-a-Judge Evaluation (RAGAS-equivalent Faithfulness, Relevancy, Precision, Recall)
  3. Regression Delta Matrix & SLA Compliance
  4. Observability Admin API Endpoints with Strict RBAC Isolation
"""

import asyncio
import os
import sys
from pathlib import Path

# Setup paths
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import httpx
from app.db.postgres import AsyncSessionLocal
from app.observability.drift_detector import detect_telemetry_drift, get_observability_overview
from app.observability.eval_judge import run_gemini_judge_case
from app.observability.eval_scheduler import get_regression_matrix, get_eval_status

BASE_URL = "http://127.0.0.1:8000"


async def test_drift_detection_engine():
    print("\n========================================================")
    print("TEST 1: TELEMETRY DRIFT DETECTION ENGINE")
    print("========================================================")
    async with AsyncSessionLocal() as session:
        drift = await detect_telemetry_drift(session)

        print(f"Overall Status: {drift['overall_status']}")
        print(f"Summary: {drift['overall_summary']}")
        print(f"Grounding Rate: {drift['grounding']['recent_pct']}% (Status: {drift['grounding']['status']})")
        print(f"P90 Latency: {drift['latency']['recent_stats']['p90']} ms (P50: {drift['latency']['recent_stats']['p50']} ms)")
        print(f"User Satisfaction: {drift['sentiment']['satisfaction_pct']}% ({drift['sentiment']['positive_count']} positive, {drift['sentiment']['negative_count']} negative)")
        print(f"Knowledge Gap Clusters: {len(drift['topic_gaps'])}")
        if drift['topic_gaps']:
            print(f"Top Gap Topic: '{drift['topic_gaps'][0]['topic']}' ({drift['topic_gaps'][0]['count']} inquiries)")

        assert drift["overall_status"] in ["HEALTHY", "DRIFT_DETECTED", "CRITICAL_REGRESSION"]
        assert "grounding" in drift
        assert "latency" in drift
        assert "sentiment" in drift
        assert isinstance(drift["topic_gaps"], list)
        assert len(drift["diagnostics"]) > 0
        assert len(drift["recommendations"]) > 0

    print("✅ Test 1 Passed: Telemetry Drift Detection calculated multi-dimensional metrics!")


async def test_native_gemini_judge():
    print("\n========================================================")
    print("TEST 2: NATIVE GEMINI LLM-AS-A-JUDGE (RAGAS EQUIVALENT)")
    print("========================================================")

    sample_question = "How many weeks of parental leave does Apex provide to primary and secondary caregivers?"
    sample_contexts = [
        "[Document: leave_policy.txt | Department: hr | Section: Parental Leave]\n"
        "Apex provides 16 weeks of fully paid parental leave for the primary caregiver and 8 weeks "
        "of fully paid parental leave for the secondary caregiver. These benefits apply to birth, adoption, "
        "or foster placement and to both biological and adoptive parents."
    ]
    sample_answer = (
        "Based on the leave policy, Apex provides 16 weeks of fully paid parental leave to the primary "
        "caregiver and 8 weeks of fully paid parental leave to the secondary caregiver [1]."
    )
    sample_ground_truth = (
        "Apex provides 16 weeks of fully paid parental leave for the primary caregiver and 8 weeks "
        "of fully paid parental leave for the secondary caregiver."
    )

    scores = await run_gemini_judge_case(
        question=sample_question,
        answer=sample_answer,
        contexts=sample_contexts,
        ground_truth=sample_ground_truth,
    )

    print(f"Faithfulness Score:       {scores['faithfulness']:.4f}")
    print(f"Answer Relevancy Score:   {scores['answer_relevancy']:.4f}")
    print(f"Context Precision Score:  {scores['context_precision']:.4f}")
    print(f"Context Recall Score:     {scores['context_recall']:.4f}")

    assert scores["faithfulness"] >= 0.85, f"Faithfulness too low: {scores['faithfulness']}"
    assert scores["answer_relevancy"] >= 0.80, f"Relevancy too low: {scores['answer_relevancy']}"
    assert scores["context_precision"] >= 0.80, f"Precision too low: {scores['context_precision']}"
    assert scores["context_recall"] >= 0.85, f"Recall too low: {scores['context_recall']}"

    print("✅ Test 2 Passed: Native Gemini LLM-as-a-Judge scored benchmark case accurately!")


async def test_regression_delta_matrix():
    print("\n========================================================")
    print("TEST 3: REGRESSION DELTA MATRIX & SLA VERIFICATION")
    print("========================================================")
    async with AsyncSessionLocal() as session:
        reg = await get_regression_matrix(session)

        print(f"Regression Verdict: {reg['health_verdict']}")
        print(f"Schedule Interval:  {reg['schedule_interval']}")
        print(f"Metrics Tracked:    {len(reg['metrics'])}")

        for m in reg["metrics"]:
            sign = "+" if m["delta"] >= 0 else ""
            print(f"  • {m['metric_name']:<20}: current={m['current_score']:.3f} | base={m['baseline_score']:.3f} | target={m['target_threshold']:.2f} | Δ={sign}{m['delta_pct']}% | compliant={m['is_compliant']}")

        assert reg["health_verdict"] in ["HEALTHY", "REGRESSION_DETECTED", "SLA_BREACH"]
        assert len(reg["metrics"]) == 4

        metric_names = [m["metric_name"] for m in reg["metrics"]]
        for expected in ["faithfulness", "answer_relevancy", "context_recall", "context_precision"]:
            assert expected in metric_names

    print("✅ Test 3 Passed: Regression Delta Matrix properly tracked against SLA targets!")


async def test_observability_api_endpoints():
    print("\n========================================================")
    print("TEST 4: OBSERVABILITY API ENDPOINTS & RBAC ISOLATION")
    print("========================================================")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # 1. Login as Admin
        admin_login = await client.post("/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "admin-demo-2026",
        })
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 2. Login as HR
        hr_login = await client.post("/api/v1/auth/login", json={
            "email": "hr@demo.com",
            "password": "hr-demo-2026",
        })
        assert hr_login.status_code == 200, f"HR login failed: {hr_login.text}"
        hr_token = hr_login.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}

        # A) Admin can access overview
        resp = await client.get("/api/v1/admin/observability/overview", headers=admin_headers)
        print(f"Admin /observability/overview:    Status {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "overview" in data
        assert "regression" in data

        # B) Admin can access drift endpoint
        resp_drift = await client.get("/api/v1/admin/observability/drift", headers=admin_headers)
        print(f"Admin /observability/drift:       Status {resp_drift.status_code}")
        assert resp_drift.status_code == 200

        # C) Admin can access regression endpoint
        resp_reg = await client.get("/api/v1/admin/observability/regression", headers=admin_headers)
        print(f"Admin /observability/regression:  Status {resp_reg.status_code}")
        assert resp_reg.status_code == 200

        # D) Admin can inspect eval status
        resp_status = await client.get("/api/v1/admin/observability/eval/status", headers=admin_headers)
        print(f"Admin /observability/eval/status: Status {resp_status.status_code}")
        assert resp_status.status_code == 200

        # E) HR user is strictly blocked (403 Forbidden)
        resp_hr = await client.get("/api/v1/admin/observability/overview", headers=hr_headers)
        print(f"HR Access /observability/overview: Status {resp_hr.status_code} (Blocked as expected)")
        assert resp_hr.status_code == 403, f"Expected 403, got {resp_hr.status_code}"

        # F) Clear cookies to test truly unauthenticated request (401 Unauthorized)
        client.cookies.clear()
        resp_anon = await client.get("/api/v1/admin/observability/overview")
        print(f"Unauthenticated Access:           Status {resp_anon.status_code} (Blocked as expected)")
        assert resp_anon.status_code == 401, f"Expected 401, got {resp_anon.status_code}"

    print("✅ Test 4 Passed: Observability API secured with strict RBAC access controls!")


async def run_all_tier3_tests():
    print("=" * 60)
    print("NEXUSRAG TIER 3: OBSERVABILITY & CONTINUOUS EVAL TEST SUITE")
    print("=" * 60)

    await test_drift_detection_engine()
    await test_native_gemini_judge()
    await test_regression_delta_matrix()
    await test_observability_api_endpoints()

    print("\n" + "=" * 60)
    print("🎉 ALL TIER 3 OBSERVABILITY TESTS PASSED SUCCESSFULLY! (4/4)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_all_tier3_tests())
