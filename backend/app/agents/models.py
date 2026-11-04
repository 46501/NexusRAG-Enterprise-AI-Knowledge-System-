from enum import Enum
from pydantic import BaseModel, Field


class AgentPersona(str, Enum):
    auditor = "auditor"
    risk = "risk"
    intelligence = "intelligence"
    collaborative = "collaborative"


class ComplianceVerdict(str, Enum):
    compliant = "COMPLIANT"
    conditional = "CONDITIONAL"
    violation = "VIOLATION"
    indeterminate = "INDETERMINATE"


class RiskLevel(str, Enum):
    low = "LOW"
    medium = "MEDIUM"
    high = "HIGH"
    critical = "CRITICAL"


class ClauseCitation(BaseModel):
    index: int
    source: str
    section: str | None = None
    snippet: str
    department: str


class RuleCheckItem(BaseModel):
    rule: str
    status: str = Field(description="'PASS', 'WARN', or 'FAIL'")
    finding: str
    clauses: list[str] = []


class ComplianceReport(BaseModel):
    agent: str = "Policy Compliance Auditor"
    verdict: ComplianceVerdict
    confidence_score: float = 95.0
    executive_summary: str
    rules_checked: list[RuleCheckItem]
    required_approvals: list[str]
    remediation_steps: list[str]
    sources: list[ClauseCitation]
    raw_markdown: str = ""


class RiskVectorItem(BaseModel):
    vector_name: str
    severity: str = Field(description="'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'")
    description: str
    impacted_stakeholders: list[str] = []


class ConflictItem(BaseModel):
    conflict_title: str
    policy_a: str
    policy_b: str
    description: str


class RiskAssessmentReport(BaseModel):
    agent: str = "Legal & Operational Risk Assessor"
    risk_level: RiskLevel
    confidence_score: float = 95.0
    executive_summary: str
    risk_vectors: list[RiskVectorItem]
    conflicts_or_ambiguities: list[ConflictItem]
    mitigation_strategies: list[str]
    sources: list[ClauseCitation]
    raw_markdown: str = ""


class PolicyIntelligenceReport(BaseModel):
    agent: str = "Automated Policy Intelligence Assistant"
    document_title: str
    confidence_score: float = 95.0
    executive_takeaways: list[str]
    enforcement_matrix: list[dict]
    policy_gaps: list[str]
    recommended_revisions: list[str]
    sources: list[ClauseCitation]
    raw_markdown: str = ""


class CollaborativeReport(BaseModel):
    agent: str = "Multi-Agent Executive Council"
    scenario: str
    auditor_report: ComplianceReport
    risk_report: RiskAssessmentReport
    collaborative_synthesis: str
    unanimous_recommendations: list[str]
    confidence_score: float = 95.0
    sources: list[ClauseCitation]


class AgentRunRequest(BaseModel):
    scenario: str = Field(..., min_length=3, max_length=2000, description="The scenario, action, or query to analyze")
    persona: AgentPersona = AgentPersona.auditor
    focus_doc: str | None = None
    department: str | None = None

