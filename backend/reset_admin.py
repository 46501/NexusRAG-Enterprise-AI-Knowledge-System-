from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db.models import User, RoleEnum
from app.auth.password import hash_password

s = get_settings()
url = f"postgresql+psycopg2://{s.postgres_user}:{s.postgres_password}@{s.postgres_host}:{s.postgres_port}/{s.postgres_db}"

engine = create_engine(url)

with Session(engine) as db:
    user = db.scalar(select(User).where(User.email == "admin@example.com"))
    if user:
        print("Current role:", user.role.value)
        print("Active:", user.is_active)
        user.hashed_password = hash_password("admin-demo-2026")
        user.role = RoleEnum.admin
        user.is_active = True
        db.commit()
        print("Admin account updated successfully.")
    else:
        print("Admin user not found.")

engine.dispose()
