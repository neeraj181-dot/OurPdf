import json
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status, Depends
from app.services.ocr_service import OCRService
from app.services.ai_service import AIService
from app.schemas.ai import ChatRequest, ChatMessage
from app.services.ai_provider import BaseAIProvider
from app.core.dependencies import get_ai_provider

router = APIRouter(prefix="/document", tags=["Document Q&A"])


def get_ocr_service(provider: BaseAIProvider = Depends(get_ai_provider)) -> OCRService:
    return OCRService(ai_provider=provider)


def get_ai_service(provider: BaseAIProvider = Depends(get_ai_provider)) -> AIService:
    return AIService(provider=provider)


@router.post("/qa")
async def document_qa(
    file: Optional[UploadFile] = File(None),
    question: Optional[str] = Form(None),
    pdfContext: Optional[str] = Form(None),
    history: Optional[str] = Form(None),
    ocr_service: OCRService = Depends(get_ocr_service),
    ai_service: AIService = Depends(get_ai_service),
) -> Dict[str, Any]:
    # Support both question and message field names
    user_question = (question or "").strip()
    if not user_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question is required for document Q&A.",
        )

    context_text = pdfContext or ""

    # If context text is empty/sparse and a PDF file is provided, extract document text using OCRService
    if len(context_text.strip()) < 30 and file:
        try:
            file_bytes = await file.read()
            if len(file_bytes) > 0:
                ocr_result = ocr_service.process_pdf_bytes(file_bytes, filename=file.filename or "document.pdf")
                context_text = ocr_result.get("text") or ocr_result.get("formattedText") or ""
        except Exception as e:
            print(f"Document extraction warning: {e}")

    if not context_text.strip():
        context_text = "No document text available."

    # Parse history if JSON string
    chat_history: List[ChatMessage] = []
    if history:
        try:
            raw_history = json.loads(history)
            if isinstance(raw_history, list):
                for item in raw_history:
                    if isinstance(item, dict) and "role" in item and "text" in item:
                        chat_history.append(ChatMessage(role=item["role"], text=item["text"]))
        except Exception:
            pass

    chat_req = ChatRequest(
        message=user_question,
        pdfContext=context_text,
        history=chat_history,
    )

    try:
        chat_resp = ai_service.chat(chat_req)
        return {
            "success": True,
            "text": chat_resp.text,
            "answer": chat_resp.text,
        }
    except Exception as e:
        error_msg = str(e) or "Failed to generate answer"
        if "AI_API_KEY" in error_msg or "AI_API_KEY environment variable is not set" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AI service is not configured. Please set AI_API_KEY in backend/.env.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg,
        )


@router.post("/inpaint")
async def inpaint_image(
    image: Optional[UploadFile] = File(None),
    mask: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    mask_base64: Optional[str] = Form(None),
    method: str = Form("telea"),
    radius: int = Form(5),
    dilate: int = Form(4),
):
    """
    Seamlessly inpaint and remove watermarks/objects from image using OpenCV (Telea / Navier-Stokes).
    Supports both multipart files and base64 payloads.
    """
    import base64
    from fastapi import Response
    from app.services.inpaint_service import InpaintService

    try:
        if image and mask:
            image_bytes = await image.read()
            mask_bytes = await mask.read()
        elif image_base64 and mask_base64:
            img_b64 = image_base64.split(",")[-1]
            msk_b64 = mask_base64.split(",")[-1]
            image_bytes = base64.b64decode(img_b64)
            mask_bytes = base64.b64decode(msk_b64)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both image and mask must be provided.",
            )

        cleaned_bytes = InpaintService.remove_watermark(
            image_bytes=image_bytes,
            mask_bytes=mask_bytes,
            method=method,
            radius=radius,
            dilate=dilate,
        )

        return Response(content=cleaned_bytes, media_type="image/png")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Inpainting error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inpainting failed: {str(e)}",
        )
