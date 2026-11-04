"""
NexusRAG Tier 3: Enterprise Observability & Continuous Evaluation Engine.
Provides telemetry drift detection, native Gemini/OpenAI LLM-as-a-judge evaluation,
regression scoring against SLA baselines, and LangSmith span tracing.
"""

from app.observability.drift_detector import detect_telemetry_drift, get_observability_overview
from app.observability.eval_judge import evaluate_benchmark_dataset, run_gemini_judge_case
from app.observability.eval_scheduler import get_regression_matrix, run_background_evaluation
from app.observability.langsmith_tracer import trace_rag_query, is_langsmith_active

__all__ = [
    "detect_telemetry_drift",
    "get_observability_overview",
    "evaluate_benchmark_dataset",
    "run_gemini_judge_case",
    "get_regression_matrix",
    "run_background_evaluation",
    "trace_rag_query",
    "is_langsmith_active",
]
