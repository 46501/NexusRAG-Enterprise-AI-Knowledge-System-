from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=10000)


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    department: str | None = None
    stream: bool = False
    top_k: int = Field(default=5, ge=1, le=20)
    history: list[ChatMessage] = []


class SourceSchema(BaseModel):
    index: int
    source: str
    department: str
    chunk_id: str | None = None
    rerank_score: float | None = None
    text: str | None = None


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceSchema]
    suggested_questions: list[str] = []
