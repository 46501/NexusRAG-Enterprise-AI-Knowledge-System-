import asyncio
import uuid
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import get_settings
from app.ingestion.pipeline import ingest_file, rebuild_bm25_index
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

_SYNC_DB_URL = (
    f"postgresql+psycopg2://{_s.postgres_user}:{_s.postgres_password}"
    f"@{_s.postgres_host}:{_s.postgres_port}/{_s.postgres_db}"
)


def _run_ingest_sync(file_path: Path, role_access: str, uploader_id: str, original_filename: str) -> str:
    engine = create_engine(_SYNC_DB_URL)
    with Session(engine) as db:
        doc_id = ingest_file(
            file_path=file_path,
            role_access=role_access,
            db=db,
            uploader_id=uploader_id,
            original_filename=original_filename,
        )
        rebuild_bm25_index(db)
        db.commit()
    engine.dispose()
    return doc_id


async def ingest_upload(file_path: Path, role_access: str, uploader_id: str, original_filename: str) -> str:
    if not file_path.exists():
        raise ValueError(f"Temp file not found: {file_path}")

    logger.info("Starting ingestion for %s role=%s uploader=%s", original_filename, role_access, uploader_id)

    loop = asyncio.get_event_loop()
    doc_id = await loop.run_in_executor(
        None, _run_ingest_sync, file_path, role_access, uploader_id, original_filename
    )

    logger.info("Ingestion complete doc_id=%s", doc_id)
    return doc_id
