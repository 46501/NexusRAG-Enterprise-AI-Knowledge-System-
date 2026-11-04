# NexusRAG — Enterprise AI Knowledge System with Strict RBAC & Hybrid Search

> **Live Production Deployments:**
> - **Frontend (Vercel):** [https://nexus-rag-enterprise-ai-knowledge-s.vercel.app](https://nexus-rag-enterprise-ai-knowledge-s.vercel.app/)
> - **Backend API (Render):** [https://nexusrag-enterprise-ai-knowledge-system.onrender.com](https://nexusrag-enterprise-ai-knowledge-system.onrender.com/health)
> - **Vector Database:** Qdrant Cloud Managed Cluster (`rag_documents`)
> - **Relational Database:** Supabase PostgreSQL Managed Cluster
>
> **Demo Department Accounts:**
> | Role | Email | Password | Access Scope |
> |---|---|---|---|
> | **Admin** | `admin@example.com` | `admin-demo-2026` | Full system access, all departments, user & document management, eval & analytics |
> | **HR** | `hr@demo.com` | `hr-demo-2026` | HR policies, employee handbook, benefits, onboarding, reviews |
> | **Engineering** | `engineering@demo.com` | `eng-demo-2026` | Architecture, APIs, deployment guides, incident response, security standards |
> | **Finance** | `finance@demo.com` | `fin-demo-2026` | Budgets, per diem, expense reimbursements, accounting & audit guidelines |

---

## Overview

**NexusRAG** is a production-grade Enterprise Retrieval-Augmented Generation (RAG) platform modeling role-restricted multi-tenant organizational knowledge across **Human Resources**, **Engineering**, and **Finance** departments.

Each employee role can only discover, read, and synthesize documents explicitly tagged for their department. Department isolation is strictly enforced at the **Qdrant vector query layer** and database filter level—not in post-retrieval application code—guaranteeing that restricted chunks never enter the LLM context window.

Retrieval runs a state-of-the-art hybrid pipeline combining dense embeddings (`BAAI/bge-small-en-v1.5`) with sparse BM25 (`BM25s`) via **Reciprocal Rank Fusion (RRF)**, re-ranked with a cross-encoder (`ms-marco-MiniLM-L-6-v2`), and synthesized with **Google Gemini (`gemini-3.5-flash-lite`)** featuring multi-model automatic failover and Server-Sent Events (SSE) token streaming.

---

## System Architecture

```text
                               +-----------------------------------+
                               |       React 18 + Vite Frontend    |
                               | (Tailwind CSS, Dark/Light Themes) |
                               | - Multi-Agent Sidecar Drawer      |
                               | - Command Palette (Ctrl+K)        |
                               | - Document Reader & Comparison    |
                               +-----------------+-----------------+
                                                 |
                                 HTTPS (Bearer JWT or HttpOnly Cookie)
                                                 |
                                                 v
                               +-----------------------------------+
                               |         FastAPI Gateway           |
                               |  - Dual Auth (Bearer / Cookie)    |
                               |  - Rate Limiting (SlowAPI)        |
                               |  - Role & Department RBAC Guard   |
                               +--------+------------------+-------+
                                        |                  |
                    +-------------------+                  +-------------------+
                    |                                                          |
                    v Standard RAG Route                                       v Multi-Agent Routes
+---------------------------------------+                  +---------------------------------------+
| Agentic Planner & Decomposition       |                  | Autonomous Multi-Agent Orchestrator   |
|  - Complexity / Multi-Hop Guard       |                  |  - 🏛️ Policy Compliance Auditor      |
|  - 2-3 Atomic Sub-Queries Planner     |                  |  - ⚖️ Legal & Risk Assessor           |
|  - Contextual Grounding & Parent-Child|                  |  - ⚡ Policy Intelligence Assistant    |
+-------------------+-------------------+                  |  - 🤝 Dual-Agent Executive Council    |
                    |                                      +-------------------+-------------------+
                    v                                                          |
+------------------------------------------------------------------------------+
| Hybrid Retrieval Engine (Qdrant Dense BAAI/bge-small + BM25s Sparse Lexical) |
|  - Strict Department Isolation Vector Filters                                |
|  - Multi-Query Reciprocal Rank Fusion (RRF)                                  |
|  - Cross-Encoder Reranking (ms-marco-MiniLM-L-6-v2)                          |
+---------------------------------------+--------------------------------------+
                                        |
                                        v
+------------------------------------------------------------------------------+
| Google Gemini Generation & Synthesis Engine                                  |
|  - Primary: gemini-3.5-flash-lite (Failover: gemini-3.5-flash, gemini-3-flash)|
|  - CRAG Anti-Hallucination & Evidence Verification                           |
|  - Structured Pydantic & JSON Spec Extraction                               |
|  - Server-Sent Events (SSE) Streaming Pipeline                               |
+---------------------------------------+--------------------------------------+
                                        |
                                        v
+------------------------------------------------------------------------------+
| Client-Side Rendering: Interactive Sidecar Reports, Memo Exports & Stream    |
+------------------------------------------------------------------------------+
```

---

## Tech Stack

| Layer | Technologies & Libraries |
|---|---|
| **API & Backend** | FastAPI, Uvicorn, Pydantic v2, Python 3.11 |
| **Knowledge Operations & Predictive Analytics** | Cross-Policy Contradiction Radar, Freshness & Decay Scorer, Autonomous Policy Gap Drafter, Demand Forecaster, Enterprise Health Index (Tier 4) |
| **Enterprise Observability & Eval** | Telemetry Drift Detection Engine, Native Gemini LLM-as-a-Judge, Regression Delta Matrix, LangSmith Span Tracing (Tier 3) |
| **Autonomous Multi-Agent Layer** | Async Multi-Agent Orchestrator, Policy Compliance Auditor, Risk Assessor, Policy Intelligence Assistant, Executive Council (Tier 2) |
| **Authentication & RBAC** | Dual-mode: HttpOnly cookies + `Authorization: Bearer` headers, bcrypt (`$2b$12$`), python-jose JWT |
| **Relational Database** | Supabase Managed PostgreSQL, SQLAlchemy 2.0 (async), asyncpg |
| **Vector Database** | Qdrant Cloud Cluster (`rag_documents`), Qdrant Client |
| **Sparse Retrieval** | BM25s (in-process serialized sparse lexical index) |
| **Embeddings** | `BAAI/bge-small-en-v1.5` (384-dimensional cosine similarity) |
| **Cross-Encoder Reranker** | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| **Generation Engine** | Google Gemini `gemini-3.5-flash-lite` with automatic failover to `gemini-3.5-flash` & `gemini-3-flash-preview` via `google-genai` SDK |
| **Tracing & Observability** | LangSmith tracing, structured async audit logging to PostgreSQL |
| **RAG Evaluation** | RAGAS framework (Faithfulness, Relevancy, Context Recall, Context Precision) |
| **Rate Limiting** | SlowAPI (10 req/min per user) |
| **Frontend UI** | React 18, Vite, Tailwind CSS, React Markdown, Lucide-style SVG icons |
| **Deployment** | Render (Backend, Python 3.11), Vercel (Frontend SPA), Qdrant Cloud, Supabase |

---

## Key Features & Capabilities

### 1. Advanced Next-Gen RAG Engine (Tier 1 Architecture)
- **Anthropic-Style Contextual Retrieval:** Chunks are situational-aware during ingestion, automatically detecting document headers and prepending `[Document: <name> | Department: <dept> | Section: <title>]` before embedding and BM25 indexing.
- **Agentic Multi-Hop Query Decomposition:** Complex comparative ("Compare X and Y"), multipart, or cross-clause questions are automatically detected by an agentic planner, decomposed into 2-3 focused atomic sub-queries, retrieved in parallel, and merged via multi-query Reciprocal Rank Fusion (RRF).
- **Hierarchical / Parent-Child Context Expansion:** Precision chunk retrieval is coupled with adjacent chunk window stitching (`merge_contiguous_chunks`), seamlessly recombining adjacent chunks from the same document to eliminate cut-off clauses, broken tables, and severed bullet lists.
- **Self-Reflective RAG (CRAG) & Anti-Hallucination Safeguards:** Retrieval sufficiency checks verify evidence before synthesis; ungrounded questions explicitly decline rather than hallucinating policies, while valid queries receive citation chips (`[1]`, `[2]`), dynamic follow-ups, and calibrated confidence scores.
- **Hybrid Dense + Sparse Fusion:** Dense cosine embeddings (`BAAI/bge-small-en-v1.5`) capture semantic meaning; BM25s captures exact technical acronyms, policy IDs, and codes.
- **Multi-Model Redundancy:** Automatic failover across `gemini-3.5-flash-lite`, `gemini-3.5-flash`, and `gemini-3-flash-preview` prevents disruptions from transient 503 high-demand or quota limits.
- **Streaming Tokens with SSE:** Real-time token streaming with bracketed citation mapping, confidence scoring, and dynamic follow-up suggestions.

### 2. Autonomous Multi-Agent Collaboration & Sidecar Workflows (Tier 2 Architecture)
- **🏛️ Policy Compliance Auditor (`auditor`):** Evaluates real-world employee actions, planned operational procedures, or expenditure requests against department policy documents. Generates definitive `compliant` (green), `warning` (amber), or `violation` (red) verdicts accompanied by rule-by-rule pass/fail tables, mandatory approvers, and remediation action items.
- **⚖️ Legal & Operational Risk Assessor (`risk`):** Evaluates outage escalations, architecture changes, vendor contracts, and SLA commitments. Diagnoses risk severity (`low`, `medium`, `high`, `critical`), identifies conflicting clauses, quantifies regulatory/financial penalty vectors, and prescribes actionable mitigations.
- **⚡ Policy Intelligence Assistant (`intelligence`):** Produces executive-level policy briefs from complex corporate governance documents. Synthesizes key takeaways, structured role-based obligation matrices (Employee vs. Manager vs. Department Leads), and proactive compliance gap audits.
- **🤝 Multi-Agent Executive Council (`collaborative`):** Orchestrates concurrent, parallel evaluation by both the Compliance Auditor and Risk Assessor over role-isolated documents. Synthesizes both reports into an executive consensus determination, resolving conflicting clause interpretations into unanimous strategic recommendations.
- **Integrated Sidecar UI & Quick Starters:**
  - Glassmorphic modal (`AgentSidecarModal.jsx`) featuring interactive persona selection tabs, animated stage indicators, verdict badges, copyable markdown memos, and source chunk inspection.
  - One-click departmental scenario templates for instant auditing across HR, Engineering, and Finance.
  - Multi-surface triggers: Message Bubble `🤖 Audit Scenario` button, Command Palette shortcuts (`⌘A`, `⌘R`, Executive Council), Document Reader header action, and Workspace Starter cards.
  - Strict department RBAC validation ensuring zero cross-tenant knowledge leaks.

### 3. Enterprise Observability & Continuous Eval Loop (Tier 3 Architecture)
- **Continuous Telemetry Drift Engine:** Sliding-window tracking of Grounding Rate drift, Latency percentiles (P50/P90/P99), User Satisfaction drift, and Knowledge Gap topic clustering with automated root-cause diagnoses.
- **Dual-Engine LLM-as-a-Judge Eval Loop:** Native Gemini judge (`gemini-3.5-flash-lite` / `gemini-3.5-flash`) + OpenAI judge running RAGAS benchmark across 15+ golden HR, Eng, and Finance test cases with zero extra credentials required.
- **Regression Delta Matrix & SLA Enforcement:** Evaluates live runs against golden SLA baselines (Faithfulness $\ge 0.90$, Relevancy $\ge 0.80$, Precision $\ge 0.85$, Recall $\ge 0.90$), automatically flagging any performance regression or degradation delta.
- **LangSmith Native Tracing & Span Enrichment:** Telemetry span instrumentation decorating hybrid retrieval, agent workflows, and query decomposition.
- **Dedicated Observability Dashboard:** Interactive admin tab (`ObservabilityTab.jsx`) with live drift alert banner, regression matrix scorecards, topic gap clusters, and scheduled continuous eval triggers.

### 4. Knowledge Operations & Proactive AI Analytics (Tier 4 Architecture)
- **🔍 Cross-Policy Contradiction Radar (`contradiction_radar.py`):** Scans intra- and cross-policy clauses across HR, Engineering, and Finance documents to detect conflicting rules, contradictory SLA turnaround windows, divergent approval limits, and outdated provisions. Returns severity rating (`critical`, `high`, `medium`, `low`), offending clause quotes from both documents, and recommended reconciliation paths.
- **⏳ Freshness, Velocity & Temporal Decay Scorer (`decay_scorer.py`):** Computes multi-factor obsolescence risk scores (0–100) per document combining temporal decay past 30/90 days, citation query velocity, and negative user feedback reports. Assigns intuitive status labels (`Fresh`, `Degrading`, `Stale`, `Critical Revision`).
- **📝 Autonomous Policy Gap Drafter (`policy_drafter.py`):** When telemetry or ungrounded inquiry clusters reveal missing institutional knowledge, the autonomous drafter generates comprehensive, formatted enterprise SOPs complete with purpose, scope, numbered policy rules, approval matrices, and audit clauses. Includes one-click direct publishing into PostgreSQL & Qdrant Cloud.
- **📈 Predictive Knowledge Demand Forecaster (`demand_forecaster.py`):** Synthesizes organizational calendar cycles (performance reviews, budget cycles, canary releases, travel summits) and query velocity to project 30-day inquiry surges with surge probability, percentage volume increases, and preparation checklists.
- **🏆 Enterprise Knowledge Health Index (`health_index.py`):** Authoritative composite 0–100 health score with letter grade (A–D), verdict, and 5 foundational pillars (Retrieval Grounding 25%, RAGAS Quality 25%, User Satisfaction 20%, Policy Freshness 15%, Contradiction Freedom 15%), accompanied by department scorecards and prioritized action items.
- **🎛️ Executive Knowledge Operations Console (`KnowledgeOpsTab.jsx`):** Integrated directly into the Admin Workspace with real-time health gauge, pillar breakdown bars, contradiction diff cards, 30-day demand forecast checklists, interactive gap drafter with quick-pick templates, and document decay table.

### 5. Department Workspaces & Multi-Tenant RBAC Isolation
- **Strict Query-Level Isolation:** HR, Engineering, and Finance workspaces operate in complete data silos.
- **Zero-Leakage Enforcement:**
  - Query parameter overrides (`?department=...`) blocked with `403 Forbidden`.
  - Document content access outside user department blocked with `403 Forbidden`.
  - Focus document selection outside department blocked with `403 Forbidden`.
  - Non-admin upload attempts to other departments blocked with `403 Forbidden`.
  - Admin endpoints (`/admin/users`, `/admin/analytics`, `/admin/feedbacks`, `/admin/observability`) restricted to Admin roles.

### 6. Document Sidebar, Reader & Full Filename Display
- **Complete Filename Visibility:** Document names and file extensions (`performance_review.txt`, `deployment_guide.txt`) are displayed in full with natural wrapping, clean line breaks, and hover tooltips across all departments.
- **Sidebar Search & Filtering:** Press `/` to focus the search bar, filter by file type (All, PDF, TXT, MD), and toggle sort order (🕒 Recent vs 🔤 A–Z).
- **Integrated Document Reader:** Click **Read** on any document card to view the reconstructed full text and chunk inspection modal directly in the workspace.

### 7. Side-by-Side Multi-Document Comparison Matrix
- **Comparative Analysis Engine:** Select two documents to generate a structured comparison matrix across operational, policy, financial, and compliance dimensions.
- **Presets Available:**
  - Comprehensive Matrix
  - Limits & Allowances
  - Compliance, SLAs & Penalties
  - Approval Workflows
  - Custom Analysis
- **One-Click Export:** Download comparison matrices directly to CSV or copy clean Markdown tables to the clipboard.

### 8. Chat UX, Thinking Pipeline & Feedback Loop
- **Dynamic Retrieval Thinking Indicator:** Visual multi-step pipeline indicator showcasing query preprocessing, dense/sparse search, reranking, and synthesis phases.
- **Message Action Toolbar:** Copy answer text, export formatted Markdown briefs, and inspect citations via interactive slide-out drawer.
- **Inline Feedback System:** Submit thumbs-up or thumbs-down feedback with categorized reasons (`Inaccurate`, `Incomplete`, `Missing Citation`, `Outdated`, `Off-Topic`).
- **Spotlight Autocomplete:** Contextual typeahead providing department-specific starter questions with Tab/arrow acceptance.
- **Enriched Cold-Start Empty State:** Department metrics, quick starters, and recent files.

### 9. Admin Control Center & Analytics
- **System Metrics Overview:** Total queries, average latency (ms), total documents, active users, and grounding rate.
- **User Management:** View all registered accounts, role assignments, last login timestamps, and activate/deactivate accounts.
- **Feedback Management:** Inspect flagged responses, review user comments, and mark feedback items as resolved.
- **RAGAS Benchmark Pipeline:** Trigger and review automated RAG evaluation runs.

---

## Local Setup & Development

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Google Gemini API key (from [Google AI Studio](https://aistudio.google.com/))
- PostgreSQL instance or Supabase account
- Qdrant instance (Local Docker or Qdrant Cloud)

### 1. Clone the Repository
```bash
git clone https://github.com/46501/NexusRAG-Enterprise-AI-Knowledge-System-.git
cd Enterprise-RAG-main
```

### 2. Configure Backend Environment
Copy `backend/.env.example` to `backend/.env` and update the parameters:

```bash
cp backend/.env.example backend/.env
```

**Key Environment Variables in `backend/.env`:**
```ini
# Core
APP_ENV=development
PORT=8000
CORS_ORIGIN=http://localhost:5173

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_SECONDS=30

# Database (Supabase or Local PostgreSQL)
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/rag_db

# Vector Store (Qdrant Cloud or Local)
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=your_qdrant_api_key_if_cloud
QDRANT_COLLECTION=rag_documents

# Auth & JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE_MINUTES=60
```

### 3. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Seed Database & Rebuild Indexes
```bash
# Seed default department accounts
python scripts/create_user.py --email hr@demo.com --password hr-demo-2026 --role hr
python scripts/create_user.py --email engineering@demo.com --password eng-demo-2026 --role engineering
python scripts/create_user.py --email finance@demo.com --password fin-demo-2026 --role finance
python scripts/create_user.py --email admin@example.com --password admin-demo-2026 --role admin

# Ingest initial documents per department
python scripts/run_ingestion.py --department hr --dir data/hr/
python scripts/run_ingestion.py --department engineering --dir data/engineering/
python scripts/run_ingestion.py --department finance --dir data/finance/
```

### 5. Start Backend Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at: `http://localhost:8000/docs`

### 6. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Testing & Verification Suite

NexusRAG includes an automated End-to-End QA and regression test suite covering all modules:

### Run Complete 44-Point E2E Verification Suite
```bash
cd backend
./venv/Scripts/python.exe tests/test_complete_e2e_suite.py
```

**Verification Results:**
```text
======================================================================
NEXUS-RAG COMPREHENSIVE END-TO-END QA & VERIFICATION TEST SUITE
======================================================================
>>> MODULE 1: Health & Infrastructure Checks (2/2 Passed)
>>> MODULE 2: Authentication & Session Management (12/12 Passed)
>>> MODULE 3: RBAC & Department Isolation (10/10 Passed)
>>> MODULE 4: Document Ingestion & Document Reader (7/7 Passed)
>>> MODULE 5: RAG Retrieval, Synthesis & Streaming (4/4 Passed)
>>> MODULE 6: Multi-Document Comparison Matrix (1/1 Passed)
>>> MODULE 7: User Feedback & Resolution Workflow (4/4 Passed)
>>> MODULE 8: Admin Analytics & Observability (3/3 Passed)
======================================================================
TEST SUITE SUMMARY: 44/44 Passed (100.0%) | 0 Failed
======================================================================
```

### Run Additional Targeted Tests
```bash
# Tier 4 Knowledge Operations & Proactive AI Analytics (6/6 Passed)
python tests/test_tier4_knowledge_ops.py

# Tier 3 Enterprise Observability & Continuous Eval Loop (4/4 Passed)
python tests/test_tier3_observability.py

# Tier 2 Autonomous Multi-Agent Workflows & Executive Council (4/4 Passed)
python tests/test_tier2_multi_agent.py

# Tier 1 Next-Gen RAG (Contextual Grounding, Multi-Hop Decomposition, CRAG) (4/4 Passed)
python tests/test_tier1_nextgen_rag.py

# Authentication & Seeded Logins
python scripts/verify_auth_system.py

# Gemini RAG & Multi-tenant Retrieval
python tests/test_gemini_rag.py

# Vite Proxy & Frontend Stream Flow
python tests/test_e2e_frontend_flow.py

# Frontend Production Build Check
npm --prefix frontend run build
```

---

## RAGAS Evaluation Results

Evaluation performed over golden enterprise benchmark queries across HR, Engineering, and Finance:

| Metric | Score | Target | Description |
|---|---|---|---|
| **Faithfulness** | **0.9926** | > 0.90 | Answers strictly grounded in retrieved evidence with zero ungrounded assertions |
| **Answer Relevancy** | **0.8428** | > 0.80 | Direct, complete resolution of the user's specific business query |
| **Context Recall** | **1.0000** | > 0.90 | Retrieval surfaces all necessary clauses to formulate the complete answer |
| **Context Precision** | **0.9423** | > 0.85 | Minimal noise in top reranked chunks fed to the LLM |

---

## Security & Compliance Architecture

- **AI Guardrail Firewall (`app/security/guardrails.py`):** Multi-layered prompt injection & jailbreak firewall (<1ms latency) with:
  - **Direct Prompt Injection Defense:** Blocks instruction overrides (`ignore previous instructions`), persona hijacking (`DAN`, `developer mode`), and system bypass commands.
  - **System Prompt Exfiltration Blocker:** Prevents leakage of initial instructions, grounding rules, and internal prompts.
  - **Adversarial Delimiter & Fence Protection:** Detects fake prompt tokens (`<|im_start|>`, `<<SYS>>`, `---END CONTEXT---`, `[SYSTEM]:`).
  - **Bulk Data & Secret Probing Defense:** Rejects raw database and vector store dump queries (`SELECT * FROM users`, credential leak attempts).
  - **Steganography & Obfuscation Neutralization:** Automatically strips zero-width Unicode characters, evaluates Base64-obfuscated injection vectors, and handles leetspeak substitutions.
  - **Document Ingestion Screening:** Cleans uploaded files and warns on embedded indirect prompt injections.
  - **Zero False Positives:** Rigorously verified to permit all legitimate corporate queries across HR, Engineering, and Finance.
- **Real-Time PII & Secret Scrubber (`app/security/pii_scrubber.py`):** Bidirectional redaction and sanitization across inbound queries, outbound answers, citation sources, and streaming tokens:
  - **Financial & Identity Protection:** Redacts US SSNs (`[REDACTED_SSN]`) and payment cards (`[REDACTED_CREDIT_CARD]`) with Luhn algorithm validation to prevent false positives on order/tracking numbers.
  - **API Keys & Credentials:** Scrubs OpenAI (`sk-...`), Google (`AIza...`), AWS (`AKIA...`), JWT tokens, generic auth tokens, and cleartext passwords (`password = "..."`).
  - **Cryptographic Keys:** Redacts entire RSA, EC, and OpenSSH private key blocks (`[REDACTED_PRIVATE_KEY]`).
  - **Streaming Token Buffer:** Uses an intelligent word-boundary sliding window so secrets split across consecutive SSE tokens are never severed or partially leaked.
  - **Zero Server Overhead:** Pure regex & algorithmic validation executing in microseconds with 0 MB added RAM.
- **Enterprise HTTP Security Headers Middleware (`app/security/headers.py`):** High-performance ASGI middleware injecting defense-in-depth HTTP headers on all API responses without buffering SSE streams:
  - **HSTS Enforcement:** `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` enforces HTTPS exclusively.
  - **Clickjacking Defense:** `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` prevent unauthorized embedding in iframes.
  - **MIME Sniffing Prevention:** `X-Content-Type-Options: nosniff` stops malicious executable/script spoofing.
  - **Content Security Policy (CSP):** Fine-grained directives restricting script, style, font, connect, and media sources (`default-src 'self'`).
  - **Referrer & Permissions Hardening:** `Referrer-Policy: strict-origin-when-cross-origin` and sandboxed `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
  - **Anti-Caching for Sensitive Endpoints:** Injects `Cache-Control: no-store, no-cache, must-revalidate` and `Pragma: no-cache` on `/auth/*` and `/admin/*` routes to prevent token/session caching in browser history.
- **Password Protection:** Salting and hashing via `passlib[bcrypt]` with work factor 12.
- **Session Architecture:** Dual-mode authentication (HttpOnly cookies with CSRF/SameSite protection + standard Bearer tokens).
- **Access Control:** User roles (`admin`, `hr`, `engineering`, `finance`) enforced via FastAPI dependencies with immediate `403 Forbidden` on unauthorized department requests.
- **Data Protection:** No plaintext credentials or API keys stored in client bundles or public commits.
- **Memory Footprint:** In-process memory usage optimized to < 220 MB, operating comfortably within Render's 512 MB free tier ceiling.

---

## License

This project is licensed under the MIT License.
