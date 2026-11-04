import asyncio
import json
import re

from google.genai import types

from app.agents.compliance_agent import audit_scenario
from app.agents.intelligence_agent import analyze_policy_intelligence
from app.agents.models import (
    AgentPersona,
    CollaborativeReport,
    ComplianceReport,
    PolicyIntelligenceReport,
    RiskAssessmentReport,
)
from app.agents.risk_agent import assess_risk
from app.config import get_settings
from app.db.models import RoleEnum
from app.generation.generator import get_client
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

COLLABORATIVE_SYNTHESIS_PROMPT = """You are the Lead Executive Governance Council synthesising insights from two specialized AI agents:
1. The Policy Compliance Auditor (evaluates rule conformity, approval criteria, and violations)
2. The Legal & Operational Risk Assessor (evaluates contractual liabilities, SLA risks, and operational bottlenecks)

Your goal is to harmonize their separate findings into a cohesive, authoritative Executive Governance Determination for leadership.

OUTPUT FORMAT REQUIREMENTS:
Output strictly a valid JSON object matching this schema without markdown code blocks:
{
  "collaborative_synthesis": "Comprehensive executive synthesis balancing compliance rules with real-world operational and risk realities.",
  "unanimous_recommendations": [
    "Consensus action item 1",
    "Consensus action item 2",
    "Consensus action item 3"
  ],
  "confidence_score": 96.0
}
"""


async def run_collaborative_audit(
    scenario: str,
    role: RoleEnum,
    focus_doc: str | None = None,
) -> CollaborativeReport:
    """Runs a multi-agent collaborative workflow where Compliance Auditor and Risk Assessor

    jointly cross-examine an enterprise scenario, followed by an executive synthesis.
    """
    logger.info("Initiating Multi-Agent Collaboration for scenario=%r role=%s", scenario[:60], role)

    # 1. Execute Auditor and Risk Assessor in parallel
    auditor_task = audit_scenario(scenario, role, focus_doc=focus_doc, top_k=5)
    risk_task = assess_risk(scenario, role, focus_doc=focus_doc, top_k=5)

    auditor_report, risk_report = await asyncio.gather(auditor_task, risk_task)

    # 2. Merge and deduplicate citations
    seen_keys = set()
    combined_sources = []
    for s in auditor_report.sources + risk_report.sources:
        k = (s.source, s.section, s.snippet[:50])
        if k not in seen_keys:
            seen_keys.add(k)
            combined_sources.append(s)

    # 3. Executive Council Synthesis
    client = get_client()
    prompt = (
        f"Employee Scenario Evaluated:\n"
        f"\"{scenario}\"\n\n"
        f"Auditor Findings:\n"
        f"- Verdict: {auditor_report.verdict}\n"
        f"- Executive Summary: {auditor_report.executive_summary}\n"
        f"- Required Approvals: {', '.join(auditor_report.required_approvals) or 'None'}\n"
        f"- Remediation: {', '.join(auditor_report.remediation_steps) or 'None'}\n\n"
        f"Risk Assessor Findings:\n"
        f"- Risk Level: {risk_report.risk_level}\n"
        f"- Executive Summary: {risk_report.executive_summary}\n"
        f"- Risk Vectors: {', '.join(v.vector_name for v in risk_report.risk_vectors) or 'None'}\n"
        f"- Mitigations: {', '.join(risk_report.mitigation_strategies) or 'None'}\n\n"
        f"Synthesize this into a balanced Executive Governance Council determination."
    )

    config = types.GenerateContentConfig(
        system_instruction=COLLABORATIVE_SYNTHESIS_PROMPT,
        temperature=0.1,
        max_output_tokens=2048,
        response_mime_type="application/json",
    )

    models_to_try = [_s.gemini_model, "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"]

    synthesis_text = (
        f"The Compliance Auditor determined {auditor_report.verdict.value} while the Risk Assessor identified "
        f"{risk_report.risk_level.value} risk. Leadership recommends reviewing required approvals and implementing "
        f"risk mitigations prior to proceeding."
    )
    recommendations = auditor_report.remediation_steps[:2] + risk_report.mitigation_strategies[:2]
    conf_score = round((auditor_report.confidence_score + risk_report.confidence_score) / 2, 1)

    for model_name in models_to_try:
        try:
            res = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            raw_text = (res.text or "").strip()
            if "```" in raw_text:
                raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
                raw_text = re.sub(r"\s*```$", "", raw_text)
            raw_text = raw_text.strip()

            data = json.loads(raw_text)
            synthesis_text = data.get("collaborative_synthesis", synthesis_text)
            recs = data.get("unanimous_recommendations", [])
            if recs:
                recommendations = recs
            conf_score = float(data.get("confidence_score", conf_score))
            break
        except Exception as exc:
            logger.warning("Executive synthesis model %s failed: %s", model_name, exc)
            continue

    report = CollaborativeReport(
        scenario=scenario,
        auditor_report=auditor_report,
        risk_report=risk_report,
        collaborative_synthesis=synthesis_text,
        unanimous_recommendations=recommendations,
        confidence_score=conf_score,
        sources=combined_sources,
    )
    logger.info("Multi-agent collaborative evaluation complete for scenario=%r", scenario[:60])
    return report


async def dispatch_agent(
    persona: AgentPersona,
    scenario: str,
    role: RoleEnum,
    focus_doc: str | None = None,
) -> ComplianceReport | RiskAssessmentReport | PolicyIntelligenceReport | CollaborativeReport:
    """Dispatches the task to the requested agent persona or initiates collaborative workflow."""
    if persona == AgentPersona.auditor:
        return await audit_scenario(scenario, role, focus_doc=focus_doc)
    elif persona == AgentPersona.risk:
        return await assess_risk(scenario, role, focus_doc=focus_doc)
    elif persona == AgentPersona.intelligence:
        return await analyze_policy_intelligence(scenario, role, focus_doc=focus_doc)
    elif persona == AgentPersona.collaborative:
        return await run_collaborative_audit(scenario, role, focus_doc=focus_doc)
    else:
        # Default to auditor
        return await audit_scenario(scenario, role, focus_doc=focus_doc)

