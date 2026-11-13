import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import csv
import uuid
from datetime import datetime, timezone

from app.config import get_settings
from app.observability.eval_judge import evaluate_benchmark_dataset
from app.utils.logger import get_logger

logger = get_logger(__name__)
_s = get_settings()

RESULTS_DIR = Path(__file__).parent / "results"


def save_results_csv(scores: dict, timestamp: str) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RESULTS_DIR / f"eval_{timestamp}.csv"

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["metric", "score"])
        for metric, score in scores.items():
            writer.writerow([metric, f"{score:.4f}"])

    logger.info("Results saved to %s", out_path)
    return out_path


async def save_results_db(scores: dict, run_id: uuid.UUID, run_at: datetime) -> None:
    from app.services.admin_service import save_eval_results
    await save_eval_results(run_id, scores, run_at)


async def run_evaluation(sample_limit: int | None = None) -> tuple[uuid.UUID, dict, Path]:
    """
    Executes benchmark evaluation across golden test cases using Google Gemini as judge.
    Saves results to results/eval_<timestamp>.csv and persists scores to Postgres eval_results.
    """
    logger.info("Starting Gemini-based RAGAS evaluation across enterprise benchmark dataset...")
    run_id, scores, _ = await evaluate_benchmark_dataset(sample_limit=sample_limit)
    run_at = datetime.now(timezone.utc)
    timestamp = run_at.strftime("%Y%m%d_%H%M%S")

    out_path = save_results_csv(scores, timestamp)
    await save_results_db(scores, run_id, run_at)

    logger.info("Evaluation complete. run_id=%s csv=%s scores=%s", run_id, out_path, scores)
    return run_id, scores, out_path


async def main() -> None:
    try:
        await run_evaluation()
    except Exception as exc:
        logger.error("Evaluation failed: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
