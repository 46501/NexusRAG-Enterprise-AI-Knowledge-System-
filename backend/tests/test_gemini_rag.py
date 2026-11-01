import asyncio
import io
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Ensure UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from app.config import get_settings
from app.db.models import RoleEnum
from app.retrieval.embedder import load_embedder
from app.retrieval.reranker import load_reranker
from app.retrieval.dense import load_dense_client, dense_search
from app.retrieval.sparse import load_sparse_index, sparse_search
from app.retrieval.hybrid import hybrid_search
from app.retrieval.reranker import rerank
from app.generation.generator import load_generator, generate, generate_stream
from app.services.query_service import run_query, run_query_stream
from app.state import init_semaphore
from app.auth.rbac import get_allowed_collections


async def run_all_tests():
    init_semaphore()
    load_embedder()
    load_reranker()
    load_dense_client()
    load_sparse_index()
    load_generator()

    print("--- TEST C: GEMINI AUTHENTICATION ---")
    ans = await generate("What is 2+2?", [])
    assert ans["answer"], "Empty answer from Gemini"
    print("Test C Passed: Gemini returned answer:", ans["answer"].strip()[:60])

    print("\n--- TEST D: STREAMING TEST ---")
    chunks = []
    async for token in generate_stream("Explain photosynthesis in two sentences.", []):
        chunks.append(token)
    assert len(chunks) > 0, "No chunks returned"
    print(f"Test D Passed: Streamed {len(chunks)} chunks, sample: {chunks[0]!r}")

    print("\n--- TEST E: RAG RETRIEVAL TEST ---")
    query = "What is the vacation and PTO policy?"
    
    # 1. Dense retrieval
    dense_hits = await dense_search(query, ["hr"], top_k=5)
    print(f"Dense retrieval returned {len(dense_hits)} hits")
    assert len(dense_hits) > 0, "Dense search failed"

    # 2. Sparse retrieval
    sparse_hits = sparse_search(query, ["hr"], top_k=5)
    print(f"Sparse retrieval returned {len(sparse_hits)} hits")
    assert len(sparse_hits) > 0, "Sparse search failed"

    # 3. Hybrid search
    hybrid_hits = await hybrid_search(query, ["hr"], top_k=5)
    print(f"Hybrid search returned {len(hybrid_hits)} hits")
    assert len(hybrid_hits) > 0, "Hybrid search failed"

    # 4. Reranking
    reranked = rerank(query, hybrid_hits, top_k=3)
    top_score = reranked[0].get("rerank_score") if reranked else None
    print(f"Reranker returned {len(reranked)} hits, top score: {top_score}")

    # 5. Full query run
    rag_result = await run_query(query, RoleEnum.hr, top_k=3)
    print("RAG Answer:", rag_result["answer"][:120])
    print("RAG Sources:", [s["source"] for s in rag_result["sources"]])
    assert len(rag_result["sources"]) > 0, "No sources in RAG answer"
    assert any("hr" in s["department"] for s in rag_result["sources"]), "HR source not found"
    print("Test E Passed: Full RAG retrieval & Gemini answer with citations!")

    print("\n--- TEST F: DEPARTMENT ACCESS (RBAC) TEST ---")
    hr_docs = await hybrid_search("policy deployment expense", ["hr"], top_k=10)
    hr_depts = {h.get("metadata", {}).get("role_access") for h in hr_docs}
    print("HR user retrieved departments:", hr_depts)
    assert hr_depts <= {"hr"}, f"HR accessed unauthorized departments: {hr_depts}"

    eng_docs = await hybrid_search("policy deployment expense", ["engineering"], top_k=10)
    eng_depts = {h.get("metadata", {}).get("role_access") for h in eng_docs}
    print("Engineering user retrieved departments:", eng_depts)
    assert eng_depts <= {"engineering"}, f"Engineering accessed unauthorized departments: {eng_depts}"

    fin_docs = await hybrid_search("policy deployment expense", ["finance"], top_k=10)
    fin_depts = {h.get("metadata", {}).get("role_access") for h in fin_docs}
    print("Finance user retrieved departments:", fin_depts)
    assert fin_depts <= {"finance"}, f"Finance accessed unauthorized departments: {fin_depts}"

    # Admin permissions
    from app.api.routes.admin import _require_admin
    admin_user = type("MockUser", (), {"role": RoleEnum.admin})()
    assert _require_admin(admin_user) is admin_user, "Admin access check failed"
    print("Admin access check: verified admin role has administrative permissions!")
    print("Test F Passed: RBAC is strictly enforced at retrieval layer and admin layer!")


if __name__ == "__main__":
    asyncio.run(run_all_tests())
