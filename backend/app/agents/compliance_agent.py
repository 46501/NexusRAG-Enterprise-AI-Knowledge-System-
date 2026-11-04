import json
import re

from google.genai import types

from app.agents.models import (
    ClauseCitation,
    ComplianceReport,
    ComplianceVerdict,
    RuleCheckItem,
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

AUDITOR_SYSTEM_PROMPT = """You are an elite Enterprise Policy Compliance Auditor.
Your responsibility is to strictly audit an employee scenario, question, or proposed corporate action against official corporate policy documents.

Examine all relevant policy clauses and provide an audit assessment in strict JSON format.

AUDIT CRITERIA:
- COMPLIANT: The action is fully authorized by explicitly stated policies with no unfulfilled conditions.
- CONDITIONAL: The action is permitted ONLY IF specific conditions, pre-approvals, thresholds, or forms are satisfied.
- VIOLATION: The action directly breaches documented rules, expense limits, safety standards, or SLAs.
- INDETERMINATE: The provided documents do not contain enough relevant guidelines or mention the subject matter.

JSON SCHEMA:
{
  "verdict": "COMPLIANT" | "CONDITIONAL" | "VIOLATION" | "INDETERMINATE",
  "confidence_score": 95.0,
  "executive_summary": "Concise 2-3 sentence executive audit determination with clause citations like [1], [2].",
  "rules_checked": [
    {
      "rule": "Policy title or rule topic",
      "status": "PASS" | "WARN" | "FAIL",
      "finding": "Specific factual finding citing [1], [2]",
      "clauses": ["Cited clause excerpt or reference"]
    }
  ],
  "required_approvals": ["List of mandatory approvers or sign-offs"],
  "remediation_steps": ["Step-by-step actions required to achieve full compliance"]
}
"""


def _format_compliance_markdown(
    verdict: ComplianceVerdict,
    summary: str,
    rules: list[RuleCheckItem],
    approvals: list[str],
    remediation: list[str],
) -> str:
    badge = "🟢 COMPLIANT" if verdict == ComplianceVerdict.compliant else (
        "🟡 CONDITIONAL" if verdict == ComplianceVerdict.conditional else (
            "🔴 VIOLATION" if verdict == ComplianceVerdict.violation else "⚪ INDETERMINATE"
        )
    )
    lines = [
        f"### 🏛️ Policy Compliance Audit: **{badge}**\n",
        f"{summary}\n",
    ]
    if rules:
        lines.append("#### Evaluated Rule Checks")
        for r in rules:
            icon = "✅" if r.status == "PASS" else ("⚠️" if r.status == "WARN" else "❌")
            lines.append(f"- **{icon} {r.rule}** ({r.status}): {r.finding}")
        lines.append("")

    if approvals:
        lines.append("#### Required Approvals")
        for a in approvals:
            lines.append(f"- {a}")
        lines.append("")

    if remediation:
        lines.append("#### Recommended Remediation Steps")
        for i, step in enumerate(remediation, 1):
            lines.append(f"{i}. {step}")
        lines.append("")

    return "\n".join(lines)


async def audit_scenario(
    scenario: str,
    role: RoleEnum,
    focus_doc: str | None = None,
    top_k: int = 6,
) -> ComplianceReport:
    """Executes the Policy Compliance Auditor agent against department documents."""
    allowed_roles = get_allowed_collections(role)
    client = get_client()

    logger.info("Auditor agent retrieving chunks for scenario=%r role=%s", scenario[:60], role)
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
        f"Employee Action / Scenario to Audit:\n"
        f"\"{scenario}\"\n\n"
        f"Perform the compliance audit and output the JSON report."
    )

    config = types.GenerateContentConfig(
        system_instruction=AUDITOR_SYSTEM_PROMPT,
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

            verdict_str = str(data.get("verdict", "INDETERMINATE")).upper()
            if verdict_str not in ComplianceVerdict._value2member_map_:
                verdict_str = "INDETERMINATE"

            verdict = ComplianceVerdict(verdict_str)
            summary = data.get("executive_summary", "Audit completed.")
            rules = [
                RuleCheckItem(
                    rule=r.get("rule", "Policy Standard"),
                    status=str(r.get("status", "WARN")).upper(),
                    finding=r.get("finding", ""),
                    clauses=r.get("clauses", []),
                )
                for r in data.get("rules_checked", [])
            ]
            approvals = data.get("required_approvals", [])
            remediation = data.get("remediation_steps", [])

            raw_md = _format_compliance_markdown(verdict, summary, rules, approvals, remediation)

            report = ComplianceReport(
                verdict=verdict,
                confidence_score=float(data.get("confidence_score", 95.0)),
                executive_summary=summary,
                rules_checked=rules,
                required_approvals=approvals,
                remediation_steps=remediation,
                sources=citations,
                raw_markdown=raw_md,
            )
            logger.info("Compliance audit completed with verdict=%s rules=%d", report.verdict, len(report.rules_checked))
            return report

        except Exception as exc:
            logger.warning("Auditor model %s failed: %s", model_name, exc)
            last_exc = exc
            continue

    logger.error("All auditor models failed, returning fallback: %s", last_exc)
    fallback_verdict = ComplianceVerdict.indeterminate
    fallback_summary = "The compliance audit could not be concluded due to an upstream service interruption."
    return ComplianceReport(
        verdict=fallback_verdict,
        confidence_score=75.0,
        executive_summary=fallback_summary,
        rules_checked=[],
        required_approvals=[],
        remediation_steps=["Please review the relevant department documents directly."],
        sources=citations,
        raw_markdown=_format_compliance_markdown(fallback_verdict, fallback_summary, [], [], []),
    )
