import io
import json
import pymupdf as fitz
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def create_sample_pdf() -> bytes:
    doc = fitz.open()
    
    # Page 1: Title and H1
    p1 = doc.new_page(width=595.28, height=841.89)
    p1.insert_text((50, 80), "Annual Engineering Report", fontsize=24, fontname="helv", color=(0.1, 0.1, 0.1))
    p1.insert_text((50, 140), "1. Introduction", fontsize=18, fontname="helv", color=(0.1, 0.1, 0.1))
    p1.insert_text((50, 180), "This report outlines our quarterly technical progress and system performance.", fontsize=11, fontname="helv")
    p1.insert_text((50, 240), "1.1 Project Overview", fontsize=14, fontname="helv", color=(0.1, 0.1, 0.1))
    p1.insert_text((50, 270), "The project was initiated to organize headings and titles seamlessly.", fontsize=11, fontname="helv")

    # Page 2: H1 and H2
    p2 = doc.new_page(width=595.28, height=841.89)
    p2.insert_text((50, 80), "2. Methodology", fontsize=18, fontname="helv", color=(0.1, 0.1, 0.1))
    p2.insert_text((50, 120), "We analyzed document structures, font sizes, weights, and outline trees.", fontsize=11, fontname="helv")
    p2.insert_text((50, 180), "2.1 Data Collection", fontsize=14, fontname="helv", color=(0.1, 0.1, 0.1))
    p2.insert_text((50, 210), "Structured PDF bytes were analyzed and extracted.", fontsize=11, fontname="helv")
    p2.insert_text((50, 260), "2.1.1 Sampling Strategy", fontsize=12, fontname="helv", color=(0.2, 0.2, 0.2))
    p2.insert_text((50, 290), "Random samples across diverse documents were verified.", fontsize=11, fontname="helv")

    # Page 3: H1 Conclusion
    p3 = doc.new_page(width=595.28, height=841.89)
    p3.insert_text((50, 80), "3. Conclusion", fontsize=18, fontname="helv", color=(0.1, 0.1, 0.1))
    p3.insert_text((50, 120), "All title and heading organization tools operate with high precision.", fontsize=11, fontname="helv")

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def test_heading_organizer():
    sample_bytes = create_sample_pdf()
    
    print("Testing /api/tools/detect-headings...")
    res = client.post(
        "/api/tools/detect-headings",
        files={"file": ("sample_report.pdf", io.BytesIO(sample_bytes), "application/pdf")},
    )
    assert res.status_code == 200, f"Error: {res.status_code} - {res.text}"
    data = res.json()
    
    print("Detected Title:", data.get("title"))
    print("Detected Headings Count:", len(data.get("headings", [])))
    for h in data.get("headings", []):
        print(f" - [{h['level']}] {h['text']} (Page {h['page']})")
    
    assert data["pageCount"] == 3
    assert not data["isScanned"]
    assert len(data["headings"]) >= 4

    print("\nTesting /api/tools/export-organized-pdf with modified hierarchy, header/footer, and bookmarks...")
    modified_headings = [
        {"id": "h-1", "text": "Annual Engineering Report", "level": "Title", "page": 1},
        {"id": "h-2", "text": "1. Introduction", "level": "H1", "page": 1},
        {"id": "h-3", "text": "1.1 Project Overview", "level": "H2", "page": 1},
        {"id": "h-4", "text": "2. Methodology", "level": "H1", "page": 2},
        {"id": "h-5", "text": "2.1 Data Collection", "level": "H2", "page": 2},
        {"id": "h-6", "text": "2.1.1 Sampling Strategy", "level": "H3", "page": 2},
        {"id": "h-7", "text": "3. Conclusion", "level": "H1", "page": 3},
    ]

    res_export = client.post(
        "/api/tools/export-organized-pdf",
        files={"file": ("sample_report.pdf", io.BytesIO(sample_bytes), "application/pdf")},
        data={
            "title": "Modified Engineering Report 2026",
            "headings": json.dumps(modified_headings),
            "header_text": "Company Confidential - Internal Use",
            "footer_text": "OurPdf Generated Document",
            "show_page_numbers": True,
            "page_numbers_position": "bottom-right",
            "page_order": json.dumps([0, 1, 2]),
        },
    )
    assert res_export.status_code == 200, f"Error: {res_export.status_code} - {res_export.text}"
    assert res_export.headers["content-type"] == "application/pdf"
    assert "sample_report-organized.pdf" in res_export.headers["content-disposition"]
    
    exported_bytes = res_export.content
    assert len(exported_bytes) > 500

    # Verify generated PDF structure in PyMuPDF
    out_doc = fitz.open(stream=exported_bytes, filetype="pdf")
    assert len(out_doc) == 3
    assert out_doc.metadata.get("title") == "Modified Engineering Report 2026"

    # Verify real PDF Bookmarks / Outline (TOC)
    toc = out_doc.get_toc()
    print("\nVerified Real PDF Outline / Bookmarks in Output PDF:")
    for item in toc:
        lvl, title, pnum = item[0], item[1], item[2]
        indent = "  " * (lvl - 1)
        print(f" {indent}• [Level {lvl}] {title} -> Page {pnum}")

    assert len(toc) == len(modified_headings)
    assert toc[0][1] == "Annual Engineering Report"
    assert toc[1][0] == 1 # H1 Introduction
    assert toc[2][0] == 2 # H2 Project Overview
    assert toc[5][0] == 3 # H3 Sampling Strategy
    
    out_doc.close()
    print("\n[ALL TESTS PASSED] Title & Heading Organizer Backend Endpoints fully verified!")

if __name__ == "__main__":
    test_heading_organizer()
