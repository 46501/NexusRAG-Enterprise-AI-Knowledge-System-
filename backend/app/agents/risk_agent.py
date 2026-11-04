import json
import re

from google.genai import types

from app.agents.models import (
    ClauseCitation,
    ConflictItem,
    RiskAssessmentReport,
    RiskLevel,
    RiskVectorItem,
)
from app.auth.rbac import get_allowed_collections
from app.config import get_settings
from app.db.models import RoleEnum
from app.generation.generator import get_client
from app.retrieval.hybrid import hybrid_search
from app.retrieval.planner import merge_contiguous_chunks
from app.retrieval.reranker import rerank
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

RISK_SYSTEM_PROMPT = """You are an expert Legal and Operational Risk Assessor for enterprise governance.
Your task is to analyze proposed corporate practices, operational workflows, or cross-department scenarios against official policy documents.

Analyze potential regulatory liabilities, contractual SLA breaches, operational failure points, and conflicting clauses across policies.

RISK SEVERITY LEVELS:
- LOW: Standard operational friction; minor procedural ambiguities with negligible financial or legal impact.
- MEDIUM: Modest policy gaps, potential workflow bottlenecks, or moderate compliance oversights requiring monitoring.
- HIGH: Significant exposure to SLA penalties, customer data degradation, major budgetary leakage, or disciplinary vulnerability.
- CRITICAL: Severe contractual breach, regulatory liability, immediate data security violation, or executive escalations.

JSON SCHEMA:
{
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "confidence_score": 92.0,
  "executive_summary": "2-3 sentence executive assessment of primary operational and legal risks citing [1], [2].",
  "risk_vectors": [
    {
      "vector_name": "e.g. SLA Breach Exposure or Financial Leakage",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "description": "Specific risk description citing clauses [1], [2]",
      "impacted_stakeholders": ["Engineering", "Customers", "Executive Team"]
    }
  ],
  "conflicts_or_ambiguities": [
    {
      "conflict_title": "Title of conflict or ambiguity",
      "policy_a": "First policy or clause reference",
      "policy_b": "Second policy or competing requirement",
      "description": "Explanation of why these clauses create friction or confusion"
    }
  ],
  "mitigation_strategies": ["Concrete steps to eliminate or minimize the identified risks"]
}
"""


def _format_risk_markdown(
    risk_level: RiskLevel,
    summary: str,
    vectors: list[RiskVectorItem],
    conflicts: list[ConflictItem],
    mitigations: list[str],
) -> str:
    badge = "🟢 LOW RISK" if risk_level == RiskLevel.low else (
        "🟡 MEDIUM RISK" if risk_level == RiskLevel.medium else (
            "🟠 HIGH RISK" if risk_level == RiskLevel.high else "🔴 CRITICAL RISK"
        )
    )
    lines = [
        f"### ⚖️ Legal & Operational Risk Assessment: **{badge}**\n",
        f"{summary}\n",
    ]
    if vectors:
        lines.append("#### Primary Risk Vectors")
        for v in vectors:
            icon = "🔴" if v.severity in ("HIGH", "CRITICAL") else ("🟡" if v.severity == "MEDIUM" else "🟢")
            lines.append(f"- **{icon} {v.vector_name}** [{v.severity}]: {v.description}")
        lines.append("")

    if conflicts:
        lines.append("#### Identified Policy Tensions & Ambiguities")
        for c in conflicts:
            lines.append(f"- **{c.conflict_title}**: {c.description} *(Conflict between {c.policy_a} and {c.policy_b})*")
        lines.append("")

    if mitigations:
        lines.append("#### Recommended Risk Mitigation Strategies")
        for i, m in enumerate(mitigations, 1):
            lines.append(f"{i}. {m}")
        lines.append("")

    return "\n".join(lines)


async def assess_risk(
    scenario: str,
    role: RoleEnum,
    focus_doc: str | None = None,
    top_k: int = 6,
) -> RiskAssessmentReport:
    """Executes the Legal & Operational Risk Assessor agent against department documents."""
    allowed_roles = get_allowed_collections(role)
    client = get_client()

    logger.info("Risk Assessor agent retrieving chunks for scenario=%r role=%s", scenario[:60], role)
    raw_hits = await hybrid_search(scenario, allowed_roles, top_k=top_k * 3, focus_doc=focus_doc)
    ranked = rerank(scenario, raw_hits, top_k=top_k)
    expanded = merge_contiguous_chunks(ranked)

    citations: list[ClauseCitation] = []
    context_lines = []
    for i, c in enumerate(expanded, 1):
        meta = c.get("metadata", {})
        source_name = meta.get("source", "Unknown Policy")
        sec = meta.get("section", "General")
        dept = meta.get("role_access", role.value)
        text = c.get("text", "").strip()

        citations.append(
            ClauseCitation(
                index=i,
                source=source_name,
                section=sec,
                snippet=text[:250] + ("..." if len(text) > 250 else ""),
                department=dept,
            )
        )
        context_lines.append(f"[{i}] (Document: {source_name} | Department: {dept} | Section: {sec})\n{text}")

    context_str = "\n\n".join(context_lines)

    prompt = (
        f"Grounded Corporate Policy Documents:\n"
        f"{context_str}\n\n"
        f"Workflow / Scenario to Assess for Risk:\n"
        f"\"{scenario}\"\n\n"
        f"Evaluate all operational, contractual, and compliance risk vectors and output the JSON report."
    )

    config = types.GenerateContentConfig(
        system_instruction=RISK_SYSTEM_PROMPT,
        temperature=0.1,
        max_output_tokens=3072,
        response_mime_type="application/json",
    )

    models_to_try = [_s.gemini_model, "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"]

    last_exc = None
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

            level_str = str(data.get("risk_level", "LOW")).upper()
            if level_str not in RiskLevel._value2member_map_:
                level_str = "LOW"

            risk_level = RiskLevel(level_str)
            summary = data.get("executive_summary", "Risk assessment completed.")

            vectors = [
                RiskVectorItem(
                    vector_name=v.get("vector_name", "Operational Risk"),
                    severity=str(v.get("severity", "LOW")).upper(),
                    description=v.get("description", ""),
                    impacted_stakeholders=v.get("impacted_stakeholders", []),
                )
                for v in data.get("risk_vectors", [])
            ]

            conflicts = [
                ConflictItem(
                    conflict_title=c.get("conflict_title", "Policy Friction"),
                    policy_a=c.get("policy_a", "Standard Procedure"),
                    policy_b=c.get("policy_b", "Secondary Guideline"),
                    description=c.get("description", ""),
                )
                for c in data.get("conflicts_or_ambiguities", [])
            ]

            mitigations = data.get("mitigation_strategies", [])
            raw_md = _format_risk_markdown(risk_level, summary, vectors, conflicts, mitigations)

            report = RiskAssessmentReport(
                risk_level=risk_level,
                confidence_score=float(data.get("confidence_score", 92.0)),
                executive_summary=summary,
                risk_vectors=vectors,
                conflicts_or_ambiguities=conflicts,
                mitigation_strategies=mitigations,
                sources=citations,
                raw_markdown=raw_md,
            )
            logger.info("Risk assessment completed with level=%s vectors=%d", report.risk_level, len(report.risk_vectors))
            return report

        except Exception as exc:
            logger.warning("Risk assessor model %s failed: %s", model_name, exc)
            last_exc = exc
            continue

    logger.error("All risk assessor models failed, returning fallback: %s", last_exc)
    fallback_level = RiskLevel.low
    fallback_summary = "The risk evaluation could not complete due to an upstream service interruption."
    return RiskAssessmentReport(
        risk_level=fallback_level,
        confidence_score=70.0,
        executive_summary=fallback_summary,
        risk_vectors=[],
        conflicts_or_ambiguities=[],
        mitigation_strategies=["Review applicable policy guidelines with your department lead."],
        sources=citations,
        raw_markdown=_format_risk_markdown(fallback_level, fallback_summary, [], [], []),
    )
