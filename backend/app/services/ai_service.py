import base64
import json
import re
from typing import Any, Dict, List, Optional

from google.genai import types

from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    ExtractedField,
    OcrEnhanceRequest,
    OcrEnhanceResponse,
    SmartExtractRequest,
    SmartExtractResponse,
    SummarizeRequest,
    TranslateRequest,
    TranslateResponse,
)
from app.services.ai_provider import BaseAIProvider, GenAIProvider


class AIService:
    def __init__(self, provider: Optional[BaseAIProvider] = None):
        self.provider = provider or GenAIProvider()

    def summarize(self, request: SummarizeRequest) -> Dict[str, Any]:
        file_name = request.fileName or "Document.pdf"
        pages_count = request.pagesCount or 1
        pdf_text = (request.pdfText or "")[:30000]

        prompt = f"""You are a world-class PDF Document Intelligence AI.
Analyze the following document context from file "{file_name}" ({pages_count} pages):

DOCUMENT TEXT:
{pdf_text}

Please output a comprehensive, beautifully structured JSON response with:
1. "title": Document inferred title
2. "summary": A concise executive summary (2-3 paragraphs)
3. "keyPoints": Array of 4-6 crucial bullet takeaways
4. "actionItems": Array of action items or follow-ups identified (if any)
5. "documentCategory": e.g. "Report", "Invoice", "Legal Contract", "Academic Paper", "User Manual", etc.
6. "readingTimeMinutes": Estimated reading time integer
7. "keyTopics": Array of 3-5 tags

Return strictly valid JSON matching this schema."""

        text = self.provider.generate_content(
            prompt=prompt,
            response_mime_type="application/json",
        )

        try:
            return json.loads(text or "{}")
        except Exception:
            return {}

    def chat(self, request: ChatRequest) -> ChatResponse:
        pdf_context = (request.pdfContext or "No document text available")[:35000]
        system_instruction = f"""You are SpotiPDF AI Assistant, an expert PDF document companion built into a Spotify-styled PDF Studio.
Answer questions accurately based on the provided PDF content. If the answer is directly in the document, quote or cite specific context or page hints when possible.
Be helpful, precise, clear, and engaging.

PDF DOCUMENT CONTENT:
{pdf_context}"""

        contents: List[Any] = []
        if request.history:
            for msg in request.history:
                contents.append(
                    types.Content(
                        role="user" if msg.role == "user" else "model",
                        parts=[types.Part.from_text(text=msg.text)],
                    )
                )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=request.message)],
            )
        )

        text = self.provider.generate_content(
            prompt=contents,
            system_instruction=system_instruction,
        )

        return ChatResponse(text=text)

    def ocr_enhance(self, request: OcrEnhanceRequest) -> OcrEnhanceResponse:
        if request.imageBase64:
            mime = "image/jpeg" if request.imageBase64.startswith("data:image/jpeg") else "image/png"
            base64_data = re.sub(r"^data:image/\w+;base64,", "", request.imageBase64)
            image_bytes = base64.b64decode(base64_data)

            contents = [
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime,
                ),
                types.Part.from_text(
                    text="Extract all readable text, tables, and structured data from this document image with high precision. Reformat into clean Markdown."
                ),
            ]
        else:
            contents = f"Clean up and format this raw OCR text. Fix line breaks, spelling typos, restore headings, tables, and bullet points into immaculate Markdown format:\n\n{request.rawText or ''}"

        text = self.provider.generate_content(prompt=contents)
        return OcrEnhanceResponse(formattedText=text)

    def translate(self, request: TranslateRequest) -> TranslateResponse:
        pdf_text = (request.pdfText or "")[:20000]
        prompt = f"Translate the following PDF text into {request.targetLanguage}. Maintain paragraph structure, technical terms, and clear formatting:\n\n{pdf_text}"

        text = self.provider.generate_content(prompt=prompt)
        return TranslateResponse(translatedText=text)

    def smart_extract(self, request: SmartExtractRequest) -> SmartExtractResponse:
        pdf_text = (request.pdfText or "")[:25000]
        prompt = f"""Analyze this PDF document and extract structured key fields into JSON format (e.g. key dates, monetary values, names, organization/parties, invoice/reference numbers, key legal clauses, or table items).
DOCUMENT CONTENT:
{pdf_text}

Return JSON array of extracted fields with keys: "label", "value", "category" ("date", "financial", "contact", "legal", "other"), "confidence" (0-100)."""

        text = self.provider.generate_content(
            prompt=prompt,
            response_mime_type="application/json",
        )

        try:
            raw_fields = json.loads(text or "[]")
            if isinstance(raw_fields, list):
                fields = [ExtractedField(**item) for item in raw_fields if isinstance(item, dict)]
            else:
                fields = []
        except Exception:
            fields = []

        return SmartExtractResponse(fields=fields)
