import json
import uuid
from datetime import datetime, timezone
from google import genai
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import RoleEnum, User
from app.knowledge_ops.models import PolicyDraftRequest, PolicyDraftResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
]


def _get_gemini_client() -> genai.Client:
    return genai.Client(api_key=_s.gemini_api_key)


async def generate_policy_draft(request: PolicyDraftRequest) -> PolicyDraftResponse:
    """
    Autonomously generates an enterprise-grade standard operating policy manual
    to close identified documentation knowledge gaps.
    """
    now_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    clean_slug = "".join([c if c.isalnum() else "_" for c in request.topic.lower()]).strip("_")
    filename = f"{clean_slug}_policy.txt"

    prompt = f"""You are a Principal Corporate Governance Architect and Policy Drafter for Apex Systems.
You need to draft a comprehensive, official corporate policy document to close an identified knowledge gap.

Department: {request.department.upper()}
Policy Topic: {request.topic}
Scope / Context: {request.scope_description or 'Standard organizational governance'}
Sample Unanswered Inquiries from Employees:
{json.dumps(request.sample_queries, indent=2)}

Draft a complete, authoritative, and structured policy document with the following mandatory sections:
1. Title and Document Header (Organization: Apex Systems, Effective Date: {now_str}, Version: 1.0)
2. Section 1: Purpose and Business Objective
3. Section 2: Scope and Applicability (which employee roles, contractors, and departments this governs)
4. Section 3: Core Governance Rules, Allowances, and Numerical Thresholds (explicit numbers, caps, SLAs, or limits)
5. Section 4: Approval Matrix and Escalation Workflow (explicit roles required for approval, e.g., Manager, VP, Director, CFO/HRBP)
6. Section 5: Incident Escalation, Exceptions, and Compliance Penalties

Return ONLY a JSON object in this exact schema:
{{
  "title": "<official document title, e.g., Apex Systems Cryptocurrency and Digital Asset Policy>",
  "key_rules": [
    "<rule 1 with explicit limit/condition>",
    "<rule 2 with explicit limit/condition>",
    "<rule 3 with explicit limit/condition>"
  ],
  "approvers": [
    "<role title 1, e.g., People Operations Lead>",
    "<role title 2, e.g., Vice President of Finance>"
  ],
  "full_markdown_text": "<complete text of the policy with all 6 sections formatted in clean markdown>"
}}
"""

    client = _get_gemini_client()
    for model_name in FALLBACK_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                    max_output_tokens=3072,
                ),
            )
            parsed = json.loads(response.text or "{}")

            title = parsed.get("title", f"Apex Systems {request.topic.title()} Policy")
            rules = parsed.get("key_rules", [
                "Mandatory pre-approval required prior to transaction or operational commitment",
                "Explicit record keeping and audit trail retention for 7 years",
                "Strict adherence to security and compliance controls"
            ])
            approvers = parsed.get("approvers", ["Department Manager", "Executive Lead"])
            content = parsed.get("full_markdown_text", "")

            if not content:
                content = f"""# {title}
**Organization:** Apex Systems  
**Department:** {request.department.capitalize()}  
**Effective Date:** {now_str}  
**Version:** 1.0  

## 1. Purpose and Objective
This document formalizes Apex Systems' operating standards regarding {request.topic.lower()}.

## 2. Scope & Applicability
This policy applies to all full-time employees, contractors, and operating units in the {request.department.capitalize()} department.

## 3. Core Policy Rules & Thresholds
1. All requests relating to {request.topic.lower()} must be submitted through official ticketing channels.
2. Standard turnaround SLA for requests is 5 business days.
3. Transactions exceeding $1,000 require written authorization from the department head.

## 4. Approval Matrix
- Tier 1 (< $1,000): Direct Manager Approval
- Tier 2 ($1,000 - $10,000): Department Director Approval
- Tier 3 (> $10,000): VP and Finance Sign-off

## 5. Compliance & Audit
Failure to comply with these guidelines may result in operational escalation or disciplinary review.
"""

            estimated_chunks = max(1, len(content) // 400)

            return PolicyDraftResponse(
                title=title,
                filename=filename,
                department=request.department,
                effective_date=now_str,
                markdown_content=content,
                estimated_chunks=estimated_chunks,
                key_rules=rules,
                approvers=approvers,
            )
        except Exception as exc:
            logger.warning("Policy drafter failed on model %s: %s", model_name, exc)

    # Fallback response
    return PolicyDraftResponse(
        title=f"Apex Systems {request.topic.title()} Governance Standard",
        filename=filename,
        department=request.department,
        effective_date=now_str,
        markdown_content=f"# Apex Systems {request.topic.title()} Policy\n\nEffective Date: {now_str}\n\n## 1. Policy Overview\nFormalized operating guideline for {request.topic}.",
        estimated_chunks=3,
        key_rules=["Mandatory pre-authorization", "Documented verification"],
        approvers=["Department Director", "Compliance Officer"],
    )


async def publish_draft_to_knowledge_base(
    db: AsyncSession,
    filename: str,
    department: RoleEnum,
    content: str,
    uploader: User | None = None,
) -> dict:
    """
    Publishes an approved policy draft directly into PostgreSQL Document table
    and Qdrant vector index, immediately making it retrievable.
    """
    import tempfile
    from pathlib import Path
    from app.services.ingestion_service import ingest_upload

    # Write content to temporary file
    suffix = ".txt" if not filename.endswith((".txt", ".md")) else ""
    safe_name = f"{filename}{suffix}"

    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        uploader_id_str = str(uploader.id) if uploader else "00000000-0000-0000-0000-000000000000"
        doc_id, chunk_count = await ingest_upload(
            file_path=tmp_path,
            role_access=department.value,
            uploader_id=uploader_id_str,
            original_filename=safe_name,
        )
        logger.info("Published policy draft '%s' to %s department: doc_id=%s chunks=%d", safe_name, department.value, doc_id, chunk_count)
        return {
            "document_id": doc_id,
            "filename": safe_name,
            "department": department.value,
            "chunk_count": chunk_count,
            "status": "published",
        }
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass
