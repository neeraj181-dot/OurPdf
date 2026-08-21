import io
import pymupdf as fitz

def create_full_test_pdf() -> bytes:
    doc = fitz.open()

    # Page 1: Title, Headings, and Paragraphs
    p1 = doc.new_page(width=595.28, height=841.89)
    p1.insert_text((50, 70), "OurPDF Heading Organizer Test Document", fontsize=22, fontname="hebo")
    p1.insert_text((50, 120), "1. Introduction", fontsize=16, fontname="hebo")
    p1.insert_text((50, 160), "1.1 Background", fontsize=14, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 180, 540, 230),
        "OurPDF is a document-processing platform designed to provide practical PDF tools for everyday document workflows.",
        fontsize=11,
        fontname="helv"
    )
    p1.insert_text((50, 260), "1.2 Objectives", fontsize=14, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 280, 540, 330),
        "The primary objective is to organize document files and headings.",
        fontsize=11,
        fontname="helv"
    )

    # Page 2: H1, Table, Bullet list
    p2 = doc.new_page(width=595.28, height=841.89)
    p2.insert_text((50, 70), "2. Features & Comparison", fontsize=16, fontname="hebo")
    p2.insert_text((50, 110), "Feature | Expected Result | Status", fontsize=11, fontname="hebo")
    p2.insert_text((50, 130), "Title | Updated title is saved | Verified", fontsize=11, fontname="helv")
    p2.insert_text((50, 150), "Delete | Heading is removed | Verified", fontsize=11, fontname="helv")
    p2.insert_text((50, 170), "Bookmarks | PDF outline is clickable | Verified", fontsize=11, fontname="helv")

    p2.insert_text((50, 220), "2.1 Included Workflows", fontsize=14, fontname="hebo")
    p2.insert_text((50, 250), "• Merge PDF", fontsize=11, fontname="helv")
    p2.insert_text((50, 270), "• Compress PDF", fontsize=11, fontname="helv")
    p2.insert_text((50, 290), "• Sign PDF", fontsize=11, fontname="helv")

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

if __name__ == "__main__":
    b = create_full_test_pdf()
    with open("OurPDF_Heading_Organizer_Test.pdf", "wb") as f:
        f.write(b)
    print(f"Generated OurPDF_Heading_Organizer_Test.pdf ({len(b)} bytes, 2 pages)")
