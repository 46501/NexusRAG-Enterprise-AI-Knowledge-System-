"""
Tier 4: Knowledge Ops & Proactive AI Analytics Verification Suite.
Validates:
  1. Cross-Policy Contradiction Radar Engine (contradiction scanning, severity, clause diffs)
  2. Document Freshness, Velocity & Temporal Decay Scorer (decay scores, velocity, risk factors)
  3. Autonomous Policy Gap Drafter (standardized SOP generation, approvals, key rules)
  4. Predictive Knowledge Demand Forecaster (30-day forecast, surge confidence, operational checklists)
  5. Enterprise Knowledge Health Index (composite index, grade, 5 pillars, department scorecards)
  6. Knowledge Ops Admin API Endpoints with Strict RBAC Isolation (401 unauth, 403 non-admin, 200 admin)
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
from app.knowledge_ops.contradiction_radar import run_full_contradiction_radar, scan_contradictions_in_department
from app.knowledge_ops.decay_scorer import calculate_document_decay_scores
from app.knowledge_ops.demand_forecaster import generate_demand_forecast
from app.knowledge_ops.health_index import compute_enterprise_health_index
from app.knowledge_ops.models import PolicyDraftRequest
from app.knowledge_ops.policy_drafter import generate_policy_draft
from app.db.models import RoleEnum

BASE_URL = "http://127.0.0.1:8000"


async def test_contradiction_radar_engine():
    print("\n========================================================")
    print("TEST 1: CROSS-POLICY CONTRADICTION RADAR ENGINE")
    print("========================================================")
    async with AsyncSessionLocal() as session:
        radar = await run_full_contradiction_radar(session)

        print(f"Total Scanned Documents: {radar.total_scanned_documents}")
        print(f"Contradictions Identified: {radar.contradictions_found}")
        print(f"Executive Summary: {radar.summary}")

        assert radar.total_scanned_documents > 0, "No documents were scanned"
        assert isinstance(radar.items, list)

        if radar.items:
            first = radar.items[0]
            print(f"Sample Contradiction ID: {first.id}")
            print(f"  Department: {first.department}")
            print(f"  Doc A: {first.document_a}")
            print(f"  Doc B: {first.document_b}")
            print(f"  Severity: {first.severity}")
            print(f"  Issue: {first.issue[:80]}...")
            print(f"  Resolution: {first.recommended_resolution[:80]}...")

            assert first.document_a
            assert first.document_b
            assert first.severity in ["critical", "high", "medium", "low"]
            assert first.recommended_resolution

    print("✅ Test 1 Passed: Contradiction Radar Engine executed successfully!")


async def test_decay_scorer_engine():
    print("\n========================================================")
    print("TEST 2: FRESHNESS, VELOCITY & TEMPORAL DECAY SCORER")
    print("========================================================")
    async with AsyncSessionLocal() as session:
        decay_items = await calculate_document_decay_scores(session)

        print(f"Total Scored Documents: {len(decay_items)}")
        assert len(decay_items) > 0, "No decay items scored"

        for item in decay_items[:5]:
            print(f"Doc: {item.document_name:<30} | Dept: {item.department:<12} | Score: {item.freshness_score:5.1f} | Label: {item.freshness_label.value:<10} | Velocity: {item.query_velocity}")

        first = decay_items[0]
        assert 0.0 <= first.freshness_score <= 100.0
        assert first.freshness_label in ["Fresh", "Degrading", "Stale", "Critical Revision"]
        assert isinstance(first.staleness_risk_factors, list)
        assert len(first.staleness_risk_factors) > 0

    print("✅ Test 2 Passed: Document Freshness & Decay Scorer calculated scores accurately!")


async def test_policy_drafter_engine():
    print("\n========================================================")
    print("TEST 3: AUTONOMOUS POLICY GAP DRAFTER")
    print("========================================================")
    req = PolicyDraftRequest(
        topic="Remote Work Ergonomics & Hardware Stipend Standard",
        department="hr",
        scope_description="Guidelines for requesting home office equipment, ergonomic assessments, and annual tech stipends.",
        sample_queries=[
            "How do I submit an ergonomics evaluation request?",
            "Can I expense a standing desk?",
            "What is the annual home office stipend amount?",
        ],
    )

    draft = await generate_policy_draft(req)

    print(f"Draft Title:     {draft.title}")
    print(f"Filename:        {draft.filename}")
    print(f"Department:      {draft.department}")
    print(f"Effective Date:  {draft.effective_date}")
    print(f"Estimated Chunks:{draft.estimated_chunks}")
    print(f"Key Rules Count: {len(draft.key_rules)}")
    for i, rule in enumerate(draft.key_rules[:3], 1):
        print(f"   Rule {i}: {rule}")
    print(f"Approvers:       {', '.join(draft.approvers)}")
    print(f"Content Length:  {len(draft.markdown_content)} characters")

    assert "remote" in draft.filename.lower() or "ergonomics" in draft.filename.lower()
    assert draft.department == "hr"
    assert len(draft.key_rules) >= 2
    assert len(draft.approvers) >= 1
    assert "# " in draft.markdown_content
    assert draft.estimated_chunks >= 1

    print("✅ Test 3 Passed: Autonomous Policy Gap Drafter produced valid standard SOP!")


async def test_demand_forecaster_engine():
    print("\n========================================================")
    print("TEST 4: PREDICTIVE KNOWLEDGE DEMAND FORECASTER")
    print("========================================================")
    async with AsyncSessionLocal() as session:
        forecasts = await generate_demand_forecast(session)

        print(f"Generated Proactive Forecasts: {len(forecasts)}")
        assert len(forecasts) >= 3, "Expected forecasts for at least 3 departments"

        depts_seen = set()
        for f in forecasts:
            depts_seen.add(f.department)
            print(f"Timeframe: {f.timeframe:<18} | Dept: {f.department:<12} | Conf: {f.confidence_score:4.1f}% | Surge: +{f.expected_query_increase_pct}%")
            print(f"  Surge Topic: {f.predicted_surge_topic}")
            print(f"  Business Driver: {f.business_driver}")
            print(f"  Checklist Items: {len(f.preparation_checklist)}")
            assert f.confidence_score > 0
            assert f.expected_query_increase_pct > 0
            assert len(f.preparation_checklist) >= 2

        assert "hr" in depts_seen
        assert "finance" in depts_seen
        assert "engineering" in depts_seen

    print("✅ Test 4 Passed: Predictive Demand Forecaster generated multi-department forecasts!")


async def test_health_index_engine():
    print("\n========================================================")
    print("TEST 5: ENTERPRISE KNOWLEDGE HEALTH INDEX")
    print("========================================================")
    async with AsyncSessionLocal() as session:
        health = await compute_enterprise_health_index(session)

        print(f"Overall Health Score: {health.overall_score}/100")
        print(f"Overall Letter Grade: {health.overall_grade}")
        print(f"Verdict:              {health.verdict}")
        print("Pillars Breakdown:")
        for k, v in health.pillars.items():
            print(f"  • {k:<25}: {v:5.1f}%")

        print("Department Scorecards:")
        for dept, card in health.department_scores.items():
            print(f"  [{dept.upper()}] Docs: {card['document_count']} | Freshness: {card['freshness_rating']}% | Health: {card['health_score']}% | Status: {card['status']}")

        print(f"Executive Summary: {health.executive_summary}")
        print(f"Action Items ({len(health.priority_action_items)}):")
        for item in health.priority_action_items:
            print(f"  -> {item}")

        assert 0.0 <= health.overall_score <= 100.0
        assert health.overall_grade in ["A", "B+", "B", "C", "D"]
        assert len(health.pillars) == 5
        assert "hr" in health.department_scores
        assert "engineering" in health.department_scores
        assert "finance" in health.department_scores
        assert len(health.priority_action_items) > 0

    print("✅ Test 5 Passed: Enterprise Knowledge Health Index computed composite scorecard!")


async def test_knowledge_ops_api_rbac():
    print("\n========================================================")
    print("TEST 6: KNOWLEDGE OPS API ROUTES & STRICT RBAC AUDIT")
    print("========================================================")
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=120.0) as client:
        # 1. Unauthenticated Request -> Expect 401
        client.cookies.clear()
        res_unauth = await client.get("/api/v1/admin/knowledge-ops/overview")
        print(f"Unauthenticated overview status: {res_unauth.status_code}")
        assert res_unauth.status_code == 401, f"Expected 401 unauth, got {res_unauth.status_code}"

        # 2. Non-Admin (HR user) -> Expect 403 Forbidden
        login_hr = await client.post(
            "/api/v1/auth/login",
            json={"email": "hr@demo.com", "password": "hr-demo-2026"},
        )
        assert login_hr.status_code == 200, f"HR login failed: {login_hr.text}"
        hr_token = login_hr.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}
        res_forbidden = await client.get("/api/v1/admin/knowledge-ops/overview", headers=hr_headers)
        print(f"HR user overview status: {res_forbidden.status_code}")
        assert res_forbidden.status_code == 403, f"Expected 403 forbidden, got {res_forbidden.status_code}"

        # Clear cookies before admin login
        client.cookies.clear()

        # 3. Admin User -> Full Access
        login_admin = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "admin-demo-2026"},
        )
        assert login_admin.status_code == 200, f"Admin login failed: {login_admin.text}"
        admin_token = login_admin.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # A: Overview Endpoint
        res_overview = await client.get("/api/v1/admin/knowledge-ops/overview", headers=admin_headers)
        print(f"Admin Overview status: {res_overview.status_code}")
        assert res_overview.status_code == 200
        overview_json = res_overview.json()
        assert overview_json["status"] == "success"
        assert "health_index" in overview_json
        assert "contradictions" in overview_json
        assert "decay_ranking" in overview_json
        assert "demand_forecast" in overview_json

        # B: Contradictions Scan Endpoint
        res_scan = await client.post("/api/v1/admin/knowledge-ops/contradictions/scan?department=hr", headers=admin_headers)
        print(f"Admin Contradictions Scan status: {res_scan.status_code}")
        assert res_scan.status_code == 200
        scan_json = res_scan.json()
        assert "total_scanned_documents" in scan_json
        assert "contradictions_found" in scan_json
        assert "items" in scan_json

        # C: Freshness Endpoint
        res_freshness = await client.get("/api/v1/admin/knowledge-ops/freshness", headers=admin_headers)
        print(f"Admin Freshness status: {res_freshness.status_code}")
        assert res_freshness.status_code == 200
        freshness_json = res_freshness.json()
        assert isinstance(freshness_json, list)
        assert len(freshness_json) > 0

        # D: Demand Forecast Endpoint
        res_forecast = await client.get("/api/v1/admin/knowledge-ops/forecast", headers=admin_headers)
        print(f"Admin Demand Forecast status: {res_forecast.status_code}")
        assert res_forecast.status_code == 200
        forecast_json = res_forecast.json()
        assert isinstance(forecast_json, list)
        assert len(forecast_json) >= 3

        # E: Health Index Endpoint
        res_health = await client.get("/api/v1/admin/knowledge-ops/health-index", headers=admin_headers)
        print(f"Admin Health Index status: {res_health.status_code}")
        assert res_health.status_code == 200
        health_json = res_health.json()
        assert "overall_score" in health_json
        assert "overall_grade" in health_json
        assert "pillars" in health_json

        # F: Policy Draft Endpoint
        res_draft = await client.post(
            "/api/v1/admin/knowledge-ops/draft",
            headers=admin_headers,
            json={
                "topic": "Engineering Incident Post-Mortem SOP",
                "department": "engineering",
                "scope_description": "Standard operating procedure for P0/P1 post-mortem analysis and 48-hour executive report delivery.",
                "sample_queries": ["What is the post-mortem timeline for P0 bugs?", "Who must attend the post-mortem review?"],
            },
        )
        print(f"Admin Policy Draft status: {res_draft.status_code}")
        assert res_draft.status_code == 200
        draft_json = res_draft.json()
        assert draft_json["department"] == "engineering"
        assert len(draft_json["key_rules"]) > 0
        assert "# " in draft_json["markdown_content"]

    print("✅ Test 6 Passed: Knowledge Ops Admin API verified with full RBAC isolation!")


async def run_all_tier4_tests():
    print("================================================================================")
    print("NEXUSRAG — TIER 4 KNOWLEDGE OPS & PROACTIVE AI ANALYTICS TEST SUITE")
    print("================================================================================")

    test_results = []
    tests = [
        ("Test 1: Contradiction Radar Engine", test_contradiction_radar_engine),
        ("Test 2: Document Freshness & Decay Scorer", test_decay_scorer_engine),
        ("Test 3: Autonomous Policy Gap Drafter", test_policy_drafter_engine),
        ("Test 4: Predictive Knowledge Demand Forecaster", test_demand_forecaster_engine),
        ("Test 5: Enterprise Knowledge Health Index", test_health_index_engine),
        ("Test 6: Knowledge Ops Admin API & RBAC Audit", test_knowledge_ops_api_rbac),
    ]

    for name, test_fn in tests:
        try:
            await test_fn()
            test_results.append((name, "PASSED", None))
        except Exception as exc:
            import traceback
            traceback.print_exc()
            test_results.append((name, "FAILED", str(exc)))

    print("\n================================================================================")
    print("TIER 4 TEST SUITE SUMMARY")
    print("================================================================================")
    passed = 0
    for name, status, err in test_results:
        mark = "✅" if status == "PASSED" else "❌"
        print(f"{mark} {name:<50} : {status}")
        if err:
            print(f"    Error: {err}")
        if status == "PASSED":
            passed += 1

    total = len(test_results)
    pct = (passed / total) * 100
    print(f"\nFinal Result: {passed}/{total} ({pct:.1f}%) Tests Passed")
    print("================================================================================")

    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_all_tier4_tests())
