from typing import List, Optional
from pydantic import BaseModel, Field


# --- Summarize ---
class SummarizeRequest(BaseModel):
    pdfText: str
    fileName: Optional[str] = "Document.pdf"
    pagesCount: Optional[int] = 1


class SummarizeResponse(BaseModel):
    title: str = ""
    summary: str = ""
    keyPoints: List[str] = Field(default_factory=list)
    actionItems: Optional[List[str]] = Field(default_factory=list)
    documentCategory: str = "Report"
    readingTimeMinutes: int = 1
    keyTopics: List[str] = Field(default_factory=list)


# --- Chat ---
class ChatMessage(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    message: str
    pdfContext: Optional[str] = ""
    history: Optional[List[ChatMessage]] = None


class ChatResponse(BaseModel):
    text: str


# --- OCR Enhance ---
class OcrEnhanceRequest(BaseModel):
    rawText: Optional[str] = None
    imageBase64: Optional[str] = None


class OcrEnhanceResponse(BaseModel):
    formattedText: str


# --- Translate ---
class TranslateRequest(BaseModel):
    pdfText: str
    targetLanguage: str


class TranslateResponse(BaseModel):
    translatedText: str


# --- Smart Extract ---
class SmartExtractRequest(BaseModel):
    pdfText: str


class ExtractedField(BaseModel):
    label: str
    value: str
    category: str
    confidence: float


class SmartExtractResponse(BaseModel):
    fields: List[ExtractedField]
