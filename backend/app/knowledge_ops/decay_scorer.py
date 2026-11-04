import math
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Document, QueryLog, Feedback, RoleEnum
from app.knowledge_ops.models import DocumentDecayItem, FreshnessLevel
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def calculate_document_decay_scores(
    db: AsyncSession,
    department: RoleEnum | None = None,
) -> list[DocumentDecayItem]:
    """
    Computes temporal decay, query velocity, and negative feedback correlation
    for all stored documents to evaluate freshness and obsolescence risk.
    """
    q = select(Document)
    if department:
        q = q.where(Document.department == department)
    q = q.order_by(Document.department, Document.name)
    docs = list((await db.scalars(q)).all())

    # Fetch all query logs and feedbacks for correlation
    logs = list((await db.scalars(select(QueryLog))).all())
    feedbacks = list((await db.scalars(select(Feedback))).all())

    now_utc = datetime.now(timezone.utc)
    results = []

    for d in docs:
        doc_name = d.name
        doc_uploaded_at = d.uploaded_at or now_utc

        # 1. Calculate age in days
        age_days = max(1, (now_utc - doc_uploaded_at).days)

        # 2. Query velocity (how often this document was cited)
        velocity = sum(
            1 for log in logs
            if (log.top_source and doc_name.lower() in log.top_source.lower())
            or (doc_name.lower() in (log.query_text or "").lower())
        )

        # 3. Negative feedback correlation
        neg_count = sum(
            1 for fb in feedbacks
            if not fb.is_positive
            and fb.sources_cited
            and doc_name.lower() in fb.sources_cited.lower()
        )

        # 4. Score computation (100 base)
        score = 100.0

        # Temporal decay: past 30 days, deduct 0.15 pts per day
        if age_days > 30:
            score -= (age_days - 30) * 0.15

        # Negative feedback penalty: 12 pts per complaint
        score -= neg_count * 12.0

        # Zero velocity penalty: unverified documents lose 5 pts
        if velocity == 0 and age_days > 14:
            score -= 5.0
        elif velocity > 5:
            score += 3.0 # Highly verified bonus

        score = max(15.0, min(100.0, round(score, 1)))

        # 5. Determine label
        if score >= 85.0:
            label = FreshnessLevel.fresh
        elif score >= 70.0:
            label = FreshnessLevel.degrading
        elif score >= 50.0:
            label = FreshnessLevel.stale
        else:
            label = FreshnessLevel.critical_revision

        # 6. Staleness risk factors
        risk_factors = []
        if age_days > 90:
            risk_factors.append(f"Document age is {age_days} days without recertification")
        if neg_count > 0:
            risk_factors.append(f"Correlated with {neg_count} negative feedback reports for accuracy")
        if velocity == 0:
            risk_factors.append("Zero query verification traffic in recent period")
        if not risk_factors:
            risk_factors.append("Active usage and healthy user satisfaction")

        results.append(DocumentDecayItem(
            document_name=doc_name,
            department=d.department.value,
            chunk_count=d.chunk_count,
            uploaded_at=doc_uploaded_at.isoformat(),
            query_velocity=velocity,
            negative_feedback_count=neg_count,
            freshness_score=score,
            freshness_label=label,
            staleness_risk_factors=risk_factors,
        ))

    # Sort: most decaying / stale first
    results.sort(key=lambda x: x.freshness_score)
    return results
