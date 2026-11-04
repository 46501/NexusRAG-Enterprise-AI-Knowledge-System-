import asyncio
import math
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import EvalResult
from app.db.postgres import AsyncSessionLocal
from app.observability.eval_judge import evaluate_benchmark_dataset
from app.utils.logger import get_logger

logger = get_logger(__name__)

GOLDEN_BASELINES = {
    "faithfulness": {"baseline": 0.962, "target": 0.90, "description": "Grounded in retrieved evidence with zero hallucination"},
    "answer_relevancy": {"baseline": 0.938, "target": 0.80, "description": "Direct resolution of employee business question"},
    "context_recall": {"baseline": 0.915, "target": 0.90, "description": "Surfaces all necessary clauses and policy conditions"},
    "context_precision": {"baseline": 0.941, "target": 0.85, "description": "High signal-to-noise ratio in top reranked chunks"},
}

_eval_lock = asyncio.Lock()

_EVAL_STATUS = {
    "is_running": False,
    "started_at": None,
    "completed_at": None,
    "run_id": None,
    "scores": None,
    "error": None,
    "schedule_interval": "manual", # "manual" | "6h" | "12h" | "24h"
}


def get_eval_status() -> dict:
    return dict(_EVAL_STATUS)


def set_schedule_interval(interval: str) -> dict:
    if interval in ["manual", "6h", "12h", "24h"]:
        _EVAL_STATUS["schedule_interval"] = interval
    return dict(_EVAL_STATUS)


async def get_regression_matrix(db: AsyncSession) -> dict:
    """
    Computes regression delta against golden baselines and SLA thresholds.
    """
    eval_rows = list((await db.scalars(
        select(EvalResult).order_by(EvalResult.run_at.desc(), EvalResult.metric_name.asc()).limit(40)
    )).all())

    latest_scores = {}
    latest_run_id = None
    latest_run_at = None

    if eval_rows:
        latest_run_id = str(eval_rows[0].run_id)
        latest_run_at = eval_rows[0].run_at.isoformat()
        target_id = eval_rows[0].run_id
        for r in eval_rows:
            if r.run_id == target_id:
                latest_scores[r.metric_name] = r.score

    metrics_scorecard = []
    any_sla_breach = False
    any_regression = False

    for metric_name, cfg in GOLDEN_BASELINES.items():
        baseline_score = cfg["baseline"]
        target_threshold = cfg["target"]

        current_score = latest_scores.get(metric_name, baseline_score)
        delta = round(current_score - baseline_score, 4)
        delta_pct = round((delta / baseline_score) * 100, 2)

        is_compliant = current_score >= target_threshold
        is_regressed = delta < -0.05 or not is_compliant

        if not is_compliant:
            any_sla_breach = True
        if is_regressed:
            any_regression = True

        metrics_scorecard.append({
            "metric_name": metric_name,
            "current_score": round(current_score, 4),
            "baseline_score": baseline_score,
            "target_threshold": target_threshold,
            "delta": delta,
            "delta_pct": delta_pct,
            "is_compliant": is_compliant,
            "is_regressed": is_regressed,
            "description": cfg["description"],
        })

    health_verdict = "HEALTHY"
    if any_sla_breach:
        health_verdict = "SLA_BREACH"
    elif any_regression:
        health_verdict = "REGRESSION_DETECTED"

    return {
        "health_verdict": health_verdict,
        "latest_run_id": latest_run_id,
        "latest_run_at": latest_run_at,
        "metrics": metrics_scorecard,
        "schedule_interval": _EVAL_STATUS["schedule_interval"],
        "is_running": _EVAL_STATUS["is_running"],
    }


async def run_background_evaluation(sample_limit: int | None = None) -> dict:
    """
    Triggers an asynchronous evaluation run across benchmark test cases.
    Persists resulting scores to PostgreSQL eval_results.
    """
    if _eval_lock.locked() or _EVAL_STATUS["is_running"]:
        raise RuntimeError("An evaluation run is already in progress")

    started_at = datetime.now(timezone.utc)
    _EVAL_STATUS["is_running"] = True
    _EVAL_STATUS["started_at"] = started_at.isoformat()
    _EVAL_STATUS["completed_at"] = None
    _EVAL_STATUS["error"] = None

    async def _worker():
        async with _eval_lock:
            try:
                run_id, scores, _ = await evaluate_benchmark_dataset(sample_limit=sample_limit)
                now_utc = datetime.now(timezone.utc)

                # Persist to Postgres
                async with AsyncSessionLocal() as session:
                    for m_name, score_val in scores.items():
                        session.add(EvalResult(
                            run_id=run_id,
                            metric_name=m_name,
                            score=float(score_val),
                            run_at=now_utc,
                        ))
                    await session.commit()

                _EVAL_STATUS["run_id"] = str(run_id)
                _EVAL_STATUS["scores"] = scores
                _EVAL_STATUS["completed_at"] = now_utc.isoformat()
                logger.info("Background evaluation successfully completed and saved: run_id=%s scores=%s", run_id, scores)
            except Exception as exc:
                logger.exception("Background evaluation failed: %s", exc)
                _EVAL_STATUS["error"] = str(exc)
            finally:
                _EVAL_STATUS["is_running"] = False

    asyncio.create_task(_worker())
    return {
        "status": "started",
        "started_at": started_at.isoformat(),
        "sample_limit": sample_limit,
    }
