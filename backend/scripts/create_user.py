import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import argparse

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.config import get_settings
from app.db.models import RoleEnum, User
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

_SYNC_DB_URL = (
    f"postgresql+psycopg2://{_s.postgres_user}:{_s.postgres_password}"
    f"@{_s.postgres_host}:{_s.postgres_port}/{_s.postgres_db}"
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a user in the database")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument("--password", required=True, help="Plain-text password")
    parser.add_argument(
        "--role",
        required=True,
        choices=[r.value for r in RoleEnum],
        help="User role",
    )
    args = parser.parse_args()

    engine = create_engine(_SYNC_DB_URL)

    with Session(engine) as db:
        existing = db.scalar(select(User).where(User.email == args.email))
        if existing:
            logger.error("User already exists: %s", args.email)
            sys.exit(1)

        user = User(
            email=args.email,
            hashed_password=hash_password(args.password),
            role=RoleEnum(args.role),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    logger.info("Created user id=%s email=%s role=%s", user.id, user.email, user.role.value)
    engine.dispose()


if __name__ == "__main__":
    main()
