import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import get_settings
from app.db.postgres import AsyncSessionLocal
from sqlalchemy import text
from app.retrieval.dense import get_client

async def test_env_and_connections():
    settings = get_settings()
    print("=== Checking Environment Configuration ===")
    print(f"APP_ENV: {settings.app_env}")
    print(f"DATABASE_URL set: {bool(settings.database_url)}")
    print(f"QDRANT_URL set: {bool(settings.qdrant_url)}")
    print(f"QDRANT_API_KEY set: {bool(settings.qdrant_api_key)}")
    print(f"GEMINI_API_KEY set: {bool(settings.gemini_api_key)}")
    print(f"JWT_SECRET_KEY set: {bool(settings.jwt_secret_key)}")

    print("\n=== Testing PostgreSQL Database Connectivity ===")
    try:
        async with AsyncSessionLocal() as session:
            res = await session.execute(text("SELECT 1"))
            assert res.scalar() == 1
            print("  [SUCCESS] PostgreSQL connection verified (SELECT 1 returns 1)")
            
            # Check tables
            tables_res = await session.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
            ))
            tables = [r[0] for r in tables_res.fetchall()]
            print(f"  [SUCCESS] Found {len(tables)} tables: {', '.join(tables)}")
    except Exception as e:
        print(f"  [FAIL] PostgreSQL connection error: {e}")

    print("\n=== Testing Qdrant Connectivity ===")
    try:
        qdrant = get_client()
        collections = await qdrant.get_collections()
        col_names = [c.name for c in collections.collections]
        print(f"  [SUCCESS] Qdrant connection verified. Collections: {col_names}")
    except Exception as e:
        print(f"  [FAIL] Qdrant connection error: {e}")

if __name__ == "__main__":
    asyncio.run(test_env_and_connections())
