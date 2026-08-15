from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.models.history import ProcessingHistory
from app.schemas.history import HistoryOut, HistoryCreate
from app.services.auth import get_current_user

router = APIRouter(prefix="/history", tags=["Processing History"])


@router.get("", response_model=List[HistoryOut])
def get_user_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve the authenticated user's processing activity log."""
    return (
        db.query(ProcessingHistory)
        .filter(ProcessingHistory.user_id == current_user.id)
        .order_by(ProcessingHistory.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("", response_model=HistoryOut, status_code=status.HTTP_201_CREATED)
def record_history_item(
    item_in: HistoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log an operation to the user's processing history."""
    record = ProcessingHistory(
        user_id=current_user.id,
        document_id=item_in.document_id,
        operation=item_in.operation,
        status=item_in.status,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
