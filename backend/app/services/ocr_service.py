import pymupdf as fitz
import re
from typing import List, Dict, Any, Optional
from google.genai import types
from app.services.ai_provider import BaseAIProvider, GenAIProvider


class OCRService:
    def __init__(self, ai_provider: Optional[BaseAIProvider] = None):
        self.ai_provider = ai_provider or GenAIProvider()

    def process_pdf_bytes(self, pdf_bytes: bytes, filename: str = "document.pdf") -> Dict[str, Any]:
        if not pdf_bytes:
            raise ValueError("Uploaded PDF file is empty")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            raise ValueError(f"Failed to open PDF document: {str(e)}")

        total_pages = len(doc)
        if total_pages == 0:
            raise ValueError("PDF document contains 0 pages")

        page_texts: List[str] = []
        full_text_parts: List[str] = []

        for page_num in range(total_pages):
            page = doc[page_num]
            # Extract native text
            native_text = (page.get_text() or "").strip()

            # Determine if page needs vision OCR (less than 30 readable chars)
            clean_native = re.sub(r"\s+", "", native_text)
            if len(clean_native) >= 30:
                # Text-based page
                extracted_page_text = self._clean_ocr_text(native_text)
            else:
                # Scanned image page -> render to image & perform vision OCR
                extracted_page_text = self._ocr_scanned_page(page, page_num + 1)

            page_texts.append(extracted_page_text)
            full_text_parts.append(f"--- Page {page_num + 1} ---\n{extracted_page_text}")

        doc.close()

        combined_text = "\n\n".join(full_text_parts)

        return {
            "success": True,
            "filename": filename,
            "pages": total_pages,
            "text": combined_text,
            "formattedText": combined_text,
            "page_texts": page_texts,
        }

    def _ocr_scanned_page(self, page: fitz.Page, page_number: int) -> str:
        """Render a scanned PDF page to PNG image and perform OCR using Gemini Vision AI"""
        try:
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")

            # Request Gemini vision AI to perform precision OCR
            contents = [
                types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                types.Part.from_text(
                    text=(
                        "Perform precision OCR on this document image. "
                        "Extract all text, headings, numbers, tables, dates, and paragraph structures accurately. "
                        "Fix broken line wraps within paragraphs, but preserve exact headings, bullet points, and formatting. "
                        "Return strictly the clean extracted text without meta-commentary."
                    )
                ),
            ]

            ocr_result = self.ai_provider.generate_content(prompt=contents)
            if ocr_result and ocr_result.strip():
                return self._clean_ocr_text(ocr_result)
        except Exception as e:
            print(f"Warning: Vision OCR failed for page {page_number}: {e}")

        # Fallback to page text if vision AI failed
        return (page.get_text() or f"[Page {page_number}: Scanned image - Text could not be extracted]").strip()

    def _clean_ocr_text(self, raw_text: str) -> str:
        """Clean obvious OCR line break issues without altering content"""
        if not raw_text:
            return ""

        # Normalize line endings
        text = raw_text.replace("\r\n", "\n").replace("\r", "\n")

        # Fix broken words split across line breaks with hyphens
        text = re.sub(r"(\w+)-\n(\w+)", r"\1\2", text)

        # Merge line breaks inside continuous paragraph lines
        lines = text.split("\n")
        cleaned_lines: List[str] = []
        buffer = ""

        for line in lines:
            line_str = line.strip()
            if not line_str:
                if buffer:
                    cleaned_lines.append(buffer)
                    buffer = ""
                cleaned_lines.append("")
                continue

            if not buffer:
                buffer = line_str
            else:
                # Check if current line looks like a continuation of previous line
                if (
                    not buffer.endswith((".", ":", ";", "?", "!", "---"))
                    and not line_str.startswith(("#", "-", "*", "1.", "2.", "3.", "Date:", "INVOICE", "PROJECT"))
                    and len(buffer) > 20
                ):
                    buffer += " " + line_str
                else:
                    cleaned_lines.append(buffer)
                    buffer = line_str

        if buffer:
            cleaned_lines.append(buffer)

        return "\n".join(cleaned_lines).strip()
