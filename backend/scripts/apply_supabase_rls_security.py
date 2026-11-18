import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import text
from app.db.postgres import engine
from app.utils.logger import get_logger

logger = get_logger(__name__)

TABLES = [
    "users",
    "refresh_tokens",
    "documents",
    "query_logs",
    "feedbacks",
    "security_audit_logs",
    "eval_results",
]

async def apply_rls():
    print("=" * 60)
    print("NEXUSRAG — APPLYING SUPABASE RLS SECURITY HARDENING")
    print("=" * 60)

    async with engine.begin() as conn:
        for table in TABLES:
            print(f"\n[+] Hardening table: public.{table}")

            # 1. Enable Row Level Security
            await conn.execute(text(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;"))
            print(f"    - Enabled Row Level Security (RLS)")

            # 2. Revoke all permissions from untrusted PostgREST roles (anon, authenticated)
            await conn.execute(text(f"REVOKE ALL ON TABLE public.{table} FROM anon, authenticated;"))
            print(f"    - Revoked all table permissions from anon & authenticated roles")

            # 3. Drop existing service_role policy if exists and recreate
            policy_name = f"allow_service_role_{table}"
            await conn.execute(text(f"DROP POLICY IF EXISTS {policy_name} ON public.{table};"))
            await conn.execute(text(f"""
                CREATE POLICY {policy_name} ON public.{table}
                FOR ALL
                TO service_role
                USING (true)
                WITH CHECK (true);
            """))
            print(f"    - Created service_role policy: {policy_name}")

        # 4. Alter default privileges for future tables
        await conn.execute(text("ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;"))
        print("\n[+] Hardened default privileges for future tables in schema public.")

    print("\n" + "=" * 60)
    print("VERIFYING SUPABASE SECURITY ADVISOR COMPLIANCE")
    print("=" * 60)

    async with engine.connect() as conn:
        # Check rls_disabled_in_public
        res = await conn.execute(text("""
            SELECT 
                c.relname as table_name,
                c.relrowsecurity as rls_enabled
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind = 'r'
            ORDER BY c.relname;
        """))
        advisor_rows = res.fetchall()
        flagged = []
        for r in advisor_rows:
            status = "PASS (RLS ON)" if r[1] else "FAIL (RLS OFF)"
            print(f"  Table: {r[0]:22} -> {status}")
            if not r[1]:
                flagged.append(r[0])

        if not flagged:
            print("\n>>> ALL PUBLIC TABLES SECURED! 0 tables flagged by rls_disabled_in_public.")
        else:
            print(f"\n>>> WARNING: {len(flagged)} tables still flagged: {flagged}")

        # Verify access for anon / authenticated vs postgres
        print("\n--- Verifying Deny-by-Default Access Control ---")
        for table in TABLES:
            # Test anon
            anon_status = "UNKNOWN"
            try:
                async with engine.connect() as test_conn:
                    await test_conn.execute(text("SET ROLE anon;"))
                    res = await test_conn.execute(text(f"SELECT count(*) FROM {table};"))
                    anon_status = f"visible: {res.scalar()}"
            except Exception as e:
                anon_status = "BLOCKED (Permission Denied)"

            # Test authenticated
            auth_status = "UNKNOWN"
            try:
                async with engine.connect() as test_conn:
                    await test_conn.execute(text("SET ROLE authenticated;"))
                    res = await test_conn.execute(text(f"SELECT count(*) FROM {table};"))
                    auth_status = f"visible: {res.scalar()}"
            except Exception as e:
                auth_status = "BLOCKED (Permission Denied)"

            # Test backend (postgres role)
            async with engine.connect() as test_conn:
                res = await test_conn.execute(text(f"SELECT count(*) FROM {table};"))
                pg_count = res.scalar()
                
            print(f"  {table:20} -> anon: {anon_status} | auth: {auth_status} | backend: {pg_count}")

    print("\n[+] RLS Hardening & Verification Complete!")

if __name__ == "__main__":
    asyncio.run(apply_rls())
