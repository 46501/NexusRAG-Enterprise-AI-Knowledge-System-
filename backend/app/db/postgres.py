import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.models import Base
from app.utils.logger import get_logger

logger = get_logger(__name__)

_settings = get_settings()

engine = create_async_engine(
    _settings.database_url,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
    # Lean connection pool prevents socket/buffer memory exhaustion on 512MB RAM
    pool_size=int(os.getenv("DB_POOL_SIZE", "3")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "3")),
    pool_pre_ping=True,
    echo=_settings.app_env == "development",
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;"))
        except Exception as e:
            logger.warning("Optional users column migration skipped or already present: %s", e)
    logger.info("Database tables initialised")


async def close_db() -> None:
    await engine.dispose()
    logger.info("Database connection pool closed")


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
