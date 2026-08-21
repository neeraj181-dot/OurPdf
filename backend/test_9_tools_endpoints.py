import io
import json
import pymupdf as fitz
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def create_sample_pdf(with_text: bool = True) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    if with_text:
        page.insert_text((50, 80), "Hello OurPdf Sample Document", fontsize=18)
        page.insert_text((50, 120), "This is sensitive content: secret_email@example.com", fontsize=12)
        page.insert_text((50, 160), "Price: $1200 | Tax: $120 | Total: $1320", fontsize=12)
    return doc.tobytes()

def test_all_9_tools():
    pdf_bytes = create_sample_pdf()
    print("Testing 9 PDF Tool Endpoints...")

    # 1. Compress PDF
    res1 = client.post(
        "/api/tools/compress-pdf",
        files={"file": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"level": "medium"},
    )
    assert res1.status_code == 200, f"Compress failed: {res1.text}"
    assert res1.headers["content-type"] == "application/pdf"
    print(f"[PASS] 1. Compress PDF - Output size: {len(res1.content)} bytes")

    # 2. OCR PDF (Searchable)
    res2 = client.post(
        "/api/tools/ocr-pdf",
        files={"file": ("scanned.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"language": "eng"},
    )
    assert res2.status_code == 200, f"OCR failed: {res2.text}"
    assert res2.headers["content-type"] == "application/pdf"
    print(f"[PASS] 2. OCR PDF - Output size: {len(res2.content)} bytes")

    # 3. Sign PDF
    dummy_sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    signatures = [{"page_index": 0, "image_data_url": dummy_sig, "x": 100, "y": 200, "width": 100, "height": 50}]
    res3 = client.post(
        "/api/tools/sign-pdf",
        files={"file": ("contract.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"signatures": json.dumps(signatures)},
    )
    assert res3.status_code == 200, f"Sign failed: {res3.text}"
    assert res3.headers["content-type"] == "application/pdf"
    print(f"[PASS] 3. Sign PDF - Output size: {len(res3.content)} bytes")

    # 4. Form Fields & Fill PDF
    res4a = client.post(
        "/api/tools/form-fields",
        files={"file": ("form.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert res4a.status_code == 200
    res4b = client.post(
        "/api/tools/fill-pdf",
        files={"file": ("form.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={
            "form_values": json.dumps({"FullName": "Jane Doe"}),
            "custom_texts": json.dumps([{"page": 0, "text": "Filled Form Text", "x": 50, "y": 250, "font_size": 12, "color": "#000000"}]),
        },
    )
    assert res4b.status_code == 200, f"Fill failed: {res4b.text}"
    assert res4b.headers["content-type"] == "application/pdf"
    print(f"[PASS] 4. Fill PDF - Output size: {len(res4b.content)} bytes")

    # 5. PDF to Excel (.xlsx)
    res5 = client.post(
        "/api/tools/pdf-to-excel",
        files={"file": ("table.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert res5.status_code == 200, f"Excel failed: {res5.text}"
    assert "spreadsheetml" in res5.headers["content-type"]
    print(f"[PASS] 5. PDF -> Excel - Output size: {len(res5.content)} bytes")

    # 6. PDF to PowerPoint (.pptx)
    res6 = client.post(
        "/api/tools/pdf-to-powerpoint",
        files={"file": ("slides.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert res6.status_code == 200, f"PowerPoint failed: {res6.text}"
    assert "presentationml" in res6.headers["content-type"]
    print(f"[PASS] 6. PDF -> PowerPoint - Output size: {len(res6.content)} bytes")

    # 7. Crop PDF
    crop_cfg = {"apply_to": "all", "crop_box": {"x": 20, "y": 20, "width": 500, "height": 700}}
    res7 = client.post(
        "/api/tools/crop-pdf",
        files={"file": ("doc.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"crop_config": json.dumps(crop_cfg)},
    )
    assert res7.status_code == 200, f"Crop failed: {res7.text}"
    assert res7.headers["content-type"] == "application/pdf"
    print(f"[PASS] 7. Crop PDF - Output size: {len(res7.content)} bytes")

    # 8. Page Numbers
    res8 = client.post(
        "/api/tools/page-numbers",
        files={"file": ("doc.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"position": "bottom-center", "format_type": "Page 1 of 10", "font_size": 10},
    )
    assert res8.status_code == 200, f"Page Numbers failed: {res8.text}"
    assert res8.headers["content-type"] == "application/pdf"
    print(f"[PASS] 8. Page Numbers - Output size: {len(res8.content)} bytes")

    # 9. Redact PDF (Permanent)
    redactions = [{"page": 0, "x": 45, "y": 105, "width": 350, "height": 30}]
    keywords = ["secret_email@example.com"]
    res9 = client.post(
        "/api/tools/redact-pdf",
        files={"file": ("doc.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"redactions": json.dumps(redactions), "keywords": json.dumps(keywords)},
    )
    assert res9.status_code == 200, f"Redact failed: {res9.text}"
    assert res9.headers["content-type"] == "application/pdf"
    
    # Verify redacted text is 100% stripped from output
    redacted_doc = fitz.open(stream=res9.content, filetype="pdf")
    redacted_text = redacted_doc[0].get_text()
    assert "secret_email@example.com" not in redacted_text, "ERROR: Sensitive text was NOT purged by redaction!"
    print(f"[PASS] 9. Redact PDF - Output size: {len(res9.content)} bytes (Verified sensitive text purged!)")

    print("\nALL 9 PDF TOOL ENDPOINTS VERIFIED & WORKING WITH ZERO ERRORS!")

if __name__ == "__main__":
    test_all_9_tools()
