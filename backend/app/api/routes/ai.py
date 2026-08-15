from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_ai_provider
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    OcrEnhanceRequest,
    OcrEnhanceResponse,
    SmartExtractRequest,
    SmartExtractResponse,
    SummarizeRequest,
    TranslateRequest,
    TranslateResponse,
)
from app.services.ai_provider import BaseAIProvider
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["AI"])


def get_ai_service(provider: BaseAIProvider = Depends(get_ai_provider)) -> AIService:
    return AIService(provider=provider)


@router.post("/summarize")
def summarize_pdf(
    request: SummarizeRequest,
    service: AIService = Depends(get_ai_service),
) -> Dict[str, Any]:
    if not request.pdfText:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text provided for summarization",
        )
    try:
        return service.summarize(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to generate AI summary",
        )


@router.post("/chat", response_model=ChatResponse)
def chat_with_pdf(
    request: ChatRequest,
    service: AIService = Depends(get_ai_service),
) -> ChatResponse:
    user_msg = (request.message or "").strip()
    if not user_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message is required",
        )
    try:
        return service.chat(request)
    except Exception as e:
        error_msg = str(e) or "Failed to process chat"
        if "AI_API_KEY" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AI service is not configured. Please set AI_API_KEY in backend/.env.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg,
        )


@router.post("/ocr-enhance", response_model=OcrEnhanceResponse)
def ocr_enhance(
    request: OcrEnhanceRequest,
    service: AIService = Depends(get_ai_service),
) -> OcrEnhanceResponse:
    try:
        return service.ocr_enhance(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to process OCR text",
        )


@router.post("/translate", response_model=TranslateResponse)
def translate_pdf(
    request: TranslateRequest,
    service: AIService = Depends(get_ai_service),
) -> TranslateResponse:
    if not request.pdfText or not request.targetLanguage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing text or target language",
        )
    try:
        return service.translate(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to translate content",
        )


@router.post("/smart-extract", response_model=SmartExtractResponse)
def smart_extract(
    request: SmartExtractRequest,
    service: AIService = Depends(get_ai_service),
) -> SmartExtractResponse:
    try:
        return service.smart_extract(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to extract key fields",
        )
