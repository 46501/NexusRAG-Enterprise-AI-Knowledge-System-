import json
import re

from google.genai import types

from app.agents.models import (
    ClauseCitation,
    PolicyIntelligenceReport,
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

INTELLIGENCE_SYSTEM_PROMPT = """You are an Automated Policy Intelligence and Governance Assistant.
Your task is to analyze enterprise documents to construct an executive summary, extract operational obligations, detect policy gaps, and suggest governance improvements.

JSON SCHEMA:
{
  "document_title": "Title of analyzed policy or domain",
  "confidence_score": 94.0,
  "executive_takeaways": [
    "Key high-level takeaway 1",
    "Key high-level takeaway 2",
    "Key high-level takeaway 3"
  ],
  "enforcement_matrix": [
    {
      "role": "e.g. Employee, Manager, Incident Commander",
      "obligation": "Mandatory duty or responsibility",
      "threshold_or_timeline": "e.g. within 5 minutes, up to $500/year"
    }
  ],
  "policy_gaps": [
    "Identified ambiguity, outdated clause, or missing contingency"
  ],
  "recommended_revisions": [
    "Specific governance or wording improvement recommendation"
  ]
}
"""


def _format_intelligence_markdown(
    title: str,
    takeaways: list[str],
    matrix: list[dict],
    gaps: list[str],
    revisions: list[str],
) -> str:
    lines = [
        f"### ⚡ Policy Intelligence & Governance Brief: **{title}**\n",
    ]
    if takeaways:
        lines.append("#### Executive Takeaways")
        for t in takeaways:
            lines.append(f"- {t}")
        lines.append("")

    if matrix:
        lines.append("#### Key Obligations Matrix\n")
        lines.append("| Role / Stakeholder | Obligation / Mandate | Limit / Timeline |")
        lines.append("|---|---|---|")
        for m in matrix:
            role = m.get("role", "General")
            ob = m.get("obligation", "")
            lim = m.get("threshold_or_timeline", "Standard")
            lines.append(f"| {role} | {ob} | {lim} |")
        lines.append("")

    if gaps:
        lines.append("#### Identified Governance Gaps & Unaddressed Ambiguities")
        for g in gaps:
            lines.append(f"- ⚠️ {g}")
        lines.append("")

    if revisions:
        lines.append("#### Recommended Policy Revisions")
        for r in revisions:
            lines.append(f"- 💡 {r}")
        lines.append("")

    return "\n".join(lines)


async def analyze_policy_intelligence(
    topic_or_doc: str,
    role: RoleEnum,
    focus_doc: str | None = None,
    top_k: int = 8,
) -> PolicyIntelligenceReport:
    """Executes the Policy Intelligence Assistant to extract structured insights and detect gaps."""
    allowed_roles = get_allowed_collections(role)
    client = get_client()

    effective_focus = focus_doc or (topic_or_doc if topic_or_doc.endswith((".txt", ".md", ".pdf")) else None)
    search_query = f"{topic_or_doc} policy overview rules obligations"

    logger.info("Intelligence agent retrieving chunks for topic=%r focus_doc=%s", topic_or_doc[:50], effective_focus)
    raw_hits = await hybrid_search(search_query, allowed_roles, top_k=top_k * 3, focus_doc=effective_focus)
    ranked = rerank(search_query, raw_hits, top_k=top_k)
    expanded = merge_contiguous_chunks(ranked)

    citations: list[ClauseCitation] = []
    context_lines = []
    doc_title = effective_focus or topic_or_doc

    for i, c in enumerate(expanded, 1):
        meta = c.get("metadata", {})
        source_name = meta.get("source", doc_title)
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
        f"Document / Topic to Analyze:\n"
        f"\"{topic_or_doc}\"\n\n"
        f"Synthesize the policy intelligence brief, obligations enforcement matrix, and gap analysis."
    )

    config = types.GenerateContentConfig(
        system_instruction=INTELLIGENCE_SYSTEM_PROMPT,
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

            title = data.get("document_title", doc_title)
            takeaways = data.get("executive_takeaways", [])
            matrix = data.get("enforcement_matrix", [])
            gaps = data.get("policy_gaps", [])
            revisions = data.get("recommended_revisions", [])

            raw_md = _format_intelligence_markdown(title, takeaways, matrix, gaps, revisions)

            report = PolicyIntelligenceReport(
                document_title=title,
                confidence_score=float(data.get("confidence_score", 94.0)),
                executive_takeaways=takeaways,
                enforcement_matrix=matrix,
                policy_gaps=gaps,
                recommended_revisions=revisions,
                sources=citations,
                raw_markdown=raw_md,
            )
            logger.info("Policy intelligence analysis completed for doc=%s", report.document_title)
            return report

        except Exception as exc:
            logger.warning("Intelligence model %s failed: %s", model_name, exc)
            last_exc = exc
            continue

    logger.error("All intelligence models failed, returning fallback: %s", last_exc)
    fallback_takeaways = ["Unable to generate policy brief due to an upstream service interruption."]
    return PolicyIntelligenceReport(
        document_title=doc_title,
        confidence_score=70.0,
        executive_takeaways=fallback_takeaways,
        enforcement_matrix=[],
        policy_gaps=[],
        recommended_revisions=[],
        sources=citations,
        raw_markdown=_format_intelligence_markdown(doc_title, fallback_takeaways, [], [], []),
    )
