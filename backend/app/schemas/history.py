from datetime import datetime
from pydantic import BaseModel


class HistoryCreate(BaseModel):
    operation: str
    status: str = "completed"
    document_id: int | None = None


class HistoryOut(BaseModel):
    id: int
    user_id: int
    document_id: int | None = None
    operation: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
