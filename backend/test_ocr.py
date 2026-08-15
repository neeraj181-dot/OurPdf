import pymupdf as fitz
import json
from app.services.ocr_service import OCRService

def create_sample_pdf():
    doc = fitz.open()
    
    # Page 1: Meeting notes
    p1 = doc.new_page()
    p1.insert_text((50, 50), "PROJECT MEETING NOTES\n\nDate: 14/08/2026\n\n- Discussed Q3 roadmap and feature milestones.\n- Finalized PDF document engine architecture.\n- Action item: Deploy FastAPI backend endpoints.")
    
    # Page 2: Invoice sample
    p2 = doc.new_page()
    p2.insert_text((50, 50), "INVOICE / DOCUMENT SAMPLE\n\nInvoice #: INV-2026-0091\nDate: 2026-08-14\n\nItem 1: Document Processing Suite - $499.00\nItem 2: AI Intelligence License - $299.00\nTotal Due: $798.00")
    
    # Page 3: Messy text sample
    p3 = doc.new_page()
    p3.insert_text((50, 50), "MESSY TEXT SAMPLE\n\nThis is a sample document for testing OCR text extraction.\nThe quick brown fox jumps over\nthe lazy dog.\n\nContact support@easypdf.io for technical assistance.")
    
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

if __name__ == "__main__":
    pdf_bytes = create_sample_pdf()
    ocr = OCRService()
    result = ocr.process_pdf_bytes(pdf_bytes, filename="messy_ocr_test.pdf")
    print("OCR Processing Result:")
    print(json.dumps(result, indent=2))
