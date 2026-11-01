from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routes import admin, auth, documents, health, ingest, query
from app.config import configure_langsmith, get_settings
from app.db.postgres import close_db, init_db
from app.generation.generator import load_generator
from app.retrieval.dense import load_dense_client
from app.retrieval.embedder import load_embedder
from app.retrieval.reranker import load_reranker
from app.retrieval.sparse import load_sparse_index
from app.state import init_semaphore, limiter
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_langsmith()
    init_semaphore()
    await init_db()
    load_embedder()
    load_reranker()
    load_dense_client()
    load_sparse_index()
    load_generator()
    logger.info("Application startup complete")
    yield
    await close_db()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="Enterprise RAG",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _s.app_env == "development" else None,
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_s.cors_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["Content-Type"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(query.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")

_STATIC_DIR = Path("/app/frontend/dist")

if _STATIC_DIR.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        file_path = _STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_STATIC_DIR / "index.html")

