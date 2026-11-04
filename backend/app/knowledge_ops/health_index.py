import math
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import RoleEnum
from app.knowledge_ops.contradiction_radar import run_full_contradiction_radar
from app.knowledge_ops.decay_scorer import calculate_document_decay_scores
from app.knowledge_ops.models import (
    ContradictionScanResult,
    DocumentDecayItem,
    EnterpriseHealthIndex,
)
from app.observability.drift_detector import detect_telemetry_drift
from app.observability.eval_scheduler import get_regression_matrix
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def compute_enterprise_health_index(
    db: AsyncSession,
    radar: ContradictionScanResult | None = None,
    decay_items: list[DocumentDecayItem] | None = None,
) -> EnterpriseHealthIndex:
    """
    Computes an authoritative 0-100 composite Enterprise Knowledge Health Index
    evaluating Grounding, RAGAS Quality, User Satisfaction, Freshness, and Contradictions.
    """
    # 1. Telemetry Drift
    drift_data = await detect_telemetry_drift(db)
    grounding_score = float(drift_data.get("grounding", {}).get("recent_pct", 90.0))
    satisfaction_score = float(drift_data.get("sentiment", {}).get("satisfaction_pct", 85.0))

    # 2. RAGAS Quality
    regression_data = await get_regression_matrix(db)
    metric_scores = [m["current_score"] * 100 for m in regression_data.get("metrics", [])]
    ragas_quality_score = sum(metric_scores) / len(metric_scores) if metric_scores else 92.0

    # 3. Policy Freshness
    if decay_items is None:
        decay_items = await calculate_document_decay_scores(db)

    if decay_items:
        freshness_score = sum(d.freshness_score for d in decay_items) / len(decay_items)
    else:
        freshness_score = 90.0

    # 4. Contradiction Freedom
    if radar is None:
        radar = await run_full_contradiction_radar(db)

    contradiction_count = radar.contradictions_found
    # Penalty: 8 points per contradiction, capped at 60 pts max penalty
    contradiction_freedom = max(40.0, 100.0 - (contradiction_count * 8.0))

    # 5. Composite Score Calculation
    # Weights: Grounding (25%), RAGAS (25%), Satisfaction (20%), Freshness (15%), Contradictions (15%)
    overall = (
        0.25 * grounding_score +
        0.25 * ragas_quality_score +
        0.20 * satisfaction_score +
        0.15 * freshness_score +
        0.15 * contradiction_freedom
    )
    overall_score = round(max(0.0, min(100.0, overall)), 1)

    # 6. Assign Grade
    if overall_score >= 90.0:
        grade = "A"
        verdict = "Enterprise Optimal — Gold Standard Governance"
    elif overall_score >= 80.0:
        grade = "B+"
        verdict = "Strong Operational Health — Minor Policy Drift"
    elif overall_score >= 70.0:
        grade = "B"
        verdict = "Adequate — Target Gaps Identified"
    elif overall_score >= 60.0:
        grade = "C"
        verdict = "Attention Required — Active Telemetry Degradation"
    else:
        grade = "D"
        verdict = "Critical Knowledge Revision Needed"

    # 7. Department Breakdown Scorecards
    dept_scores = {}
    for dept_enum in [RoleEnum.hr, RoleEnum.engineering, RoleEnum.finance]:
        dept_docs = [d for d in decay_items if d.department == dept_enum.value]
        dept_fresh = sum(d.freshness_score for d in dept_docs) / len(dept_docs) if dept_docs else 85.0
        dept_scores[dept_enum.value] = {
            "department": dept_enum.value,
            "document_count": len(dept_docs),
            "freshness_rating": round(dept_fresh, 1),
            "health_score": round((0.6 * overall_score) + (0.4 * dept_fresh), 1),
            "status": "Healthy" if dept_fresh >= 75.0 else "Action Required",
        }

    # 8. Executive Summary & Action Items
    summary = (
        f"NexusRAG Knowledge Health Index stands at {overall_score}/100 (Grade {grade}). "
        f"Retrieval grounding is {grounding_score}%, RAGAS evaluation quality is {ragas_quality_score:.1f}%, "
        f"and user satisfaction is {satisfaction_score}%. "
        f"{contradiction_count} clause contradictions are actively tracked."
    )

    action_items = []
    if contradiction_count > 0:
        action_items.append(f"Resolve {contradiction_count} cross-document policy contradictions identified by Radar")
    if freshness_score < 80.0:
        action_items.append("Review decaying policies with negative feedback reports")
    if grounding_score < 90.0:
        action_items.append("Draft new SOPs to cover ungrounded employee inquiries")
    if not action_items:
        action_items.append("Maintain continuous weekly evaluation and quarterly policy recertifications")

    return EnterpriseHealthIndex(
        overall_score=overall_score,
        overall_grade=grade,
        verdict=verdict,
        pillars={
            "grounding_rate": round(grounding_score, 1),
            "ragas_quality": round(ragas_quality_score, 1),
            "user_satisfaction": round(satisfaction_score, 1),
            "policy_freshness": round(freshness_score, 1),
            "contradiction_freedom": round(contradiction_freedom, 1),
        },
        department_scores=dept_scores,
        executive_summary=summary,
        priority_action_items=action_items,
    )
