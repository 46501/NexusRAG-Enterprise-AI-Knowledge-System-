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
