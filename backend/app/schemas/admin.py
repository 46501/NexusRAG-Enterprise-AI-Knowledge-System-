import uuid
from datetime import datetime
from pydantic import BaseModel
from app.db.models import RoleEnum


class DocumentResponse(BaseModel):
    id: uuid.UUID
    name: str
    department: RoleEnum
    uploaded_at: datetime
    chunk_count: int
    uploaded_by: uuid.UUID | None

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class UserAdminResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: RoleEnum
    is_active: bool
    created_at: datetime
    full_name: str | None = None
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}


class SetActiveRequest(BaseModel):
    is_active: bool


class EvalResultResponse(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    metric_name: str
    score: float
    run_at: datetime

    model_config = {"from_attributes": True}


class EvalRunStartResponse(BaseModel):
    status: str
    started_at: datetime


class DepartmentAnalytics(BaseModel):
    department: str
    documents_count: int
    chunks_count: int
    users_count: int
    queries_count: int
    avg_latency_ms: float


class SystemOverview(BaseModel):
    total_documents: int
    total_chunks: int
    total_users: int
    active_users: int
    total_queries: int
    avg_latency_ms: float
    grounding_rate_pct: float


class QueryLogItem(BaseModel):
    id: str
    user_email: str
    department: str
    query_text: str
    sources_count: int
    top_source: str | None = None
    latency_ms: float
    created_at: str


class TopFaqItem(BaseModel):
    query: str
    department: str
    count: int


class AnalyticsResponse(BaseModel):
    overview: SystemOverview
    departments: list[DepartmentAnalytics]
    recent_queries: list[QueryLogItem]
    top_faqs: list[TopFaqItem]
    unanswered_queries: list[QueryLogItem]
    rag_eval_scores: dict[str, float]
    system_health: dict
