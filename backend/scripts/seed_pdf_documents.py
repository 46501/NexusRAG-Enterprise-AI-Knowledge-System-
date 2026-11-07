import sys
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db.models import Document, RoleEnum
from app.ingestion.pipeline import ingest_file, rebuild_bm25_index
from app.utils.pdf_generator import generate_document_pdf

_s = get_settings()
_SYNC_DB_URL = (
    f"postgresql+psycopg2://{_s.postgres_user}:{_s.postgres_password}"
    f"@{_s.postgres_host}:{_s.postgres_port}/{_s.postgres_db}"
)


PDF_DEFS = [
    {
        "dept": "hr",
        "filename": "benefits_summary_guide.pdf",
        "title": "Corporate Health & Comprehensive Benefits Summary Guide (2026)",
        "clauses": [
            {
                "chunk_index": 0,
                "text": "NexusRAG Comprehensive Benefits Plan provides all regular full-time employees with healthcare coverage, wellness stipends, and retirement match effective on the first day of employment. Employees have 30 days to elect benefits through the internal portal."
            },
            {
                "chunk_index": 1,
                "text": "Medical and Dental Coverage: Premium tier includes PPO and HDHP with HSA options. Preventive care, annual checkups, and routine dental cleanings are covered at 100% in-network. Annual out-of-pocket maximum is capped at $2,500 for individuals and $5,000 for families."
            },
            {
                "chunk_index": 2,
                "text": "Mental Health & Wellness Stipend: Employees receive up to 12 complimentary therapy sessions per calendar year via our modern mental health partner, plus a monthly $150 tax-free wellness stipend for fitness, ergonomics, and mental wellness subscriptions."
            },
            {
                "chunk_index": 3,
                "text": "Retirement & 401(k) Matching: The enterprise matches 100% of employee contributions up to 5% of base compensation with immediate vesting from day one. Both pre-tax traditional and post-tax Roth 401(k) election options are supported."
            },
            {
                "chunk_index": 4,
                "text": "Paid Parental Leave: Primary and secondary caregivers are entitled to 16 weeks of fully paid parental leave following the birth, adoption, or foster placement of a child. Leave may be taken continuously or in two separate blocks within 12 months."
            }
        ]
    },
    {
        "dept": "engineering",
        "filename": "architecture_overview.pdf",
        "title": "NexusRAG Enterprise Distributed System Architecture & SRE Standard",
        "clauses": [
            {
                "chunk_index": 0,
                "text": "System Architecture Overview: NexusRAG is architected as an asynchronous hybrid retrieval engine combining dense vector search via Qdrant, sparse BM25 indexing, and real-time reranking with sub-500ms latency SLAs."
            },
            {
                "chunk_index": 1,
                "text": "Service Level Objectives (SLOs): Production query availability SLA is 99.95%. Target p95 search latency is 450ms. Incident severity definitions are P0 (complete service outage), P1 (degraded retrieval or high error rates >5%), and P2 (non-critical pipeline delays)."
            },
            {
                "chunk_index": 2,
                "text": "Security & Network Isolation: All inter-service communications enforce mTLS and mutual token verification. Multi-tenant department isolation is enforced cryptographically using RoleEnum claims in JWT payloads."
            },
            {
                "chunk_index": 3,
                "text": "Continuous Deployment: All service containers are built deterministically, scanned for CVEs via Trivy, and deployed progressively using canary deployments with automated rollback on healthcheck failure."
            }
        ]
    },
    {
        "dept": "finance",
        "filename": "q4_financial_statement.pdf",
        "title": "Corporate Financial Operating Statement & Fiscal Compliance Report",
        "clauses": [
            {
                "chunk_index": 0,
                "text": "Fiscal Summary & Revenue: Annual recurring revenue grew 42% year-over-year. Operating margin expanded to 28% driven by autonomous AI efficiency and cloud infrastructure optimization."
            },
            {
                "chunk_index": 1,
                "text": "Procurement & Expenditure Authorization Limits: Department directors may authorize expenditures up to $25,000. Vice Presidents may authorize up to $100,000. Any purchase exceeding $100,000 requires written approval from the Chief Financial Officer."
            },
            {
                "chunk_index": 2,
                "text": "Travel & Entertainment Policy: International business flights exceeding 6 hours are eligible for Premium Economy or Business Class booking. Daily meal allowance while traveling for business is $120."
            },
            {
                "chunk_index": 3,
                "text": "Audit & Compliance Mandates: External financial audit is conducted bi-annually by certified independent public accountants. Internal controls align strictly with SOX 404 standards."
            }
        ]
    }
]


def seed_pdfs():
    print("Generating and seeding PDF documents...")
    engine = create_engine(_SYNC_DB_URL)
    with Session(engine) as db:
        for pdef in PDF_DEFS:
            dept = pdef["dept"]
            filename = pdef["filename"]
            title = pdef["title"]
            clauses = pdef["clauses"]

            # 1. Generate PDF bytes
            pdf_bytes = generate_document_pdf(
                title=title,
                department=dept,
                content_text="\n\n".join(c["text"] for c in clauses),
                chunks=clauses,
            )

            # 2. Save to backend/data/{dept}/{filename}
            dest_dir = backend_dir / "data" / dept
            dest_dir.mkdir(parents=True, exist_ok=True)
            pdf_path = dest_dir / filename
            pdf_path.write_bytes(pdf_bytes)
            print(f"Saved {pdf_path} ({len(pdf_bytes)} bytes)")

            # 3. Check if document already exists in DB
            existing = db.scalar(select(Document).where(Document.name == filename))
            if existing:
                print(f"Document {filename} already exists in DB (ID: {existing.id})")
            else:
                doc_id = ingest_file(
                    file_path=pdf_path,
                    role_access=dept,
                    db=db,
                    original_filename=filename,
                )
                print(f"Ingested {filename} into DB & Qdrant with doc_id={doc_id}")

        db.commit()
        rebuild_bm25_index(db)
        print("Rebuilt BM25 index.")

    engine.dispose()
    print("PDF documents seeding complete!")


if __name__ == "__main__":
    seed_pdfs()

