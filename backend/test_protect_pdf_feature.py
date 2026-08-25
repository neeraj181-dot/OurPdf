import io
import pymupdf as fitz
from fastapi.testclient import TestClient
from app.main import app
from app.services.pdf_tools_service import PdfToolsService

client = TestClient(app)

def create_sample_pdf(pages=1, text="Secret Content") -> bytes:
    doc = fitz.open()
    for p in range(pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text((50, 50 + p * 20), f"{text} - Page {p+1}", fontsize=14)
    data = doc.tobytes()
    doc.close()
    return data

def test_protect_pdf_success_flow():
    orig_bytes = create_sample_pdf(pages=3, text="Confidential Financial Report")
    
    # 1. Send request to endpoint
    files = {"file": ("report.pdf", orig_bytes, "application/pdf")}
    data = {"password": "Test@123"}
    response = client.post("/api/tools/protect-pdf", files=files, data=data)
    
    assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
    assert response.headers["content-type"] == "application/pdf"
    assert 'filename="protected.pdf"' in response.headers.get("content-disposition", "")
    
    protected_bytes = response.content
    assert len(protected_bytes) > 0
    
    # 2. Inspect with PDF engine
    doc = fitz.open(stream=protected_bytes, filetype="pdf")
    assert doc.is_encrypted, "Document must be encrypted"
    assert doc.needs_pass, "Document must require a password"
    
    # 3. Wrong password fails
    wrong_auth = doc.authenticate("WrongPass")
    assert wrong_auth == 0, "Wrong password must be rejected"
    
    # 4. Correct password succeeds
    auth_result = doc.authenticate("Test@123")
    assert auth_result > 0, "Correct password must authenticate successfully"
    assert len(doc) == 3, f"Expected 3 pages, got {len(doc)}"
    
    # Verify text after decryption
    page1_text = doc[0].get_text()
    assert "Confidential Financial Report - Page 1" in page1_text
    doc.close()
    
    # Verify original document is untouched and unencrypted
    orig_doc = fitz.open(stream=orig_bytes, filetype="pdf")
    assert not orig_doc.is_encrypted
    orig_doc.close()
    print("[PASS] Protect PDF success flow passed!")

def test_protect_pdf_empty_password():
    orig_bytes = create_sample_pdf()
    files = {"file": ("doc.pdf", orig_bytes, "application/pdf")}
    data = {"password": ""}
    response = client.post("/api/tools/protect-pdf", files=files, data=data)
    assert response.status_code == 400
    print("[PASS] Empty password rejection passed!")

def test_protect_pdf_invalid_file():
    files = {"file": ("not_a_pdf.txt", b"This is plain text file content", "text/plain")}
    data = {"password": "Test@123"}
    response = client.post("/api/tools/protect-pdf", files=files, data=data)
    assert response.status_code == 400
    print("[PASS] Invalid file format rejection passed!")

def test_protect_pdf_empty_file():
    files = {"file": ("empty.pdf", b"", "application/pdf")}
    data = {"password": "Test@123"}
    response = client.post("/api/tools/protect-pdf", files=files, data=data)
    assert response.status_code == 400
    print("[PASS] Empty file rejection passed!")

def test_protect_pdf_multipage_and_large():
    orig_bytes = create_sample_pdf(pages=20, text="Large Multi-page Document")
    protected_bytes = PdfToolsService.protect_pdf(orig_bytes, "Complex#Pass!2026")
    
    doc = fitz.open(stream=protected_bytes, filetype="pdf")
    assert doc.is_encrypted
    assert doc.authenticate("Complex#Pass!2026") > 0
    assert len(doc) == 20
    assert "Page 20" in doc[19].get_text()
    doc.close()
    print("[PASS] Multi-page and large PDF protection passed!")

if __name__ == "__main__":
    test_protect_pdf_success_flow()
    test_protect_pdf_empty_password()
    test_protect_pdf_invalid_file()
    test_protect_pdf_empty_file()
    test_protect_pdf_multipage_and_large()
    print("\nALL PROTECT PDF TESTS PASSED SUCCESSFULLY!")
