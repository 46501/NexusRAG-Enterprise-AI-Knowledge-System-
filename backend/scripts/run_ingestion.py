import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import argparse

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import get_settings
from app.ingestion.pipeline import ingest_file, rebuild_bm25_index
from app.retrieval.embedder import load_embedder
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

_SYNC_DB_URL = (
    f"postgresql+psycopg2://{_s.postgres_user}:{_s.postgres_password}"
    f"@{_s.postgres_host}:{_s.postgres_port}/{_s.postgres_db}"
)

DEPARTMENT_MAP = {
    "hr": "hr",
    "engineering": "engineering",
    "finance": "finance",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest documents into the RAG system")
    parser.add_argument("--dir", required=True, help="Directory containing documents to ingest")
    parser.add_argument(
        "--department",
        required=True,
        choices=list(DEPARTMENT_MAP.keys()),
        help="Department role these documents belong to",
    )
    parser.add_argument("--uploader-id", default=None, help="UUID of the uploading user")
    args = parser.parse_args()

    doc_dir = Path(args.dir)
    if not doc_dir.is_dir():
        logger.error("Directory not found: %s", doc_dir)
        sys.exit(1)

    files = [p for p in doc_dir.iterdir() if p.suffix.lower() in (".pdf", ".txt", ".md")]
    if not files:
        logger.error("No supported files (.pdf, .txt, .md) found in %s", doc_dir)
        sys.exit(1)

    logger.info("Loading models...")
    load_embedder()

    engine = create_engine(_SYNC_DB_URL)

    with Session(engine) as db:
        ingested = []
        for file_path in files:
            try:
                doc_id = ingest_file(
                    file_path=file_path,
                    role_access=DEPARTMENT_MAP[args.department],
                    db=db,
                    uploader_id=args.uploader_id,
                )
                ingested.append(doc_id)
                logger.info("Ingested %s -> doc_id=%s", file_path.name, doc_id)
            except Exception as exc:
                logger.error("Failed to ingest %s: %s", file_path.name, exc)

        if ingested:
            logger.info("Rebuilding BM25 index...")
            rebuild_bm25_index(db)
            db.commit()
            logger.info("Ingestion complete. %d/%d files processed.", len(ingested), len(files))
        else:
            logger.error("No files were successfully ingested.")
            sys.exit(1)


if __name__ == "__main__":
    main()
