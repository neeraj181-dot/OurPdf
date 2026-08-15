from fastapi import APIRouter, File, UploadFile, HTTPException, status, Depends
from typing import Dict, Any
from app.services.ocr_service import OCRService
from app.services.ai_provider import BaseAIProvider
from app.core.dependencies import get_ai_provider

router = APIRouter(tags=["OCR"])


def get_ocr_service(provider: BaseAIProvider = Depends(get_ai_provider)) -> OCRService:
    return OCRService(ai_provider=provider)


@router.post("/ocr")
async def ocr_pdf_document(
    file: UploadFile = File(...),
    ocr_service: OCRService = Depends(get_ocr_service),
) -> Dict[str, Any]:
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No PDF file uploaded",
        )

    filename = file.filename or "document.pdf"
    if not filename.lower().endsWith(".pdf" if hasattr(filename.lower(), "endsWith") else "pdf") and file.content_type != "application/pdf" and not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a PDF file.",
        )

    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded PDF file is empty.",
            )

        # Max file size 50MB safety check
        if len(file_bytes) > 50 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds maximum allowed limit of 50MB.",
            )

        result = ocr_service.process_pdf_bytes(file_bytes, filename=filename)
        return result
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        print(f"OCR Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process PDF OCR: {str(e)}",
        )
