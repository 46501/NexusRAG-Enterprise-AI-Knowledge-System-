import asyncio
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from google import genai
from google.genai import types

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

DATASET_PATH = Path(__file__).resolve().parents[2] / "eval" / "datasets" / "test_dataset.json"


def load_test_cases() -> list[dict]:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Test dataset not found at {DATASET_PATH}")
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        cases = json.load(f)
    logger.info("Loaded %d golden benchmark cases from %s", len(cases), DATASET_PATH)
    return cases


def _get_gemini_client() -> genai.Client:
    http_opts = types.HttpOptions(timeout=_s.gemini_timeout_seconds * 1000)
    return genai.Client(api_key=_s.gemini_api_key, http_options=http_opts)


async def run_gemini_judge_case(
    question: str,
    answer: str,
    contexts: list[str],
    ground_truth: str,
) -> dict[str, float]:
    """
    Evaluates a single RAG turn using Google Gemini as an LLM judge.
    Returns calculated scores (0.0 to 1.0) for faithfulness, answer_relevancy,
    context_precision, and context_recall.
    """
    client = _get_gemini_client()

    context_str = "\n---\n".join([f"Chunk {i+1}: {c}" for i, c in enumerate(contexts[:5])])

    prompt = f"""You are an expert enterprise RAG evaluator adhering to standard RAGAS evaluation methodologies.
Evaluate the following generated answer and retrieved contexts against the user question and golden ground truth.

Question: {question}

Golden Ground Truth: {ground_truth}

Retrieved Context Chunks:
{context_str}

Generated Answer:
{answer}

Evaluate the following 4 metrics strictly between 0.00 and 1.00:
1. faithfulness: Are all factual claims made in the Generated Answer directly supported by the Retrieved Context Chunks? (1.0 = 100% supported, 0.0 = completely unsupported).
2. answer_relevancy: Does the Generated Answer directly and completely address the Question without off-topic filler? (1.0 = completely relevant, 0.0 = irrelevant).
3. context_precision: Are the most relevant context chunks placed at the beginning of the retrieved list rather than noisy chunks? (1.0 = perfect ranking, 0.0 = poor).
4. context_recall: Does the Retrieved Context contain all necessary factual details stated in the Golden Ground Truth? (1.0 = all ground truth facts found, 0.0 = none).

Return ONLY a JSON object with this exact structure:
{{
  "faithfulness": <float between 0.0 and 1.0>,
  "answer_relevancy": <float between 0.0 and 1.0>,
  "context_precision": <float between 0.0 and 1.0>,
  "context_recall": <float between 0.0 and 1.0>,
  "explanation": "<brief 1-2 sentence justification>"
}}
"""

    models_to_try = [
        _s.gemini_model,
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]

    last_err = None
    for model_name in models_to_try:
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                    max_output_tokens=1024,
                ),
            )
            raw = (response.text or "{}").strip()
            if "```" in raw:
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw).strip()
            parsed = json.loads(raw)

            f = max(0.0, min(1.0, float(parsed["faithfulness"])))
            r = max(0.0, min(1.0, float(parsed["answer_relevancy"])))
            p = max(0.0, min(1.0, float(parsed["context_precision"])))
            c = max(0.0, min(1.0, float(parsed["context_recall"])))

            return {
                "faithfulness": round(f, 4),
                "answer_relevancy": round(r, 4),
                "context_precision": round(p, 4),
                "context_recall": round(c, 4),
            }
        except Exception as exc:
            last_err = exc
            logger.warning("Gemini judge attempt failed on model=%s: %s; trying fallback", model_name, exc)
            await asyncio.sleep(0.5)

    raise RuntimeError(f"All Gemini judge models failed during evaluation: {last_err}")


async def evaluate_benchmark_dataset(
    sample_limit: int | None = None,
    progress_callback=None,
) -> tuple[uuid.UUID, dict[str, float], list[dict]]:
    """
    Executes a complete evaluation across golden enterprise test cases.
    Returns (run_id, average_scores_dict, detailed_case_results).
    """
    from app.retrieval.dense import get_client as get_dense_client
    from app.retrieval.sparse import load_sparse_index
    from app.retrieval.embedder import load_embedder
    from app.generation.generator import get_client as get_gen_client
    from app.retrieval.hybrid import hybrid_search
    from app.retrieval.reranker import rerank
    from app.generation.generator import generate

    # Ensure all backend services are loaded
    get_dense_client()
    load_sparse_index()
    load_embedder()
    get_gen_client()

    test_cases = load_test_cases()
    if sample_limit and sample_limit > 0:
        test_cases = test_cases[:sample_limit]

    logger.info("Executing continuous evaluation on %d test cases...", len(test_cases))
    case_results = []
    run_id = uuid.uuid4()

    scores_accum = {
        "faithfulness": [],
        "answer_relevancy": [],
        "context_precision": [],
        "context_recall": [],
    }

    for idx, case in enumerate(test_cases):
        q = case["question"]
        role = case["role"]
        gt = case["ground_truth"]

        if progress_callback:
            progress_callback(f"Evaluating case {idx + 1}/{len(test_cases)}: {q[:45]}...")

        try:
            # 1. Retrieval
            fused = await hybrid_search(q, allowed_roles=[role], top_k=15)
            ranked = rerank(q, fused, top_k=4)
            contexts = [c.get("text", "") for c in ranked]

            # 2. Generation
            gen_res = await generate(q, ranked)
            answer = gen_res.get("answer", "")

            # 3. Judge Evaluation
            case_scores = await run_gemini_judge_case(
                question=q,
                answer=answer,
                contexts=contexts,
                ground_truth=gt,
            )

            for m_name in scores_accum:
                scores_accum[m_name].append(case_scores[m_name])

            case_results.append({
                "case_index": idx + 1,
                "role": role,
                "question": q,
                "scores": case_scores,
                "sources_used": gen_res.get("sources", []),
            })
            logger.info(
                "Evaluated case %d/%d (%s): Faithfulness=%.3f Relevancy=%.3f Precision=%.3f Recall=%.3f",
                idx + 1,
                len(test_cases),
                role,
                case_scores["faithfulness"],
                case_scores["answer_relevancy"],
                case_scores["context_precision"],
                case_scores["context_recall"],
            )

            # Polite spacing between cases to preserve rate limits
            await asyncio.sleep(0.2)

        except Exception as exc:
            logger.error("Failed evaluation on case %d: %s", idx + 1, exc)

    # Compute averages across evaluated cases
    avg_scores = {}
    for m_name, vals in scores_accum.items():
        if not vals:
            raise RuntimeError(f"No valid evaluation scores collected for metric '{m_name}'.")
        avg_scores[m_name] = round(sum(vals) / len(vals), 4)

    logger.info("Continuous evaluation complete for run_id=%s: %s", run_id, avg_scores)
    return run_id, avg_scores, case_results
