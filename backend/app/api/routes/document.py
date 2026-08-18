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


@router.post("/protect")
async def protect_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
    owner_password: Optional[str] = Form(None),
):
    """
    Encrypt and password-protect a PDF document using AES-256 standard encryption.
    When opened in any PDF reader, it will strictly prompt for the password.
    """
    import io
    from fastapi import Response

    user_pw = (password or "").strip()
    if not user_pw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required to protect PDF.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF file is empty.",
        )

    owner_pw = (owner_password or "").strip() or user_pw

    # 1. Try PyMuPDF AES-256 encryption
    try:
        import fitz

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        protected_bytes = doc.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw=user_pw,
            owner_pw=owner_pw,
            permissions=fitz.PDF_PERM_ACCESSIBILITY | fitz.PDF_PERM_PRINT | fitz.PDF_PERM_COPY,
        )
        doc.close()
        return Response(
            content=protected_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="protected_{file.filename or "document.pdf"}"'},
        )
    except Exception as fitz_err:
        # 2. Fallback to pypdf AES-256 encryption
        try:
            from pypdf import PdfReader, PdfWriter

            reader = PdfReader(io.BytesIO(file_bytes))
            writer = PdfWriter()
            for page in reader.pages:
                writer.add_page(page)

            if reader.metadata:
                writer.add_metadata(reader.metadata)

            writer.encrypt(
                user_password=user_pw,
                owner_password=owner_pw,
                algorithm="AES-256",
            )

            out_buf = io.BytesIO()
            writer.write(out_buf)
            protected_bytes = out_buf.getvalue()

            return Response(
                content=protected_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="protected_{file.filename or "document.pdf"}"'},
            )
        except Exception as pypdf_err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to encrypt PDF: {str(pypdf_err)}",
            )


@router.post("/unlock")
async def unlock_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
):
    """
    Unlock / decrypt a password-protected PDF document.
    """
    from fastapi import Response

    user_pw = (password or "").strip()
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF file is empty.",
        )

    try:
        import fitz

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        if doc.is_encrypted:
            success = doc.authenticate(user_pw)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Incorrect password. Please verify the password.",
                )
        unlocked_bytes = doc.tobytes()
        doc.close()
        return Response(
            content=unlocked_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="unlocked_{file.filename or "document.pdf"}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unlock PDF: {str(e)}",
        )

