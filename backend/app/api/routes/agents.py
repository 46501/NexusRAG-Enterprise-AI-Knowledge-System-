import asyncio
import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.agents.compliance_agent import audit_scenario
from app.agents.intelligence_agent import analyze_policy_intelligence
from app.agents.models import (
    AgentPersona,
    AgentRunRequest,
    CollaborativeReport,
    ComplianceReport,
    PolicyIntelligenceReport,
    RiskAssessmentReport,
)
from app.agents.orchestrator import dispatch_agent, run_collaborative_audit
from app.agents.risk_agent import assess_risk
from app.api.dependencies import get_current_user
from app.db.models import Document, RoleEnum, User
from app.db.postgres import AsyncSessionLocal
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/agents", tags=["agents"])


async def _log_agent_run(user_id, user_email, department, persona_name, query_text, latency_ms, top_source) -> None:
    """Audit logs agent execution to PostgreSQL."""
    try:
        from app.db.models import QueryLog
        async with AsyncSessionLocal() as session:
            entry = QueryLog(
                user_id=user_id,
                user_email=user_email,
                department=department,
                query_text=f"[{persona_name.upper()}] {query_text[:900]}",
                sources_count=1,
                top_source=top_source[:255] if top_source else None,
                latency_ms=latency_ms,
            )
            session.add(entry)
            await session.commit()
    except Exception as exc:
        logger.warning("Could not log agent query: %s", exc)


async def _validate_department_and_doc(
    requested_dept: str | None,
    focus_doc: str | None,
    current_user: User,
) -> RoleEnum:
    """Enforces strict department RBAC for agent runs."""
    if requested_dept and current_user.role not in (RoleEnum.admin, RoleEnum.demo_admin):
        if requested_dept.lower() != current_user.role.value.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this department.",
            )

    if focus_doc and current_user.role not in (RoleEnum.admin, RoleEnum.demo_admin):
        async with AsyncSessionLocal() as session:
            q = select(Document).where(Document.name == focus_doc)
            res = await session.execute(q)
            doc = res.scalar_one_or_none()
            if doc and doc.department != current_user.role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to analyze documents outside your department.",
                )

    effective_role = current_user.role
    if requested_dept and current_user.role in (RoleEnum.admin, RoleEnum.demo_admin):
        if requested_dept.lower() in RoleEnum.__members__:
            effective_role = RoleEnum(requested_dept.lower())

    return effective_role


@router.get("")
async def list_available_agents():
    """Lists the available specialized enterprise agent personas and capabilities."""
    return {
        "agents": [
            {
                "id": "auditor",
                "name": "Policy Compliance Auditor",
                "badge": "COMPLIANCE",
                "icon": "ShieldCheck",
                "description": "Cross-examines proposed employee actions and expenditures against corporate policies to output Pass/Warn/Fail verdicts, required approvals, and remediation checklists.",
                "capabilities": ["verdict_classification", "rule_checks", "approval_chain", "remediation_steps"],
            },
            {
                "id": "risk",
                "name": "Legal & Operational Risk Assessor",
                "badge": "RISK",
                "icon": "AlertTriangle",
                "description": "Evaluates contractual liabilities, regulatory exposures, SLA failure points, and conflicting clauses across organizational runbooks and policies.",
                "capabilities": ["risk_matrix", "sla_exposure", "conflict_detection", "preventative_mitigations"],
            },
            {
                "id": "intelligence",
                "name": "Policy Intelligence Assistant",
                "badge": "INTELLIGENCE",
                "icon": "FileText",
                "description": "Extracts executive briefs, role-based obligation matrices, governance gaps, and recommended revisions from corporate documentation.",
                "capabilities": ["executive_brief", "obligation_matrix", "gap_analysis", "policy_revisions"],
            },
            {
                "id": "collaborative",
                "name": "Multi-Agent Executive Council",
                "badge": "COLLABORATION",
                "icon": "Users",
                "description": "Orchestrates concurrent analysis by the Compliance Auditor and Risk Assessor, harmonizing their perspectives into a unanimous leadership governance determination.",
                "capabilities": ["dual_agent_execution", "consensus_synthesis", "cross_examination"],
            },
        ]
    }


@router.post("/audit", response_model=ComplianceReport)
async def run_compliance_audit_endpoint(
    body: AgentRunRequest,
    current_user: User = Depends(get_current_user),
):
    """Executes the Policy Compliance Auditor agent."""
    effective_role = await _validate_department_and_doc(body.department, body.focus_doc, current_user)
    t0 = time.perf_counter()
    report = await audit_scenario(body.scenario, effective_role, focus_doc=body.focus_doc)
    latency = (time.perf_counter() - t0) * 1000

    top_src = report.sources[0].source if report.sources else None
    asyncio.create_task(
        _log_agent_run(current_user.id, current_user.email, effective_role, "auditor", body.scenario, latency, top_src)
    )
    return report


@router.post("/risk", response_model=RiskAssessmentReport)
async def run_risk_assessment_endpoint(
    body: AgentRunRequest,
    current_user: User = Depends(get_current_user),
):
    """Executes the Legal & Operational Risk Assessor agent."""
    effective_role = await _validate_department_and_doc(body.department, body.focus_doc, current_user)
    t0 = time.perf_counter()
    report = await assess_risk(body.scenario, effective_role, focus_doc=body.focus_doc)
    latency = (time.perf_counter() - t0) * 1000

    top_src = report.sources[0].source if report.sources else None
    asyncio.create_task(
        _log_agent_run(current_user.id, current_user.email, effective_role, "risk", body.scenario, latency, top_src)
    )
    return report


@router.post("/intelligence", response_model=PolicyIntelligenceReport)
async def run_policy_intelligence_endpoint(
    body: AgentRunRequest,
    current_user: User = Depends(get_current_user),
):
    """Executes the Policy Intelligence Assistant."""
    effective_role = await _validate_department_and_doc(body.department, body.focus_doc, current_user)
    t0 = time.perf_counter()
    report = await analyze_policy_intelligence(body.scenario, effective_role, focus_doc=body.focus_doc)
    latency = (time.perf_counter() - t0) * 1000

    top_src = report.sources[0].source if report.sources else None
    asyncio.create_task(
        _log_agent_run(current_user.id, current_user.email, effective_role, "intelligence", body.scenario, latency, top_src)
    )
    return report


@router.post("/collaborate", response_model=CollaborativeReport)
async def run_collaboration_endpoint(
    body: AgentRunRequest,
    current_user: User = Depends(get_current_user),
):
    """Executes the Multi-Agent Executive Council collaborative workflow."""
    effective_role = await _validate_department_and_doc(body.department, body.focus_doc, current_user)
    t0 = time.perf_counter()
    report = await run_collaborative_audit(body.scenario, effective_role, focus_doc=body.focus_doc)
    latency = (time.perf_counter() - t0) * 1000

    top_src = report.sources[0].source if report.sources else None
    asyncio.create_task(
        _log_agent_run(current_user.id, current_user.email, effective_role, "collaborate", body.scenario, latency, top_src)
    )
    return report


@router.post("/run")
async def run_agent_dispatcher(
    body: AgentRunRequest,
    current_user: User = Depends(get_current_user),
):
    """Unified dispatcher for all agent personas."""
    effective_role = await _validate_department_and_doc(body.department, body.focus_doc, current_user)
    t0 = time.perf_counter()
    report = await dispatch_agent(body.persona, body.scenario, effective_role, focus_doc=body.focus_doc)
    latency = (time.perf_counter() - t0) * 1000

    top_src = getattr(report, "sources", [None])[0]
    top_src_name = getattr(top_src, "source", None) if top_src else None
    asyncio.create_task(
        _log_agent_run(current_user.id, current_user.email, effective_role, body.persona.value, body.scenario, latency, top_src_name)
    )
    return report

