import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class FeedbackSubmitRequest(BaseModel):
    query_text: str = Field(min_length=1, max_length=1000)
    answer_text: str = Field(min_length=1, max_length=10000)
    is_positive: bool
    feedback_reason: str | None = Field(default=None, max_length=64)
    feedback_comment: str | None = Field(default=None, max_length=1000)
    sources_cited: str | None = Field(default=None, max_length=512)


class FeedbackItemResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    user_email: str
    department: str
    query_text: str
    answer_text: str
    is_positive: bool
    feedback_reason: str | None = None
    feedback_comment: str | None = None
    sources_cited: str | None = None
    is_resolved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedbackListResponse(BaseModel):
    feedbacks: list[FeedbackItemResponse]
    total: int
    unresolved_count: int

