import io
import json
import base64
import pymupdf as fitz
from fastapi.testclient import TestClient
from app.main import app
from app.services.pdf_tools_service import PdfToolsService

client = TestClient(app)

def create_multi_page_pdf(num_pages=38) -> bytes:
    doc = fitz.open()
    for i in range(1, num_pages + 1):
        page = doc.new_page(width=595, height=842)
        page.insert_text((50, 60), f"Heading for Section {i}", fontsize=18)
        page.insert_text((50, 100), f"This is paragraph body content on page {i}. Original unedited text.", fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def test_editor_export_38_pages_and_features():
    orig_bytes = create_multi_page_pdf(38)
    
    # 10x10 png base64
    png_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC"
    
    text_elements = [
        {
            "id": "t-1",
            "page": 1,
            "originalText": "Heading for Section 1",
            "text": "Module 3: Advanced SQL Joins & Schema",
            "level": "Title",
            "bbox": [50, 45, 300, 70],
            "fontSize": 18,
            "bold": True,
            "color": "#1DB954",
            "isEdited": True
        },
        {
            "id": "t-2",
            "page": 2,
            "originalText": "This is paragraph body content on page 2. Original unedited text.",
            "text": "This text was modified directly using the Word-style OurPdf editing canvas.",
            "bbox": [50, 90, 450, 115],
            "fontSize": 12,
            "bold": False,
            "color": "#000000",
            "highlight": "#FEF08A",
            "isEdited": True
        }
    ]
    
    headings = [
        {"id": "h-1", "page": 1, "text": "Module 3: Advanced SQL Joins", "level": "Title"},
        {"id": "h-2", "page": 2, "text": "Join in SQL", "level": "H1"},
        {"id": "h-3", "page": 8, "text": "INNER JOIN", "level": "H2"},
        {"id": "h-4", "page": 13, "text": "LEFT JOIN", "level": "H2"},
        {"id": "h-5", "page": 20, "text": "Natural Join", "level": "H2"},
    ]
    
    inserted_elements = [
        {
            "id": "ins-1",
            "type": "text",
            "page": 1,
            "x": 60,
            "y": 200,
            "width": 250,
            "height": 40,
            "text": "Inserted Note Box via Top Ribbon",
            "fontSize": 14,
            "bold": True,
            "color": "#1DB954"
        },
        {
            "id": "ins-2",
            "type": "shape",
            "shapeType": "rectangle",
            "page": 1,
            "x": 50,
            "y": 180,
            "width": 300,
            "height": 80,
            "borderColor": "#1DB954",
            "fillColor": "#F0FDF4",
            "strokeWidth": 2
        },
        {
            "id": "ins-3",
            "type": "image",
            "page": 1,
            "x": 400,
            "y": 180,
            "width": 100,
            "height": 80,
            "dataUrl": png_b64
        },
        {
            "id": "ins-4",
            "type": "signature",
            "page": 38,
            "x": 350,
            "y": 700,
            "width": 150,
            "height": 60,
            "dataUrl": png_b64
        }
    ]
    
    page_rotations = {"2": 90}
    page_order = list(range(38))
    
    files = {"file": ("Module_3.pdf", orig_bytes, "application/pdf")}
    data = {
        "title": "Module 3 - Edited Document",
        "headings": json.dumps(headings),
        "text_elements": json.dumps(text_elements),
        "inserted_elements": json.dumps(inserted_elements),
        "page_rotations": json.dumps(page_rotations),
        "page_order": json.dumps(page_order),
        "show_page_numbers": "true",
        "page_numbers_position": "bottom-center"
    }
    
    resp = client.post("/api/tools/export-organized-pdf", files=files, data=data)
    assert resp.status_code == 200, f"Export failed with {resp.status_code}: {resp.text}"
    assert resp.headers["content-type"] == "application/pdf"
    
    out_pdf_bytes = resp.content
    assert len(out_pdf_bytes) > 0
    
    # Verify with PyMuPDF
    doc = fitz.open(stream=out_pdf_bytes, filetype="pdf")
    assert len(doc) == 38, f"Expected 38 pages, got {len(doc)}"
    
    # Check page 1 text replacement
    p1_text = doc[0].get_text()
    assert "Module 3: Advanced SQL Joins & Schema" in p1_text
    
    # Check page 2 text replacement
    p2_text = doc[1].get_text()
    assert "This text was modified directly using the Word-style OurPdf editing canvas." in p2_text
    
    # Check TOC bookmarks
    toc = doc.get_toc()
    assert len(toc) == 5, f"Expected 5 TOC entries, got {len(toc)}"
    assert toc[0][1] == "Module 3: Advanced SQL Joins"
    assert toc[2][1] == "INNER JOIN"
    assert toc[2][2] == 8
    
    # Check rotation on page 2
    assert doc[1].rotation == 90
    
    doc.close()
    print("[PASS] Full 38-page Word-style PDF editing and export validation passed successfully!")

if __name__ == "__main__":
    test_editor_export_38_pages_and_features()
