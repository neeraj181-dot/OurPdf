import io
import json
import pymupdf as fitz
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def create_sample_pdf_with_paragraphs() -> bytes:
    doc = fitz.open()
    p1 = doc.new_page(width=595.28, height=841.89)
    p1.insert_text((50, 70), "OurPDF Heading Organizer Test Document", fontsize=22, fontname="hebo")
    p1.insert_text((50, 110), "1. Introduction", fontsize=16, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 130, 540, 200),
        "This PDF is designed specifically for testing title editing, heading detection, heading hierarchy, and PDF export.",
        fontsize=12,
        fontname="helv"
    )
    p1.insert_text((50, 220), "1.1 Background", fontsize=14, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 240, 540, 310),
        "The primary objective is to organize document files and headings while preserving the original PDF content.",
        fontsize=12,
        fontname="helv"
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def test_paragraph_and_all_text_editing():
    pdf_bytes = create_sample_pdf_with_paragraphs()

    print("1. Testing /api/tools/detect-headings extracting all text elements & paragraphs...")
    res = client.post(
        "/api/tools/detect-headings",
        files={"file": ("test_doc.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert res.status_code == 200, f"Error: {res.text}"
    data = res.json()

    print(f"Total Text Elements Extracted: {len(data['textElements'])}")
    print(f"Headings for Outline: {len(data['headings'])}")
    assert len(data["textElements"]) >= 4

    # 2. Modify both a heading AND a paragraph
    modified_elements = []
    for el in data["textElements"]:
        if "1. Introduction" in el["text"]:
            modified_elements.append({
                **el,
                "text": "1. Introduction to OurPDF Direct Text Editor",
                "isEdited": True,
            })
        elif "primary objective" in el["text"]:
            modified_elements.append({
                **el,
                "text": "The primary objective is to enable direct in-place editing for every text block in the PDF.",
                "isEdited": True,
            })
        else:
            modified_elements.append(el)

    print("\n2. Testing /api/tools/export-organized-pdf with modified paragraphs and headings...")
    export_res = client.post(
        "/api/tools/export-organized-pdf",
        files={"file": ("test_doc.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={
            "title": "OurPDF Document Processing Test",
            "headings": json.dumps(data["headings"]),
            "text_elements": json.dumps(modified_elements),
            "show_page_numbers": "false",
        },
    )
    assert export_res.status_code == 200
    assert export_res.headers["content-type"] == "application/pdf"

    # Verify exported PDF text
    out_doc = fitz.open(stream=export_res.content, filetype="pdf")
    page_text = out_doc[0].get_text()
    print("\nExported PDF Text Content:\n" + page_text)

    assert "1. Introduction to OurPDF Direct Text Editor" in page_text
    assert "enable direct in-place editing for every text block" in page_text
    out_doc.close()

    print("\n[ALL TESTS PASSED] In-Place PDF text & paragraph editing fully verified!")

if __name__ == "__main__":
    test_paragraph_and_all_text_editing()
