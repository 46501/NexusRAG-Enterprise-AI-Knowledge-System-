import asyncio
import io
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Ensure UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from app.agents import (
    AgentPersona,
    analyze_policy_intelligence,
    assess_risk,
    audit_scenario,
    run_collaborative_audit,
)
from app.db.models import RoleEnum
from app.generation.generator import load_generator
from app.retrieval.dense import load_dense_client
from app.retrieval.embedder import load_embedder
from app.retrieval.reranker import load_reranker
from app.retrieval.sparse import load_sparse_index
from app.state import init_semaphore


async def test_compliance_auditor():
    print("\n========================================================")
    print("TEST 1: POLICY COMPLIANCE AUDITOR AGENT")
    print("========================================================")

    scenario = "An employee wants to take 25 consecutive days of bereavement leave with no prior manager notice."
    report = await audit_scenario(scenario, RoleEnum.hr, top_k=4)

    print("Auditor Verdict:", report.verdict)
    print("Confidence Score:", report.confidence_score)
    print("Executive Summary:", report.executive_summary[:160], "...")
    print("Rules Checked:", [f"{r.rule}: {r.status}" for r in report.rules_checked])
    print("Required Approvals:", report.required_approvals)
    print("Sources Cited:", [s.source for s in report.sources])

    assert report.verdict in ("VIOLATION", "CONDITIONAL"), f"Unexpected verdict: {report.verdict}"
    assert len(report.sources) > 0, "No sources cited by Auditor"
    assert all(s.department == "hr" for s in report.sources), "Cross-department leak in auditor sources"
    print("✅ Test 1 Passed: Compliance Auditor correctly flagged policy breach with cited clauses!")


async def test_risk_assessor():
    print("\n========================================================")
    print("TEST 2: LEGAL & OPERATIONAL RISK ASSESSOR AGENT")
    print("========================================================")

    scenario = (
        "During a P0 outage, skipping customer communication on the status page to focus exclusively on debugging "
        "and bypassing the on-call manager escalation."
    )
    report = await assess_risk(scenario, RoleEnum.engineering, top_k=4)

    print("Risk Level:", report.risk_level)
    print("Confidence Score:", report.confidence_score)
    print("Executive Summary:", report.executive_summary[:160], "...")
    print("Risk Vectors:", [f"{v.vector_name} ({v.severity})" for v in report.risk_vectors])
    print("Mitigations Count:", len(report.mitigation_strategies))
    print("Sources Cited:", [s.source for s in report.sources])

    assert report.risk_level in ("HIGH", "CRITICAL"), f"Expected HIGH or CRITICAL risk, got {report.risk_level}"
    assert len(report.sources) > 0, "No sources cited by Risk Assessor"
    assert all(s.department == "engineering" for s in report.sources), "Cross-department leak in risk sources"
    print("✅ Test 2 Passed: Risk Assessor identified operational and SLA failure vectors!")


async def test_policy_intelligence():
    print("\n========================================================")
    print("TEST 3: AUTOMATED POLICY INTELLIGENCE ASSISTANT")
    print("========================================================")

    topic = "incident_response.txt"
    report = await analyze_policy_intelligence(topic, RoleEnum.engineering, focus_doc="incident_response.txt", top_k=4)

    print("Document Title:", report.document_title)
    print("Confidence Score:", report.confidence_score)
    print("Takeaways Count:", len(report.executive_takeaways))
    if report.executive_takeaways:
        print("Sample Takeaway:", report.executive_takeaways[0][:120], "...")
    print("Enforcement Matrix Items:", len(report.enforcement_matrix))
    print("Sources Cited:", [s.source for s in report.sources])

    assert len(report.sources) > 0, "No sources cited by Intelligence Agent"
    assert len(report.executive_takeaways) > 0, "Missing executive takeaways"
    print("✅ Test 3 Passed: Policy Intelligence generated executive brief and enforcement matrix!")


async def test_multi_agent_collaboration():
    print("\n========================================================")
    print("TEST 4: MULTI-AGENT COLLABORATIVE COUNCIL")
    print("========================================================")

    scenario = (
        "An engineer plans to deploy a database migration to production during peak trading hours on a Friday without a rollback plan."
    )
    collab = await run_collaborative_audit(scenario, RoleEnum.engineering)

    print("Collaborative Synthesis Excerpt:", collab.collaborative_synthesis[:180], "...")
    print("Unanimous Recommendations:", collab.unanimous_recommendations)
    print("Combined Sources Count:", len(collab.sources))
    print("Auditor Verdict Sub-Report:", collab.auditor_report.verdict)
    print("Risk Level Sub-Report:", collab.risk_report.risk_level)

    assert collab.collaborative_synthesis, "Missing collaborative synthesis"
    assert len(collab.unanimous_recommendations) > 0, "Missing unanimous recommendations"
    assert len(collab.sources) > 0, "Missing collaborative sources"
    assert all(s.department == "engineering" for s in collab.sources), "Cross-department leak in collaboration"
    print("✅ Test 4 Passed: Multi-Agent Council harmonized compliance rules and risk mitigations!")


async def main():
    init_semaphore()
    load_embedder()
    load_reranker()
    load_dense_client()
    load_sparse_index()
    load_generator()

    await test_compliance_auditor()
    await test_risk_assessor()
    await test_policy_intelligence()
    await test_multi_agent_collaboration()

    print("\n" + "=" * 60)
    print("🎉 ALL TIER 2 MULTI-AGENT TESTS PASSED SUCCESSFULLY! (4/4)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

