# NexusRAG — Enterprise AI Knowledge System with Strict RBAC & Hybrid Search

<p align="center">
  <img src="docs/screenshots/landing-page.png" alt="NexusRAG Hero Banner" width="100%" style="border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.15);" />
</p>

<p align="center">
  <strong>Production-Grade Multi-Tenant Retrieval-Augmented Generation (RAG) Platform with Vector-Layer RBAC, Hybrid Search, Neural Reranking, and Continuous PDF Citations.</strong>
</p>

<p align="center">
  <a href="https://nexus-rag-enterprise-ai-knowledge-s.vercel.app"><img src="https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel" alt="Live Demo" /></a>
  <a href="https://nexusrag-enterprise-ai-knowledge-system.onrender.com/health"><img src="https://img.shields.io/badge/API_Status-Render-46E3B7?style=for-the-badge&logo=render" alt="API Status" /></a>
  <a href="https://github.com/46501/NexusRAG-Enterprise-AI-Knowledge-System-"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github" alt="Repository" /></a>
  <img src="https://img.shields.io/badge/QA_Audit-129%2F129_Passed_(100%25)-success?style=for-the-badge&logo=checkmarx" alt="QA Passed" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

---

## 📌 Executive Summary

| Property | Details |
| :--- | :--- |
| **Live Frontend (Vercel)** | [https://nexus-rag-enterprise-ai-knowledge-s.vercel.app](https://nexus-rag-enterprise-ai-knowledge-s.vercel.app/) |
| **Production API (Render)** | [https://nexusrag-enterprise-ai-knowledge-system.onrender.com](https://nexusrag-enterprise-ai-knowledge-system.onrender.com/health) |
| **Vector Database** | Qdrant Cloud Managed Cluster (`rag_documents`) |
| **Relational Database** | Supabase PostgreSQL Managed Cluster |
| **LLM Engine** | Google Gemini (`gemini-3.5-flash-lite` with automatic failover) |
| **Embeddings** | `BAAI/bge-small-en-v1.5` (384-dimensional dense vectors) |
| **Sparse Lexical Search** | BM25s (in-process sparse CSC matrix) |
| **Neural Reranker** | Cross-Encoder (`ms-marco-MiniLM-L-6-v2`) |

### Verified Department Credentials (Test Accounts)
| Department | Work Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **HR** | `hr@demo.com` | `hr-demo-2026` | Parental leave, benefits, compensation, handbook, onboarding policies |
| **Engineering** | `engineering@demo.com` | `eng-demo-2026` | System architecture, deployment runbooks, APIs, incident response, SLOs |
| **Finance** | `finance@demo.com` | `fin-demo-2026` | Budget policies, expenditure thresholds, financial audits, per diem rules |
| **Admin** | `admin@example.com` | `admin-demo-2026` | Global cross-department access, user controls, observability, security logs |

---

## 📑 Table of Contents
1. [Project Overview](#-project-overview)
2. [Live Application Showcase](#-live-application-showcase)
3. [Key Architectural Highlights](#-key-architectural-highlights)
4. [System Architecture](#-system-architecture)
5. [End-to-End RAG Pipeline](#-end-to-end-rag-pipeline)
6. [Technology Stack](#-technology-stack)
7. [Security & Defensive Guardrails](#-security--defensive-guardrails)
8. [Comprehensive Testing & QA Verification](#-comprehensive-testing--qa-verification)
9. [Local Development & Setup Guide](#-local-development--setup-guide)
10. [Environment Variables Reference](#-environment-variables-reference)
11. [Repository Structure](#-repository-structure)
12. [Deployment Architecture](#-deployment-architecture)
13. [Future Roadmap](#-future-roadmap)
14. [Author & License](#-author--license)

---

## 💡 Project Overview

### The Enterprise Knowledge Problem
Enterprises struggle with fragmented documents scattered across departments. Standard search engines rely on simple keyword queries that miss semantic context, while vanilla LLM solutions are vulnerable to hallucinations, lack verified citations, and dangerously leak confidential HR or financial data across tenant boundaries.

### How NexusRAG Solves It
**NexusRAG** is an enterprise-grade AI knowledge platform built to solve these exact enterprise hurdles through:
1. **Cryptographic & Vector-Layer RBAC Isolation:** Role-based access control is enforced at the **Qdrant vector query layer** and PostgreSQL filter level. Chunks from unauthorized departments are filtered out *before* scoring, ensuring restricted corporate data never touches the LLM context window.
2. **Contextual Hybrid Retrieval:** Pairs dense semantic embeddings (`BAAI/bge-small-en-v1.5`) with sparse lexical indexing (`BM25s`) via **Reciprocal Rank Fusion (RRF)**, ensuring high accuracy for both natural language questions and exact policy IDs/acronyms.
3. **Cross-Encoder Neural Reranking:** Applies `ms-marco-MiniLM-L-6-v2` across fused candidate chunks to evaluate deep query-passage interactions, discarding irrelevant context.
4. **Verifiable Citations with Continuous PDF Viewing:** Every generated claim includes interactive bracketed citations (`[1]`, `[2]`). Clicking a citation opens the **Document Reader** with continuous vertical page rendering, exact chunk clause highlighting, and readable text copying with zero binary leakage.
5. **Production AI Defense:** Real-time prompt injection firewall, automated PII scrubbing (with Luhn-validated credit card and SSN redaction), and brute-force account lockout.

---

## 📸 Live Application Showcase

### 1. Modern Landing Page & Department Selector
Dynamic entry point highlighting multi-tenant capabilities, department-specific policy scopes, architecture specs, and direct access controls.
<p align="center">
  <img src="docs/screenshots/landing-page.png" alt="NexusRAG Landing Page" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 2. Main Enterprise Workspace
Three-panel conversational workspace featuring collapsible thread history, multi-surface command palette, real-time query pipeline indicators, and pinned departmental documents.
<p align="center">
  <img src="docs/screenshots/workspace.png" alt="NexusRAG Main Workspace" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 3. Grounded RAG Chat with Streaming Citations
Grounded synthesis via Google Gemini with Server-Sent Events (SSE) streaming, interactive citation chips (`[1]`), confidence indicators, and copyable Markdown briefs.
<p align="center">
  <img src="docs/screenshots/chat-response.png" alt="Chat Response with Citations" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 4. Grounding Verification Modal & Evidence Inspector
Inspect the exact retrieved clause, semantic relevance score, document name, and verified text behind any citation chip.
<p align="center">
  <img src="docs/screenshots/citation-drawer.png" alt="Citation Grounding Modal" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 5. High-Performance PDF Document Reader
Continuous vertical page scrolling powered by PDF.js Canvas, zoom controls (50%–200%), fit-width mode, clean readable text extraction, and direct binary downloads.
<p align="center">
  <img src="docs/screenshots/pdf-reader.png" alt="PDF Document Reader" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 6. Vector Chunk Highlighting View
Inspect all indexed vector chunks, similarity scores, and metadata badges directly inside the reader modal.
<p align="center">
  <img src="docs/screenshots/chunk-highlighting.png" alt="Chunk Highlighting View" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 7. Multi-Document Side-by-Side Comparison Matrix
Select two departmental policies or runbooks to generate structured comparison tables across operational, financial, and compliance dimensions.
<p align="center">
  <img src="docs/screenshots/document-comparison.png" alt="Document Comparison Matrix" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 8. In-App Document Ingestion & Management
Drag-and-drop document ingestion pipeline with automatic text extraction, chunking, and immediate vector indexing in Qdrant Cloud.
<p align="center">
  <img src="docs/screenshots/document-upload.png" alt="Document Upload Modal" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 9. Admin Control Center & Real-Time Analytics
Executive dashboard with query volume tracking, P95 latency percentiles, user feedback ratios, and department distribution charts.
<p align="center">
  <img src="docs/screenshots/admin-dashboard.png" alt="Admin Dashboard" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 10. Security Forensic Console & SIEM Audit Trail
Real-time security telemetry displaying prompt injection detections, PII redactions, unauthorized access attempts, and brute-force lockout controls.
<p align="center">
  <img src="docs/screenshots/analytics.png" alt="Security Forensic Console" width="90%" style="border-radius: 8px; border: 1px solid #e2e8f0;" />
</p>

### 11. Mobile Responsive Experience
Adaptive layout with independent sliding drawers and touch-optimized action bars across mobile devices and tablets.
<p align="center">
  <img src="docs/screenshots/mobile-responsive.png" alt="Mobile Responsive View" width="380px" style="border-radius: 12px; border: 1px solid #e2e8f0;" />
</p>

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (React 18 + Vite)"]
        UI["Modern Web Interface\n(Tailwind CSS, Dark/Light Themes)"]
        Reader["Continuous PDF Reader\n(PDF.js Canvas & Chunk Inspector)"]
        CompMatrix["Multi-Document Matrix\n(Side-by-Side Synthesis)"]
        CmdPal["Command Palette\n(Ctrl+K / Quick Navigation)"]
    end

    subgraph SecurityGateway ["Security & API Gateway (FastAPI)"]
        AuthGuard["Dual Auth Guard\n(JWT Bearer & HttpOnly Cookies)"]
        RBAC["Strict Multi-Tenant RBAC\n(HR / Engineering / Finance / Admin)"]
        Firewall["AI Guardrail Firewall\n(Prompt Injection & Jailbreak Defense)"]
        PII["Real-Time PII Scrubber\n(Luhn Check & SSN Masking)"]
        RateLimit["Rate Limiting\n(SlowAPI Concurrency Control)"]
    end

    subgraph RetrievalEngine ["Hybrid Retrieval & Reranking Engine"]
        DenseQdrant["Dense Vector Search\n(Qdrant Cloud + BGE-small-en-v1.5)\n[Strict Role Filter Applied]"]
        SparseBM25["Sparse Lexical Search\n(BM25s CSC Sparse Matrix)\n[Exact Token & Code Match]"]
        RRF["Reciprocal Rank Fusion\n(Multi-Query Merging & Normalization)"]
        Reranker["Cross-Encoder Neural Reranking\n(ms-marco-MiniLM-L-6-v2)"]
    end

    subgraph GenerationLayer ["Synthesis & Evaluation Layer"]
        Gemini["Google Gemini LLM\n(gemini-3.5-flash-lite / gemini-3.5-flash)"]
        CRAG["Anti-Hallucination Guard\n(Retrieval Sufficiency Check)"]
        Streamer["Server-Sent Events (SSE)\n(Real-Time Progressive Token Streaming)"]
        RAGAS["RAGAS Evaluation Loop\n(Faithfulness, Relevancy, Precision, Recall)"]
    end

    subgraph StorageLayer ["Persistence & Cloud Infrastructure"]
        Postgres[("Supabase PostgreSQL\n(Users, Documents, Queries, Security Logs)")]
        QdrantDB[("Qdrant Cloud Managed Cluster\n(384-dim Dense Vector Embeddings)")]
    end

    %% Client Interactions
    UI -->|HTTPS / WSS| AuthGuard
    AuthGuard --> RBAC
    RBAC --> Firewall
    Firewall --> PII
    PII --> RateLimit

    %% Ingestion & Retrieval Flow
    RateLimit --> DenseQdrant
    RateLimit --> SparseBM25
    DenseQdrant --> RRF
    SparseBM25 --> RRF
    RRF --> Reranker

    %% Generation Flow
    Reranker --> CRAG
    CRAG --> Gemini
    Gemini --> Streamer
    Streamer -->|text/event-stream| UI

    %% Storage Connections
    DenseQdrant <-->|gRPC / REST| QdrantDB
    AuthGuard <-->|SQLAlchemy Async| Postgres
    SecurityGateway -.->|Audit Logs| Postgres
    GenerationLayer -.->|Benchmark Metrics| RAGAS
```

---

## ⚡ End-to-End RAG Pipeline

The NexusRAG retrieval and synthesis workflow processes every inquiry through nine deterministic stages:

```
[User Inquiry]
      │
      ▼
1. Security Screening & PII Sanitization
   ├─ Checks query against Prompt Injection & Jailbreak Classifier (<1ms)
   └─ Masks payment cards (Luhn valid), SSNs, and credentials to [REDACTED_*]
      │
      ▼
2. Contextual Query Planning
   ├─ Checks for multi-hop comparative intent (e.g. "Compare X and Y")
   └─ Decomposes multi-clause questions into 2-3 focused atomic sub-queries
      │
      ▼
3. Role-Isolated Hybrid Retrieval (Dual-Channel)
   ├─ Channel A (Dense): BAAI/bge-small-en-v1.5 cosine search in Qdrant Cloud
   │  └─ Enforces mandatory payload filter: department == user.department
   └─ Channel B (Sparse): BM25s sparse lexical search over in-memory CSC matrix
      │
      ▼
4. Reciprocal Rank Fusion (RRF)
   └─ Combines ranked outputs: RRF_score(d) = ∑ (1 / (60 + rank_i(d)))
      │
      ▼
5. Neural Cross-Encoder Reranking
   └─ Evaluates top-25 chunks with ms-marco-MiniLM-L-6-v2; retains top-5 chunks
      │
      ▼
6. Parent-Child Chunk Expansion
   └─ Merges adjacent chunks from identical documents to preserve unbroken tables and lists
      │
      ▼
7. Self-Reflective CRAG Verification
   └─ Evaluates retrieval confidence; declines gracefully if evidence is missing
      │
      ▼
8. Grounded Synthesis via Google Gemini
   └─ Generates answer with exact citation anchors [1], [2] referencing source clauses
      │
      ▼
9. Server-Sent Events (SSE) Streaming
   └─ Streams tokens progressively to the client with sub-300ms Time-To-First-Token (TTFT)
```

---

## 🛠️ Technology Stack

| Layer | Technology | Version | Purpose / Architecture Role |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **React** | `18.2.0` | Declarative component UI with stateful workspaces and responsive layouts |
| **Build Tooling** | **Vite** | `6.4.2` | Ultra-fast client bundler and HMR dev server |
| **Styling & Theme** | **Tailwind CSS** | `3.4.1` | Utility-first styling with comprehensive Dark/Light design tokens |
| **PDF Rendering** | **PDF.js** | `4.10.38` | Continuous vertical canvas rendering and binary document parsing |
| **Backend Framework** | **FastAPI** | `0.110.0` | High-performance asynchronous Python API with automatic OpenAPI specs |
| **ASGI Server** | **Uvicorn** | `0.29.0` | Production ASGI web server running async event loops |
| **Relational Database** | **PostgreSQL (Supabase)**| `15.x` | Managed user store, document metadata, audit logs, and feedback |
| **Database ORM** | **SQLAlchemy 2.0 + asyncpg**| `2.0.28` | Asynchronous database operations and connection pooling |
| **Vector Database** | **Qdrant Cloud** | `1.8.x` | Managed cloud vector database storing 384-dimensional dense vectors |
| **Semantic Embeddings** | **BAAI/bge-small-en-v1.5** | HuggingFace | 384-dimensional cosine similarity embeddings |
| **Lexical Search** | **BM25s** | `0.1.10` | In-process sparse CSC lexical retrieval for exact keywords and IDs |
| **Neural Reranker** | **Cross-Encoder** | MiniLM-L6 | `cross-encoder/ms-marco-MiniLM-L-6-v2` neural rank scorer |
| **LLM Engine** | **Google Gemini** | `gemini-3.5` | `gemini-3.5-flash-lite` primary with failover to `gemini-3.5-flash` |
| **Security & Auth** | **python-jose + passlib** | `3.3.0` | JWT token rotation (HS256) and bcrypt password hashing (`$2b$12$`) |
| **Rate Limiting** | **SlowAPI** | `0.1.9` | Per-client rate limiting and concurrency throttling |
| **E2E Browser Testing**| **Playwright** | `1.57.0` | Multi-viewport automated browser testing across desktop and mobile |
| **Unit & Integration** | **pytest + pytest-asyncio**| `8.1.1` | Asynchronous test suite covering APIs, RBAC, guardrails, and PII |

---

## 🛡️ Security & Defensive Guardrails

NexusRAG implements enterprise defense-in-depth across six distinct layers:

### 1. Multi-Tenant Vector RBAC Query Isolation
Document isolation is not filtered in application memory after retrieval. Instead, every vector query sent to Qdrant contains a cryptographically validated payload filter derived from the user's verified JWT claims:
```python
# Enforced at Qdrant vector search level (backend/app/retrieval/dense.py)
query_filter = Filter(
    must=[
        FieldCondition(
            key="department",
            match=MatchValue(value=user.department.lower())
        )
    ]
)
```
Employees in Human Resources can never receive chunks from Engineering runbooks or Finance spreadsheets, even under deliberate prompt injection.

### 2. AI Guardrail Firewall (`app/security/guardrails.py`)
- **Direct Prompt Injection Defense:** Neutralizes jailbreak patterns (`ignore previous instructions`, `DAN`, `developer mode`).
- **System Prompt Exfiltration Blocker:** Blocks attempts to leak internal system prompts, grounding rules, or delimiter schemas.
- **Fence & Delimiter Tampering Protection:** Strips fake prompt tokens (`<|im_start|>`, `<<SYS>>`, `---END CONTEXT---`).
- **Zero False Positives:** Validated across legitimate technical documentation queries without false triggers.

### 3. Real-Time PII & Secret Scrubber (`app/security/pii_scrubber.py`)
- **Payment Card Defense:** Redacts Visa, Mastercard, AMEX, and Discover numbers using Luhn checksum validation, preventing false positives on product or invoice IDs.
- **Identity & Credential Masking:** Automatically masks US Social Security Numbers (`[REDACTED_SSN]`), API keys (`sk-...`, `AIza...`, `AKIA...`), and private SSH/RSA keys.
- **Streaming Window Buffer:** Uses a sliding word-boundary window ensuring sensitive tokens split across consecutive SSE packets are never leaked.

### 4. Brute-Force Lockout & Session Revocation
- **Automatic Account Lockout:** 5 consecutive failed login attempts within a 10-minute sliding window trigger a 15-minute lock (`HTTP 423 Locked`).
- **Instant Token Revocation:** Logs out users immediately via unique JTI (JWT ID) blacklisting in Redis/in-memory store, preventing 60-minute replay attacks.
- **Admin Unlock Console:** System administrators can inspect locked accounts and execute one-click unlocks from the UI.

### 5. Enterprise HTTP Security Headers Middleware
- `X-Content-Type-Options: nosniff` (MIME spoofing defense)
- `X-Frame-Options: DENY` & `Content-Security-Policy: frame-ancestors 'self'` (Clickjacking protection with secure PDF canvas display)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (HSTS)
- `Cache-Control: no-store, no-cache, must-revalidate` on all `/auth/*` and `/admin/*` routes.

---

## 🧪 Comprehensive Testing & QA Verification

NexusRAG has completed an exhaustive 14-phase automated and manual verification audit with a **100% test pass rate across 129 automated tests**:

```text
========================================================================================
                      NEXUSRAG AUTOMATED TEST EXECUTION SUMMARY
========================================================================================
Test Suite                               Harness              Tests   Passed   Rate
----------------------------------------------------------------------------------------
Backend End-to-End API Integration       pytest-asyncio       44      44       100%
Security Guardrails & Jailbreak Probes   pytest (Custom)      18      18       100%
PII Scrubber & Luhn Algorithm Check      pytest               14      14       100%
Security Audit Logger & Account Lockout  pytest               8       8        100%
Security Headers, CSP & Anti-Caching     pytest               6       6        100%
PDF Reader & Continuous Scroll Suite     Playwright Chromium  23      23       100%
UI Layering & Multi-Viewport Suite       Playwright (7 Viewports) 16  16       100%
----------------------------------------------------------------------------------------
TOTAL AUTOMATED TEST VERIFICATIONS                            129     129      100%
========================================================================================
```

### Verified Multi-Viewport Responsiveness
The application was tested and certified across seven distinct screen resolutions:
- 🖥️ **Desktop Ultra-Wide:** `1920 x 1080` (100% Passed)
- 💻 **Standard Desktop:** `1440 x 900` (100% Passed)
- 💻 **Small Laptop:** `1366 x 768` (100% Passed)
- 💻 **Compact Laptop:** `1280 x 800` (100% Passed)
- 📱 **Tablet Landscape:** `1024 x 768` (100% Passed — adaptive button clustering)
- 📱 **Tablet Portrait:** `768 x 1024` (100% Passed — independent drawer sliding)
- 📱 **Mobile Portrait:** `375 x 667` / `390 x 844` (100% Passed — touch-friendly controls)

---

## 💻 Local Development & Setup Guide

### Prerequisites
- **Python:** `3.11+`
- **Node.js:** `18+` & `npm`
- **Google Gemini API Key:** (Obtain from [Google AI Studio](https://aistudio.google.com/))
- **PostgreSQL Database:** (Local PostgreSQL or free [Supabase](https://supabase.com/) cluster)
- **Qdrant Vector Database:** (Local Docker or free [Qdrant Cloud](https://cloud.qdrant.io/) cluster)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/46501/NexusRAG-Enterprise-AI-Knowledge-System-.git
cd NexusRAG-Enterprise-AI-Knowledge-System-
```

---

### Step 2: Configure Backend Environment
Create `backend/.env` from the provided example:
```bash
cp backend/.env.example backend/.env
```
Fill in your credentials (see [Environment Variables Reference](#-environment-variables-reference) below).

---

### Step 3: Install Backend Dependencies & Start Server
```bash
cd backend

# Create and activate Python virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server with hot reload
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI backend will start on `http://127.0.0.1:8000`.  
Interactive Swagger API documentation is available at `http://127.0.0.1:8000/docs`.

---

### Step 4: Configure Frontend & Start Development Server
In a new terminal window:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

### Step 5: Run Verification Test Suites
Verify your local installation:
```bash
# Run complete 44-point backend integration suite:
cd backend
python tests/test_complete_e2e_suite.py

# Run security guardrail suite:
python tests/test_guardrails.py

# Run Playwright end-to-end UI and PDF reader suite:
cd ../frontend
node test_reader_suite.mjs
```

---

## 🔑 Environment Variables Reference

### Backend Configuration (`backend/.env`)
| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `APP_ENV` | Application runtime environment | `development` or `production` |
| `PORT` | Local server port | `8000` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:5173,https://your-domain.vercel.app` |
| `GEMINI_API_KEY` | Google Gemini API secret key | `AIzaSy...` (from Google AI Studio) |
| `GEMINI_MODEL` | Foundation LLM model identifier | `gemini-3.5-flash-lite` |
| `GEMINI_TIMEOUT_SECONDS` | API request timeout limit | `30` |
| `DATABASE_URL` | PostgreSQL connection URI (asyncpg) | `postgresql+asyncpg://postgres:pass@db.pooler.supabase.com:6543/postgres` |
| `QDRANT_HOST` | Qdrant host URL / endpoint | `https://your-cluster.qdrant.tech` or `localhost` |
| `QDRANT_PORT` | Qdrant gRPC / HTTP port | `6333` |
| `QDRANT_API_KEY` | Qdrant Cloud API key | `your_qdrant_api_key_here` |
| `QDRANT_COLLECTION` | Qdrant vector collection name | `rag_documents` |
| `JWT_SECRET` | Secret key for signing HS256 tokens | `generate_with_openssl_rand_hex_32` |
| `JWT_EXPIRE_MINUTES`| Access token expiration lifetime | `60` |

### Frontend Configuration (`frontend/.env`)
| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base URL for FastAPI backend endpoints | `/api/v1` (local proxy) or `https://backend.onrender.com/api/v1` |

---

## 📂 Repository Structure

```text
NexusRAG-Enterprise-AI-Knowledge-System-/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/          # FastAPI route handlers (auth, query, docs, admin)
│   │   ├── core/                # Global config, constants, security dependencies
│   │   ├── db/                  # SQLAlchemy 2.0 async engine and PostgreSQL models
│   │   ├── generation/          # Google Gemini generator and streaming SSE pipeline
│   │   ├── ingestion/           # Chunking, contextual headers, and text extractors
│   │   ├── retrieval/           # Dense Qdrant search, BM25s sparse, and RRF fusion
│   │   ├── reranking/           # MiniLM cross-encoder neural reranker
│   │   └── security/            # PII scrubber, prompt injection guard, rate limiting
│   ├── data/                    # Seed document corpus (hr/, engineering/, finance/)
│   ├── scripts/                 # Utility scripts (user creation, seed ingestion)
│   ├── tests/                   # Automated pytest and integration suites
│   ├── requirements.txt         # Pinned Python package dependencies
│   └── .env.example             # Template backend environment file
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI widgets (Header, Sidebar, Modals)
│   │   │   ├── DocumentReaderModal.jsx      # Continuous PDF reader & chunk view
│   │   │   ├── DocumentComparisonModal.jsx  # Side-by-side policy matrix
│   │   │   ├── DocumentUploadModal.jsx      # Ingestion & drag-and-drop drawer
│   │   │   ├── ExportModal.jsx              # Markdown/brief export modal
│   │   │   └── WorkspaceHeader.jsx          # Responsive workspace header
│   │   ├── context/             # React Context providers (AuthContext, ThemeContext)
│   │   ├── pages/               # Application views (Landing, Login, Chat, Admin)
│   │   └── services/            # Axios API clients and streaming SSE readers
│   ├── package.json             # Pinned Node dependencies & npm scripts
│   ├── tailwind.config.js       # Custom colors, typography, and viewport breakpoints
│   └── vite.config.js           # Vite server, aliases, and development proxy
│
├── docs/
│   └── screenshots/             # Production application showcase screenshots
├── README.md                    # Project documentation & engineering showcase
└── LICENSE                      # MIT Open Source License
```

---

## 🚀 Deployment Architecture

NexusRAG is designed as a cloud-native, decoupled full-stack architecture:

- **Frontend (Vercel):** Single Page Application (SPA) deployed on Vercel's global Edge CDN, delivering sub-50ms asset delivery and automatic SSL.
- **Backend API (Render):** FastAPI application running inside a containerized Linux environment with automated health checks and restart policies.
- **Relational Data (Supabase):** Managed PostgreSQL cluster with connection pooling, automated backups, and row-level security.
- **Vector Search (Qdrant Cloud):** Managed multi-tenant Qdrant cluster with persistent vector storage, cosine similarity indexing, and high-concurrency payload filtering.

---

## 🔮 Future Roadmap

- [ ] **Multi-Modal Document Parsing:** Direct extraction of complex visual charts and embedded tables using Gemini Vision.
- [ ] **Enterprise SSO & SAML 2.0:** Direct integration with Okta, Microsoft Entra ID (Azure AD), and Google Workspace SSO.
- [ ] **Document Version Lineage:** Automated diffing across consecutive policy amendments with semantic change alerts.
- [ ] **Slack & Microsoft Teams Bots:** Dedicated conversational sidecars operating with identical RBAC within workplace chat.

---

## 👤 Author

**Om Ashok Kulkarni**  
*Full-Stack AI Engineer & Security Enthusiast*  
- **GitHub:** [@46501](https://github.com/46501)
- **Repository:** [NexusRAG — Enterprise AI Knowledge System](https://github.com/46501/NexusRAG-Enterprise-AI-Knowledge-System-)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free for personal, educational, and commercial use.
