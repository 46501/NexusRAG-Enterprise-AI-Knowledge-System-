"""
Tier 4: Knowledge Ops & Proactive AI Analytics.
Includes Cross-Policy Contradiction Radar, Document Decay Scorer,
Autonomous Policy Drafter, Predictive Demand Forecaster, and Enterprise Health Index.
"""

from app.knowledge_ops.contradiction_radar import (
    run_full_contradiction_radar,
    scan_contradictions_in_department,
)
from app.knowledge_ops.decay_scorer import calculate_document_decay_scores
from app.knowledge_ops.demand_forecaster import generate_demand_forecast
from app.knowledge_ops.health_index import compute_enterprise_health_index
from app.knowledge_ops.models import (
    ContradictionItem,
    ContradictionScanResult,
    ContradictionSeverity,
    DemandForecastItem,
    DocumentDecayItem,
    EnterpriseHealthIndex,
    FreshnessLevel,
    PolicyDraftRequest,
    PolicyDraftResponse,
    PublishDraftRequest,
)
from app.knowledge_ops.policy_drafter import (
    generate_policy_draft,
    publish_draft_to_knowledge_base,
)

__all__ = [
    "run_full_contradiction_radar",
    "scan_contradictions_in_department",
    "calculate_document_decay_scores",
    "generate_demand_forecast",
    "compute_enterprise_health_index",
    "generate_policy_draft",
    "publish_draft_to_knowledge_base",
    "ContradictionItem",
    "ContradictionScanResult",
    "ContradictionSeverity",
    "DocumentDecayItem",
    "FreshnessLevel",
    "PolicyDraftRequest",
    "PolicyDraftResponse",
    "PublishDraftRequest",
    "DemandForecastItem",
    "EnterpriseHealthIndex",
]

