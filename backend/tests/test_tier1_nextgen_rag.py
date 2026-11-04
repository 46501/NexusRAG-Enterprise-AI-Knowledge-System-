import asyncio
import io
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Ensure UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from app.db.models import RoleEnum
from app.ingestion.chunker import chunk_text, _detect_sections, Chunk
from app.retrieval.planner import (
    is_complex_query,
    decompose_query,
    fuse_multi_query_hits,
    merge_contiguous_chunks,
    _rule_based_decomposition,
)
from app.retrieval.embedder import load_embedder
from app.retrieval.reranker import load_reranker
from app.retrieval.dense import load_dense_client
from app.retrieval.sparse import load_sparse_index
from app.generation.generator import load_generator
from app.services.query_service import run_query
from app.state import init_semaphore


async def test_pillar_1_contextual_grounding():
    print("\n========================================================")
    print("PILLAR 1: CONTEXTUAL RETRIEVAL & GROUNDING TESTS")
    print("========================================================")

    sample_doc = """Apex Systems Incident Response Runbook
Effective January 1, 2026

This document defines the incident management process for Apex Systems production systems.

Severity Levels

P0 — Critical: Complete outage of a core customer-facing service sustained for more than two minutes.
P1 — High: Significant degradation of a core customer-facing service.
P2 — Medium: Partial or intermittent degradation.

On-Call Rotation

Apex Systems maintains a twenty-four-by-seven on-call rotation staffed by engineers.
Primary On-Call Engineer: The primary engineer acknowledges pages within five minutes.
Secondary On-Call Engineer: Available within ten minutes.
"""

    sections = _detect_sections(sample_doc)
    print("Detected sections:", [s[1] for s in sections])
    assert any("Severity Levels" in s[1] for s in sections), "Failed to detect 'Severity Levels' section"
    assert any("On-Call Rotation" in s[1] for s in sections), "Failed to detect 'On-Call Rotation' section"

    chunks = chunk_text(
        sample_doc,
        chunk_size=30,
        overlap=5,
        doc_title="incident_response.txt",
        department="engineering",
    )
    print(f"Generated {len(chunks)} contextual chunks")
    assert len(chunks) > 0, "No chunks produced"
    
    # Verify contextual metadata
    for i, c in enumerate(chunks):
        assert c.context_prefix, f"Chunk {i} missing context_prefix"
        assert "incident_response.txt" in c.context_prefix
        assert "engineering" in c.context_prefix
        assert c.contextual_text.startswith(c.context_prefix)
        assert c.total_chunks == len(chunks)
        print(f"Chunk {i} [Section: {c.section}]: prefix={c.context_prefix[:45]}...")

    print("✅ Pillar 1 Passed: Contextual Retrieval and Section Grounding verified!")


async def test_pillar_2_hierarchical_expansion():
    print("\n========================================================")
    print("PILLAR 2: HIERARCHICAL / PARENT-CHILD CONTEXT EXPANSION")
    print("========================================================")

    # Create two adjacent chunks from the same document with slight overlap
    chunk_0 = {
        "id": "c0",
        "text": "The incident commander leads the triage meeting and assigns roles. Technical investigation begins immediately.",
        "rerank_score": 95.0,
        "metadata": {
            "doc_id": "doc_inc_1",
            "source": "incident_response.txt",
            "role_access": "engineering",
            "chunk_index": 0,
        },
    }
    chunk_1 = {
        "id": "c1",
        "text": "Technical investigation begins immediately. Mitigations take priority over root cause identification.",
        "rerank_score": 92.0,
        "metadata": {
            "doc_id": "doc_inc_1",
            "source": "incident_response.txt",
            "role_access": "engineering",
            "chunk_index": 1,
        },
    }
    # Unrelated chunk from another document
    chunk_unrelated = {
        "id": "c_other",
        "text": "Expenses must be submitted by the 15th of each month.",
        "rerank_score": 80.0,
        "metadata": {
            "doc_id": "doc_exp_2",
            "source": "expense_policy.txt",
            "role_access": "finance",
            "chunk_index": 0,
        },
    }

    raw_candidates = [chunk_0, chunk_1, chunk_unrelated]
    expanded = merge_contiguous_chunks(raw_candidates)

    print(f"Original candidate count: {len(raw_candidates)}, Merged count: {len(expanded)}")
    assert len(expanded) == 2, f"Expected 2 merged entries, got {len(expanded)}"
    
    merged_chunk = expanded[0]
    assert merged_chunk["metadata"].get("is_expanded_context") is True
    assert merged_chunk["metadata"].get("chunk_index_range") == "0-1"
    assert "The incident commander leads the triage meeting" in merged_chunk["text"]
    assert "Mitigations take priority over root cause" in merged_chunk["text"]
    print("Merged passage text sample:", merged_chunk["text"][:120], "...")
    print("✅ Pillar 2 Passed: Adjacent chunk expansion and deduplication verified!")


async def test_pillar_3_agentic_multi_hop_planning():
    print("\n========================================================")
    print("PILLAR 3: AGENTIC MULTI-HOP QUERY PLANNING & DECOMPOSITION")
    print("========================================================")

    # 1. Complexity detector
    simple_q = "What is the meal allowance limit?"
    complex_q1 = "Compare our parental leave policy with bereavement leave and tell me who approves each"
    complex_q2 = "What are the rules for travel reimbursement as well as the daily meal allowance?"
    complex_q3 = "What is the P0 SLA target? And who is notified on call?"

    assert not is_complex_query(simple_q), "Simple query falsely flagged as complex"
    assert is_complex_query(complex_q1), "Complex comparative query not detected"
    assert is_complex_query(complex_q2), "Multi-clause query not detected"
    assert is_complex_query(complex_q3), "Multi-question query not detected"
    print("Query complexity detector passed all classification checks!")

    # 2. Rule-based fallback verification
    rule_subs = _rule_based_decomposition(complex_q1)
    print("Rule-based decomposition for comparison:", rule_subs)
    assert len(rule_subs) >= 2, "Rule-based decomposition failed to split comparison"

    # 3. LLM agentic decomposition
    llm_subs = await decompose_query(complex_q1)
    print("LLM Planner decomposed sub-queries:", llm_subs)
    assert len(llm_subs) >= 2, f"Expected >= 2 sub-queries, got {len(llm_subs)}"

    # 4. Multi-query RRF fusion
    hits_q1 = [
        {"id": "doc1_c1", "text": "Parental leave is 16 weeks fully paid.", "metadata": {"source": "leave_policy.txt", "role_access": "hr"}},
        {"id": "doc_handbook", "text": "General employee benefits overview.", "metadata": {"source": "handbook.txt", "role_access": "hr"}},
    ]
    hits_q2 = [
        {"id": "doc1_c4", "text": "Bereavement leave grants up to 5 consecutive paid days.", "metadata": {"source": "leave_policy.txt", "role_access": "hr"}},
        {"id": "doc_handbook", "text": "General employee benefits overview.", "metadata": {"source": "handbook.txt", "role_access": "hr"}},
    ]

    fused = fuse_multi_query_hits([hits_q1, hits_q2], top_k=5)
    fused_ids = [h["id"] for h in fused]
    print("Multi-query RRF fused result IDs:", fused_ids)
    assert "doc1_c1" in fused_ids, "Sub-query 1 chunk missing from fused results"
    assert "doc1_c4" in fused_ids, "Sub-query 2 chunk missing from fused results"
    assert "doc_handbook" in fused_ids, "Multi-match chunk missing"
    
    # Handbook matched both sub-queries, so it should receive multi-aspect bonus
    assert fused[0]["id"] == "doc_handbook" or fused[0]["rrf_score"] > 0.03

    print("✅ Pillar 3 Passed: Multi-hop query decomposition and RRF fusion verified!")


async def test_pillar_4_self_reflective_crag_synthesis():
    print("\n========================================================")
    print("PILLAR 4: SELF-REFLECTIVE RAG (CRAG) & MULTI-HOP SYNTHESIS")
    print("========================================================")

    # Test A: Complex multi-part policy question across HR documents
    multi_hop_query = "What are the rules regarding bereavement leave and maternity leave?"
    result = await run_query(multi_hop_query, RoleEnum.hr, top_k=4)
    print("Answer excerpt:", result["answer"][:180], "...")
    print("Sources cited:", [s["source"] for s in result["sources"]])
    print("Confidence score:", result.get("confidence_score"))
    
    assert len(result["sources"]) > 0, "No sources cited for multi-hop question"
    assert all(s["department"] == "hr" for s in result["sources"]), "Cross-department leakage in sources"
    assert result.get("confidence_score") is not None, "Missing confidence score"
    assert len(result["suggested_questions"]) >= 1, "Missing suggested questions"

    # Test B: Self-reflective handling of off-topic / non-existent company policy
    unsupported_query = "What is the company policy regarding interstellar space travel to Mars?"
    unsupported_res = await run_query(unsupported_query, RoleEnum.hr, top_k=3)
    print("Answer to ungrounded question:", unsupported_res["answer"][:120])
    
    # Must refuse or acknowledge lack of evidence, never hallucinate fake space travel policies
    ans_lower = unsupported_res["answer"].lower()
    is_safe = (
        "only answer questions based on your department" in ans_lower
        or "do not contain" in ans_lower
        or "no information" in ans_lower
        or "not mentioned" in ans_lower
        or len(unsupported_res["sources"]) == 0
    )
    assert is_safe, f"System hallucinated answer to ungrounded question: {unsupported_res['answer']}"
    print("✅ Pillar 4 Passed: Self-reflective CRAG safeguards and multi-hop synthesis verified!")


async def main():
    init_semaphore()
    load_embedder()
    load_reranker()
    load_dense_client()
    load_sparse_index()
    load_generator()

    await test_pillar_1_contextual_grounding()
    await test_pillar_2_hierarchical_expansion()
    await test_pillar_3_agentic_multi_hop_planning()
    await test_pillar_4_self_reflective_crag_synthesis()

    print("\n" + "=" * 60)
    print("🎉 ALL TIER 1 NEXT-GEN RAG TESTS PASSED SUCCESSFULLY! (4/4)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

