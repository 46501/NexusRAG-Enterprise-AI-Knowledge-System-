from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.models import Base
from app.utils.logger import get_logger

logger = get_logger(__name__)

_settings = get_settings()

engine = create_async_engine(
    _settings.database_url,
    pool_size=5,
    max_overflow=10,
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
