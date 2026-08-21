import pymupdf as fitz

def generate_organizer_test_pdf():
    doc = fitz.open()

    # PAGE 1
    p1 = doc.new_page(width=595.28, height=841.89)
    p1.insert_text((50, 60), "OurPDF Heading Organizer Test", fontsize=22, fontname="hebo")
    
    p1.insert_text((50, 100), "Document", fontsize=16, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 115, 545, 160),
        "This PDF is designed specifically for testing title editing, heading detection, heading hierarchy,\nreordering, page navigation, bookmarks, and PDF export.",
        fontsize=10,
        fontname="helv"
    )

    p1.insert_text((50, 180), "1. Introduction", fontsize=16, fontname="hebo")
    p1.insert_text((50, 210), "1.1 Background", fontsize=13, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 225, 545, 275),
        "OurPDF is a document-processing platform designed to provide practical PDF tools for everyday document workflows. This section provides sample content that can be used to test automatic heading detection.",
        fontsize=10,
        fontname="helv"
    )

    p1.insert_text((50, 295), "1.2 Objectives", fontsize=13, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 310, 545, 360),
        "The primary objective is to organize document titles and headings while preserving the original PDF content. Users should be able to edit, add, remove, and reorder headings.",
        fontsize=10,
        fontname="helv"
    )

    p1.insert_text((50, 380), "1.2.1 Primary Objective", fontsize=11, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 395, 545, 435),
        "Verify that heading changes made in the editor are reflected in the exported PDF.",
        fontsize=10,
        fontname="helv"
    )

    p1.insert_text((50, 455), "1.2.2 Secondary Objective", fontsize=11, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 470, 545, 510),
        "Verify that the generated PDF outline contains the expected hierarchy and destinations.",
        fontsize=10,
        fontname="helv"
    )

    p1.insert_text((50, 530), "2. Methodology", fontsize=16, fontname="hebo")
    p1.insert_text((50, 560), "2.1 Document Analysis", fontsize=13, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 575, 545, 615),
        "The test document contains multiple heading levels, numbered sections, normal body text, and enough content to exercise the heading organizer.",
        fontsize=10,
        fontname="helv"
    )

    p1.insert_text((50, 635), "2.2 Heading Detection", fontsize=13, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 650, 545, 690),
        "A heading detection system may use font size, font weight, position, numbering patterns, and surrounding text to identify likely document headings.",
        fontsize=10,
        fontname="helv"
    )

    p1.insert_text((50, 710), "2.2.1 Level Detection", fontsize=11, fontname="hebo")
    p1.insert_textbox(
        fitz.Rect(50, 725, 545, 765),
        "Large bold headings should normally be recognized as H1, smaller section headings as H2, and subordinate headings as H3.",
        fontsize=10,
        fontname="helv"
    )

    # Footer Page 1
    p1.insert_text((50, 810), "OurPDF Heading Organizer Test Page 1", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))

    # PAGE 2
    p2 = doc.new_page(width=595.28, height=841.89)

    p2.insert_text((50, 60), "3. Test Content", fontsize=16, fontname="hebo")
    p2.insert_text((50, 90), "3.1 Editing Test", fontsize=13, fontname="hebo")
    p2.insert_textbox(
        fitz.Rect(50, 105, 545, 140),
        "Try changing this heading from '3.1 Editing Test' to another heading in the OurPDF editor.",
        fontsize=10,
        fontname="helv"
    )

    p2.insert_text((50, 160), "3.2 Add Heading Test", fontsize=13, fontname="hebo")
    p2.insert_textbox(
        fitz.Rect(50, 175, 545, 210),
        "Add a new heading on this page and verify that it appears in the heading tree.",
        fontsize=10,
        fontname="helv"
    )

    p2.insert_text((50, 230), "3.3 Reordering Test", fontsize=13, fontname="hebo")
    p2.insert_textbox(
        fitz.Rect(50, 245, 545, 280),
        "Move this section above or below another section and verify that the final PDF outline uses the new order.",
        fontsize=10,
        fontname="helv"
    )

    p2.insert_text((50, 300), "4. Results", fontsize=16, fontname="hebo")
    p2.insert_text((50, 330), "4.1 Expected Results", fontsize=13, fontname="hebo")
    p2.insert_textbox(
        fitz.Rect(50, 345, 545, 385),
        "The exported PDF should preserve the original document while applying the title, heading, header, footer, page-number, and bookmark changes made by the user.",
        fontsize=10,
        fontname="helv"
    )

    p2.insert_text((50, 405), "4.2 Verification Table", fontsize=13, fontname="hebo")
    
    # Table lines (drawn and text inserted)
    table_data = [
        ("Feature", "Expected Result"),
        ("Title", "Updated title is saved"),
        ("H1 / H2 / H3", "Hierarchy is preserved"),
        ("Add Heading", "New heading appears"),
        ("Reorder", "New order is preserved"),
        ("Delete", "Heading is removed"),
        ("Bookmarks", "PDF outline is clickable"),
        ("Page Numbers", "Numbers appear on pages")
    ]

    ty = 430
    for row_idx, (col1, col2) in enumerate(table_data):
        font_style = "hebo" if row_idx == 0 else "helv"
        p2.insert_text((60, ty), col1, fontsize=9.5, fontname=font_style)
        p2.insert_text((220, ty), col2, fontsize=9.5, fontname=font_style)
        ty += 18

    p2.insert_text((50, 600), "5. Conclusion", fontsize=16, fontname="hebo")
    p2.insert_text((50, 630), "5.1 Final Verification", fontsize=13, fontname="hebo")
    p2.insert_textbox(
        fitz.Rect(50, 645, 545, 680),
        "Use this section to verify that the final heading hierarchy and bookmarks remain correct after all editing operations.",
        fontsize=10,
        fontname="helv"
    )

    p2.insert_text((50, 700), "5.2 Export Check", fontsize=13, fontname="hebo")
    p2.insert_textbox(
        fitz.Rect(50, 715, 545, 755),
        "Open the exported PDF in Adobe Acrobat, Chrome, Edge, or another standard PDF reader and inspect the bookmarks/outline panel.",
        fontsize=10,
        fontname="helv"
    )

    # Footer Page 2
    p2.insert_text((50, 810), "OurPDF Heading Organizer Test Page 2", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))

    doc.save("OurPDF_Heading_Organizer_Test.pdf")
    doc.close()
    print("Generated full OurPDF_Heading_Organizer_Test.pdf with 2 pages and all 5 sections!")

if __name__ == "__main__":
    generate_organizer_test_pdf()
