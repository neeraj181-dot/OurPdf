import fitz
import json
from app.services.ocr_service import OCRService
from app.services.ai_service import AIService
from app.schemas.ai import ChatRequest

def test_document_qa_logic():
    # 1. Create sample PDF
    doc = fitz.open()
    p1 = doc.new_page()
    p1.insert_text((50, 50), "PROJECT MEETING NOTES\n\nDate: 14/08/2026\n\n- Discussed Q3 roadmap and feature milestones.\n- Finalized PDF document engine architecture.\n- Deadline: 31st August 2026 for release.")
    
    p2 = doc.new_page()
    p2.insert_text((50, 50), "INVOICE / DOCUMENT SAMPLE\n\nInvoice #: INV-2026-0091\nDate: 2026-08-14\n\nItem 1: Document Processing Suite - $499.00\nItem 2: AI Intelligence License - $299.00\nTotal Invoice Amount: $798.00")
    
    pdf_bytes = doc.tobytes()
    doc.close()
    
    # 2. Extract document text using OCRService
    ocr = OCRService()
    ocr_result = ocr.process_pdf_bytes(pdf_bytes, filename="messy_ocr_test.pdf")
    extracted_text = ocr_result.get("text", "")
    
    print("--- Extracted Text ---")
    print(extracted_text[:300] + "...\n")
    
    ai_service = AIService()
    
    questions = [
        "What is the document about?",
        "What is the invoice amount?",
        "What is the deadline mentioned in the document?"
    ]
    
    for q in questions:
        req = ChatRequest(message=q, pdfContext=extracted_text)
        try:
            res = ai_service.chat(req)
            print(f"Q: {q}")
            print(f"A: {res.text}\n")
        except Exception as e:
            print(f"Q: {q}")
            print(f"Error: {e}\n")

if __name__ == "__main__":
    test_document_qa_logic()
