import io
import json
import base64
import fitz
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.services.pdf_tools_service import PdfToolsService

client = TestClient(app)

def create_test_pdf_with_pages(num_pages=3) -> bytes:
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text((50, 70), f"Document Test Page {i + 1}", fontsize=18, fontname="helv")
        page.draw_rect([50, 100, 545, 800], color=(0.8, 0.8, 0.8), width=1)
    out = doc.tobytes()
    doc.close()
    return out

def create_test_signature_data_uri() -> str:
    # Create transparent PNG with black ink
    img = Image.new("RGBA", (200, 80), (0, 0, 0, 0))
    for x in range(30, 170):
        img.putpixel((x, 40), (0, 0, 0, 255))
        img.putpixel((x, 41), (0, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"

def test_sign_pdf_export_and_validation():
    print("Testing Sign PDF export pipeline and standard PDF compliance...")

    pdf_bytes = create_test_pdf_with_pages(3)
    sig_data_uri = create_test_signature_data_uri()

    signatures = [
        {
            "page_index": 0,
            "image_data_url": sig_data_uri,
            "x": 60,
            "y": 600,
            "width": 150,
            "height": 60,
        },
        {
            "page_index": 1,
            "image_data_url": sig_data_uri,
            "x": 100,
            "y": 650,
            "width": 160,
            "height": 65,
        },
    ]

    # 1. Test via Service directly
    signed_bytes = PdfToolsService.apply_signatures(pdf_bytes, signatures)

    # Validations
    assert signed_bytes.startswith(b"%PDF-"), "Exported bytes must start with %PDF-"
    assert len(signed_bytes) > 500, "Exported PDF size must be valid"

    reopened_doc = fitz.open(stream=signed_bytes, filetype="pdf")
    assert len(reopened_doc) == 3, f"Expected 3 pages, got {len(reopened_doc)}"

    assert len(reopened_doc[0].get_images()) >= 1, "Page 1 must contain embedded signature image"
    assert len(reopened_doc[1].get_images()) >= 1, "Page 2 must contain embedded signature image"
    assert len(reopened_doc[2].get_images()) == 0, "Page 3 should have no signatures"

    reopened_doc.close()
    print("[PASS] Service-level signature embedding and PDF validity verified!")

    # 2. Test via FastAPI Endpoint
    resp = client.post(
        "/api/tools/sign-pdf",
        files={"file": ("test_doc.pdf", pdf_bytes, "application/pdf")},
        data={"signatures": json.dumps(signatures)},
    )

    assert resp.status_code == 200, f"API failed with {resp.status_code}: {resp.text}"
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF-")

    api_doc = fitz.open(stream=resp.content, filetype="pdf")
    assert len(api_doc) == 3
    api_doc.close()
    print("[PASS] API endpoint /api/tools/sign-pdf returned valid standard PDF!")

if __name__ == "__main__":
    test_sign_pdf_export_and_validation()
    print("\nALL SIGN PDF EXPORT VALIDATIONS PASSED SUCCESSFULLY!")
