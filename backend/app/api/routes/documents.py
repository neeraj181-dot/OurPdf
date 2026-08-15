import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.history import ProcessingHistory
from app.schemas.document import DocumentOut
from app.services.auth import get_current_user
from app.services.storage import storage_service

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", response_model=List[DocumentOut])
def get_user_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all saved documents belonging to the authenticated user."""
    return db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.created_at.desc()).all()


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    operation: str = Form("upload"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a document explicitly to My Documents for the authenticated user."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    content = await file.read()
    file_size = len(content)

    # Determine file type
    file_ext = os.path.splitext(file.filename)[1].lower().replace(".", "") or "pdf"
    unique_filename = f"{uuid.uuid4().hex[:12]}_{file.filename}"

    # Save to disk via storage service
    storage_path = storage_service.save_file(
        user_id=current_user.id,
        filename=unique_filename,
        content=content,
    )

    # Create database record
    doc = Document(
        user_id=current_user.id,
        filename=unique_filename,
        original_filename=file.filename,
        file_type=file_ext,
        file_size=file_size,
        storage_path=storage_path,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Record in processing history
    history_record = ProcessingHistory(
        user_id=current_user.id,
        document_id=doc.id,
        operation=operation,
        status="completed",
    )
    db.add(history_record)
    db.commit()

    return doc


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get metadata for a specific document with ownership check."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id,
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or access denied.")
    return doc


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a document binary with strict ownership and existence verification."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id,
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or access denied.")

    file_path = storage_service.get_file_path(current_user.id, doc.filename)

    return FileResponse(
        path=str(file_path),
        filename=doc.original_filename,
        media_type="application/octet-stream",
    )


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document from storage and database with ownership check."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id,
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or access denied.")

    # Remove from storage disk
    storage_service.delete_file(current_user.id, doc.filename)

    # Remove from database
    db.delete(doc)
    db.commit()

    return {"message": "Document deleted successfully", "id": document_id}
