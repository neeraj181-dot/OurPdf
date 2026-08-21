import io
import json
import pymupdf as fitz
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def create_multi_page_pdf(page_count=3) -> bytes:
    doc = fitz.open()
    for i in range(page_count):
        p = doc.new_page(width=595.28, height=841.89)
        p.insert_text((50, 80), f"Document Page {i + 1}", fontsize=20, fontname="helv")
        p.insert_text((50, 140), f"Content on page {i + 1} of {page_count}", fontsize=12, fontname="helv")
        p.insert_text((50, 700), f"Sign here: ____________________", fontsize=12, fontname="helv")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def test_multi_page_signature_signing():
    pdf_bytes = create_multi_page_pdf(3)
    
    # 1x1 transparent PNG pixel base64 for test
    sample_sig_data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    signatures = [
        {
            "page_index": 0, # Page 1
            "image_data_url": sample_sig_data_url,
            "x": 120,
            "y": 680,
            "width": 140,
            "height": 50,
        },
        {
            "page_index": 1, # Page 2
            "image_data_url": sample_sig_data_url,
            "x": 150,
            "y": 680,
            "width": 140,
            "height": 50,
        },
    ]

    print("Testing /api/tools/sign-pdf on 3-page PDF with signatures on Page 1 and Page 2...")
    res = client.post(
        "/api/tools/sign-pdf",
        files={"file": ("multi_test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"signatures": json.dumps(signatures)},
    )
    assert res.status_code == 200, f"Error: {res.status_code} - {res.text}"
    assert res.headers["content-type"] == "application/pdf"
    
    out_bytes = res.content
    assert len(out_bytes) > 500

    # Verify that the output PDF has ALL 3 pages preserved
    out_doc = fitz.open(stream=out_bytes, filetype="pdf")
    print(f"Original page count: 3 | Exported page count: {len(out_doc)}")
    assert len(out_doc) == 3, f"Expected 3 pages, got {len(out_doc)}"

    # Check images on Page 1 and Page 2
    p1_images = out_doc[0].get_images()
    p2_images = out_doc[1].get_images()
    p3_images = out_doc[2].get_images()

    print(f"Images on Page 1: {len(p1_images)} (Expected >= 1)")
    print(f"Images on Page 2: {len(p2_images)} (Expected >= 1)")
    print(f"Images on Page 3: {len(p3_images)} (Expected 0)")

    assert len(p1_images) >= 1
    assert len(p2_images) >= 1
    assert len(p3_images) == 0

    out_doc.close()
    print("\n[ALL TESTS PASSED] Multi-page PDF signing verified with 100% page preservation!")

if __name__ == "__main__":
    test_multi_page_signature_signing()
