import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import concurrent.futures
import csv
import json
import math
import uuid
from datetime import datetime, timezone

from datasets import Dataset
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from ragas import evaluate
from ragas.metrics import (
    answer_relevancy,
    context_precision,
    context_recall,
    faithfulness,
)

from app.config import get_settings
from app.db.models import EvalResult
from app.db.postgres import AsyncSessionLocal
from app.retrieval.embedder import load_embedder
from app.retrieval.dense import load_dense_client
from app.retrieval.sparse import load_sparse_index
from app.retrieval.reranker import load_reranker
from app.retrieval.hybrid import hybrid_search
from app.retrieval.reranker import rerank
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

DATASET_PATH = Path(__file__).parent / "datasets" / "test_dataset.json"
RESULTS_DIR = Path(__file__).parent / "results"

METRICS = [faithfulness, answer_relevancy, context_recall, context_precision]


def load_dataset() -> list[dict]:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Test dataset not found: {DATASET_PATH}")
    with open(DATASET_PATH) as f:
        data = json.load(f)
    logger.info("Loaded %d test cases from %s", len(data), DATASET_PATH)
    return data


async def build_ragas_row(item: dict) -> dict:
    role = item["role"]
    query = item["question"]
    ground_truth = item["ground_truth"]

    fused = await hybrid_search(query, allowed_roles=[role], top_k=15)
    ranked = rerank(query, fused, top_k=5)

    contexts = [c["text"] for c in ranked]

    from app.generation.generator import generate
    result = await generate(query, ranked)

    return {
        "question": query,
        "answer": result["answer"],
        "contexts": contexts,
        "ground_truth": ground_truth,
    }


async def collect_rows(test_cases: list[dict]) -> list[dict]:
    rows = []
    for i, item in enumerate(test_cases):
        try:
            row = await build_ragas_row(item)
            rows.append(row)
            logger.info("Processed test case %d/%d", i + 1, len(test_cases))
        except Exception as exc:
            logger.error("Failed test case %d (%s): %s", i + 1, item.get("question", "")[:60], exc)
    return rows


def save_results_csv(scores: dict, timestamp: str) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RESULTS_DIR / f"eval_{timestamp}.csv"

    with open(out_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["metric", "score"])
        for metric, score in scores.items():
            writer.writerow([metric, f"{score:.4f}"])

    logger.info("Results saved to %s", out_path)
    return out_path


async def save_results_db(scores: dict, run_id: uuid.UUID, run_at: datetime) -> None:
    from app.services.admin_service import save_eval_results
    await save_eval_results(run_id, scores, run_at)


async def run_evaluation() -> tuple[uuid.UUID, dict, Path]:
    logger.info("Loading models...")
    load_embedder()
    load_reranker()
    load_dense_client()
    load_sparse_index()

    from app.generation.generator import load_generator
    load_generator()

    test_cases = load_dataset()
    rows = await collect_rows(test_cases)

    if not rows:
        raise RuntimeError("No rows collected, evaluation aborted.")

    dataset = Dataset.from_list(rows)

    _RAGAS_TIMEOUT = 120

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=_s.openai_api_key,
        timeout=_RAGAS_TIMEOUT,
        max_retries=1,
    )
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-small",
        api_key=_s.openai_api_key,
    )

    def _is_nan_list(v) -> bool:
        if not isinstance(v, list) or not v:
            return True
        return all(x is None or (isinstance(x, float) and math.isnan(x)) for x in v)

    def _mean(v) -> float:
        valid = [x for x in (v if isinstance(v, list) else []) if x is not None and not (isinstance(x, float) and math.isnan(x))]
        return sum(valid) / len(valid) if valid else float("nan")

    logger.info("Running RAGAS evaluation on %d samples...", len(rows))
    with concurrent.futures.ThreadPoolExecutor() as pool:
        future = pool.submit(evaluate, dataset=dataset, metrics=METRICS, llm=llm, embeddings=embeddings)
        result = future.result()

    per_metric: dict[str, list] = {m.name: result[m.name] for m in METRICS}

    nan_metrics = [m for m in METRICS if _is_nan_list(per_metric[m.name])]
    if nan_metrics:
        logger.warning("Retrying %d NaN metrics: %s", len(nan_metrics), [m.name for m in nan_metrics])
        try:
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(evaluate, dataset=dataset, metrics=nan_metrics, llm=llm, embeddings=embeddings)
                retry_result = future.result()
            for m in nan_metrics:
                retry_scores = retry_result[m.name]
                if not _is_nan_list(retry_scores):
                    per_metric[m.name] = retry_scores
                    logger.info("Retry succeeded for metric %s", m.name)
                else:
                    logger.warning("Retry also NaN for metric %s — will be skipped", m.name)
        except Exception as exc:
            logger.error("Metric retry failed: %s", exc)

    scores = {}
    for name, sample_scores in per_metric.items():
        mean = _mean(sample_scores)
        if not (isinstance(mean, float) and math.isnan(mean)):
            scores[name] = mean
            logger.info("  %-25s %.4f", name, mean)
        else:
            logger.warning("  %-25s NaN — skipping", name)

    run_id = uuid.uuid4()
    run_at = datetime.now(timezone.utc)
    timestamp = run_at.strftime("%Y%m%d_%H%M%S")

    out_path = save_results_csv(scores, timestamp)
    await save_results_db(scores, run_id, run_at)

    logger.info("Evaluation complete. run_id=%s csv=%s", run_id, out_path)
    return run_id, scores, out_path


async def main() -> None:
    try:
        await run_evaluation()
    except RuntimeError as exc:
        logger.error(str(exc))
        sys.exit(1)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
