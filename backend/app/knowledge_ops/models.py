from enum import Enum
from pydantic import BaseModel, Field


class ContradictionSeverity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class ContradictionItem(BaseModel):
    id: str
    department: str
    document_a: str
    clause_a: str
    document_b: str
    clause_b: str
    severity: ContradictionSeverity
    issue: str
    recommended_resolution: str


class ContradictionScanResult(BaseModel):
    total_scanned_documents: int
    contradictions_found: int
    items: list[ContradictionItem]
    summary: str


class FreshnessLevel(str, Enum):
    fresh = "Fresh"
    degrading = "Degrading"
    stale = "Stale"
    critical_revision = "Critical Revision"


class DocumentDecayItem(BaseModel):
    document_name: str
    department: str
    chunk_count: int
    uploaded_at: str
    query_velocity: int
    negative_feedback_count: int
    freshness_score: float
    freshness_label: FreshnessLevel
    staleness_risk_factors: list[str]


class PolicyDraftRequest(BaseModel):
    topic: str
    department: str
    scope_description: str | None = None
    sample_queries: list[str] = Field(default_factory=list)


class PolicyDraftResponse(BaseModel):
    title: str
    filename: str
    department: str
    effective_date: str
    markdown_content: str
    estimated_chunks: int
    key_rules: list[str]
    approvers: list[str]


class PublishDraftRequest(BaseModel):
    filename: str
    department: str
    content: str


class DemandForecastItem(BaseModel):
    timeframe: str
    department: str
    predicted_surge_topic: str
    confidence_score: float
    expected_query_increase_pct: int
    business_driver: str
    preparation_checklist: list[str]


class EnterpriseHealthIndex(BaseModel):
    overall_score: float
    overall_grade: str
    verdict: str
    pillars: dict[str, float]
    department_scores: dict[str, dict]
    executive_summary: str
    priority_action_items: list[str]

