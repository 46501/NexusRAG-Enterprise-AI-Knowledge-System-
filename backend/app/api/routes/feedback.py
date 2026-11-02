from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.models import User
from app.db.postgres import get_db
from app.schemas.feedback import FeedbackItemResponse, FeedbackSubmitRequest
from app.services.admin_service import submit_feedback
from app.utils.logger import get_logger

router = APIRouter(prefix="/feedback", tags=["feedback"])
logger = get_logger(__name__)


@router.post("", response_model=FeedbackItemResponse)
async def post_feedback(
    body: FeedbackSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await submit_feedback(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        department=current_user.role,
        query_text=body.query_text,
        answer_text=body.answer_text,
        is_positive=body.is_positive,
        feedback_reason=body.feedback_reason,
        feedback_comment=body.feedback_comment,
        sources_cited=body.sources_cited,
    )
    return FeedbackItemResponse.model_validate(item)

