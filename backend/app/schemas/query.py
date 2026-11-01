from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    stream: bool = False
    top_k: int = Field(default=5, ge=1, le=20)


class SourceSchema(BaseModel):
    index: int
    source: str
    department: str
    chunk_id: str | None
    rerank_score: float | None


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceSchema]
