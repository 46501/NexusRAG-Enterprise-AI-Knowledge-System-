import math
import statistics
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import QueryLog, Feedback, EvalResult, RoleEnum
from app.utils.logger import get_logger

logger = get_logger(__name__)

# SLA Baselines
BASELINE_GROUNDING_RATE_PCT = 90.0
BASELINE_AVG_LATENCY_MS = 1500.0
BASELINE_SATISFACTION_RATE_PCT = 85.0
LATENCY_P90_SLA_MS = 2500.0


def _calculate_percentiles(latencies: list[float]) -> dict[str, float]:
    if not latencies:
        return {"p50": 0.0, "p90": 0.0, "p95": 0.0, "p99": 0.0, "avg": 0.0, "max": 0.0}
    sorted_l = sorted(latencies)
    n = len(sorted_l)

    def _get_pct(p: float) -> float:
        idx = int(math.ceil(p * n) - 1)
        idx = max(0, min(idx, n - 1))
        return round(sorted_l[idx], 1)

    return {
        "p50": _get_pct(0.50),
        "p90": _get_pct(0.90),
        "p95": _get_pct(0.95),
        "p99": _get_pct(0.99),
        "avg": round(sum(sorted_l) / n, 1),
        "max": round(sorted_l[-1], 1),
    }


def _cluster_knowledge_gaps(gap_queries: list[QueryLog], negative_feedbacks: list[Feedback]) -> list[dict]:
    """
    Groups unanswered and negatively-flagged queries into actionable topic clusters.
    """
    clusters_map = {}

    # Category matching rules
    rules = [
        ("Cloud & Deployment Policies", ["deploy", "canary", "argo", "cluster", "istio", "region", "rollback", "ci/cd", "bazel"]),
        ("Outage & Incident Management", ["incident", "outage", "on-call", "pager", "p0", "p1", "sla", "postmortem", "status page"]),
        ("API Architecture & Security", ["api", "rate limit", "token", "header", "secret", "auth", "burst", "key", "encrypt"]),
        ("Compensation & Financial Guidelines", ["expense", "per diem", "meal", "reimburse", "budget", "spend", "crypto", "travel", "cap", "vendor"]),
        ("Leave, Benefits & HR Governance", ["parental", "maternity", "pto", "vacation", "bereavement", "leave", "deductible", "ppo", "hdhp", "conduct", "onboarding"]),
    ]

    combined_items = []
    for q in gap_queries:
        combined_items.append({
            "text": q.query_text,
            "department": q.department.value,
            "source_type": "ungrounded_query",
            "created_at": q.created_at,
        })
    for f in negative_feedbacks:
        combined_items.append({
            "text": f.query_text,
            "department": f.department.value,
            "source_type": f"negative_feedback ({f.feedback_reason or 'unspecified'})",
            "created_at": f.created_at,
        })

    for item in combined_items:
        text_lower = item["text"].lower()
        matched_cluster = "General Enterprise Inquiries"
        for cluster_name, keywords in rules:
            if any(kw in text_lower for kw in keywords):
                matched_cluster = cluster_name
                break

        if matched_cluster not in clusters_map:
            clusters_map[matched_cluster] = {
                "topic": matched_cluster,
                "count": 0,
                "departments": set(),
                "sample_queries": [],
                "primary_issue": "Missing relevant document chunks or incomplete policy text",
                "recommended_action": "Upload or update department policy documentation to bridge this gap",
            }

        clusters_map[matched_cluster]["count"] += 1
        clusters_map[matched_cluster]["departments"].add(item["department"])
        if len(clusters_map[matched_cluster]["sample_queries"]) < 3 and item["text"] not in clusters_map[matched_cluster]["sample_queries"]:
            clusters_map[matched_cluster]["sample_queries"].append(item["text"])

    result = []
    for c in sorted(clusters_map.values(), key=lambda x: x["count"], reverse=True):
        c["departments"] = sorted(list(c["departments"]))
        result.append(c)

    return result


async def detect_telemetry_drift(db: AsyncSession) -> dict:
    """
    Computes real-time telemetry drift across Grounding, Latency, Sentiment, and Knowledge Coverage.
    """
    # 1. Fetch query logs
    all_logs = list((await db.scalars(
        select(QueryLog).order_by(QueryLog.created_at.desc()).limit(200)
    )).all())

    total_queries = len(all_logs)
    recent_logs = all_logs[:30] if total_queries >= 30 else all_logs

    # 2. Grounding Rate Analysis
    total_grounded = sum(1 for q in all_logs if q.sources_count > 0)
    historical_grounding_pct = round((total_grounded / total_queries * 100), 1) if total_queries > 0 else 100.0

    recent_grounded = sum(1 for q in recent_logs if q.sources_count > 0)
    recent_grounding_pct = round((recent_grounded / len(recent_logs) * 100), 1) if recent_logs else historical_grounding_pct

    grounding_delta_pct = round(recent_grounding_pct - BASELINE_GROUNDING_RATE_PCT, 1)

    grounding_drift_detected = recent_grounding_pct < (BASELINE_GROUNDING_RATE_PCT - 5.0)
    grounding_status = "CRITICAL" if recent_grounding_pct < 75.0 else ("DRIFT" if grounding_drift_detected else "HEALTHY")

    # 3. Latency Percentiles & Drift
    latencies = [q.latency_ms for q in all_logs if q.latency_ms > 0]
    recent_latencies = [q.latency_ms for q in recent_logs if q.latency_ms > 0]

    all_latency_stats = _calculate_percentiles(latencies)
    recent_latency_stats = _calculate_percentiles(recent_latencies)

    latency_delta_ms = round(recent_latency_stats["avg"] - BASELINE_AVG_LATENCY_MS, 1)
    latency_drift_detected = (recent_latency_stats["p90"] > LATENCY_P90_SLA_MS) or (recent_latency_stats["avg"] > BASELINE_AVG_LATENCY_MS * 1.3)
    latency_status = "CRITICAL" if recent_latency_stats["p90"] > 4500.0 else ("DRIFT" if latency_drift_detected else "HEALTHY")

    # 4. Feedback & Sentiment Analysis
    all_feedbacks = list((await db.scalars(
        select(Feedback).order_by(Feedback.created_at.desc()).limit(100)
    )).all())

    total_feedbacks = len(all_feedbacks)
    positives = sum(1 for f in all_feedbacks if f.is_positive)
    negatives = sum(1 for f in all_feedbacks if not f.is_positive)
    satisfaction_pct = round((positives / total_feedbacks * 100), 1) if total_feedbacks > 0 else 100.0
    sentiment_delta_pct = round(satisfaction_pct - BASELINE_SATISFACTION_RATE_PCT, 1)

    reason_breakdown = {}
    for f in all_feedbacks:
        if not f.is_positive and f.feedback_reason:
            reason_breakdown[f.feedback_reason] = reason_breakdown.get(f.feedback_reason, 0) + 1

    sentiment_drift_detected = satisfaction_pct < (BASELINE_SATISFACTION_RATE_PCT - 10.0) or negatives > 10
    sentiment_status = "CRITICAL" if satisfaction_pct < 65.0 else ("DRIFT" if sentiment_drift_detected else "HEALTHY")

    # 5. Knowledge Gaps & Unanswered Topics
    gap_queries = [q for q in all_logs if q.sources_count == 0]
    negative_feedback_items = [f for f in all_feedbacks if not f.is_positive]
    gap_clusters = _cluster_knowledge_gaps(gap_queries, negative_feedback_items)

    # 6. Overall System Drift Determination
    statuses = [grounding_status, latency_status, sentiment_status]
    if "CRITICAL" in statuses:
        overall_status = "CRITICAL_REGRESSION"
        overall_summary = "Critical telemetry degradation detected. Retrieval grounding or response latency exceeds SLA limits."
    elif "DRIFT" in statuses:
        overall_status = "DRIFT_DETECTED"
        overall_summary = "Minor operational drift detected in grounding rate, latency percentiles, or user sentiment."
    else:
        overall_status = "HEALTHY"
        overall_summary = "All enterprise RAG telemetry metrics are operating within strict SLA boundaries."

    diagnostics = []
    recommendations = []

    if grounding_drift_detected:
        diagnostics.append(f"Grounding rate has drifted to {recent_grounding_pct}% (Baseline: {BASELINE_GROUNDING_RATE_PCT}%)")
        recommendations.append("Inspect ungrounded queries and upload missing policy manuals to Qdrant")
    else:
        diagnostics.append(f"Grounding rate remains strong at {recent_grounding_pct}%")

    if latency_drift_detected:
        diagnostics.append(f"P90 response latency is {recent_latency_stats['p90']}ms (SLA ceiling: {LATENCY_P90_SLA_MS}ms)")
        recommendations.append("Verify Gemini API quota or enable caching for frequent duplicate queries")
    else:
        diagnostics.append(f"Response latency is compliant (P90: {recent_latency_stats['p90']}ms, Avg: {recent_latency_stats['avg']}ms)")

    if sentiment_drift_detected:
        diagnostics.append(f"Satisfaction rate is {satisfaction_pct}% with {negatives} negative user feedbacks")
        recommendations.append("Review feedback audit trail and resolve flagged inaccurate responses")

    if not recommendations:
        recommendations.append("System is fully optimal; proceed with scheduled periodic evaluation runs.")

    return {
        "overall_status": overall_status,
        "overall_summary": overall_summary,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "query_sample_size": total_queries,
        "grounding": {
            "status": grounding_status,
            "recent_pct": recent_grounding_pct,
            "historical_pct": historical_grounding_pct,
            "baseline_pct": BASELINE_GROUNDING_RATE_PCT,
            "delta_pct": grounding_delta_pct,
            "drift_detected": grounding_drift_detected,
        },
        "latency": {
            "status": latency_status,
            "recent_stats": recent_latency_stats,
            "all_time_stats": all_latency_stats,
            "baseline_avg_ms": BASELINE_AVG_LATENCY_MS,
            "delta_avg_ms": latency_delta_ms,
            "drift_detected": latency_drift_detected,
        },
        "sentiment": {
            "status": sentiment_status,
            "satisfaction_pct": satisfaction_pct,
            "baseline_pct": BASELINE_SATISFACTION_RATE_PCT,
            "delta_pct": sentiment_delta_pct,
            "positive_count": positives,
            "negative_count": negatives,
            "unresolved_count": sum(1 for f in all_feedbacks if not f.is_resolved),
            "reason_breakdown": reason_breakdown,
            "drift_detected": sentiment_drift_detected,
        },
        "topic_gaps": gap_clusters,
        "diagnostics": diagnostics,
        "recommendations": recommendations,
    }


async def get_observability_overview(db: AsyncSession) -> dict:
    """
    Returns an aggregated payload for the Admin Observability tab.
    """
    drift_data = await detect_telemetry_drift(db)

    # Fetch latest evaluation runs
    eval_rows = list((await db.scalars(
        select(EvalResult).order_by(EvalResult.run_at.desc()).limit(20)
    )).all())

    latest_run_id = str(eval_rows[0].run_id) if eval_rows else None
    latest_run_at = eval_rows[0].run_at.isoformat() if eval_rows else None

    # Group scores by metric for latest run
    latest_scores = {}
    if eval_rows:
        target_run_id = eval_rows[0].run_id
        for r in eval_rows:
            if r.run_id == target_run_id:
                latest_scores[r.metric_name] = round(r.score, 4)

    return {
        "drift": drift_data,
        "latest_eval": {
            "run_id": latest_run_id,
            "run_at": latest_run_at,
            "scores": latest_scores,
        },
    }

