import io
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from PIL import Image, ImageDraw
import mammoth
from xhtml2pdf import pisa
import pymupdf

def create_test_docx():
    doc = docx.Document()
    
    # 1. Title
    title = doc.add_heading('EasyPDF Test Document', level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # 2. Heading 1
    doc.add_heading('1. Overview & Formatting', level=1)
    
    # 3. Paragraphs with bold, italic, color
    p = doc.add_paragraph('This is a test Word document converted by EasyPDF. ')
    p.add_run('This text is bold. ').bold = True
    p.add_run('This text is italic. ').italic = True
    p.add_run('This text is underlined. ').underline = True
    
    # 4. Numbered List
    doc.add_heading('2. Key Features', level=2)
    doc.add_paragraph('Fast and reliable client & server document processing', style='List Number')
    doc.add_paragraph('Preserves headings, formatting, and tables', style='List Number')
    doc.add_paragraph('Exports standard compliant A4 PDF documents', style='List Number')
    
    # 5. Table
    doc.add_heading('3. Sample Data Table', level=2)
    table = doc.add_table(rows=3, cols=3)
    table.style = 'Table Grid'
    headers = ['Item', 'Quantity', 'Status']
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        cell.text = h
        
    data = [
        ['PDF Engine', 'v2.0', 'Active'],
        ['Word Converter', 'v1.0', 'Verified']
    ]
    for row_idx, row_data in enumerate(data, start=1):
        for col_idx, val in enumerate(row_data):
            table.cell(row_idx, col_idx).text = val
            
    # 6. Test Image
    img = Image.new('RGB', (200, 100), color=(29, 185, 84))
    draw = ImageDraw.Draw(img)
    draw.text((30, 40), "EasyPDF Logo", fill=(0, 0, 0))
    img_buf = io.BytesIO()
    img.save(img_buf, format='PNG')
    img_buf.seek(0)
    doc.add_paragraph('Embedded graphic:')
    doc.add_picture(img_buf, width=Inches(2.5))
    
    doc_buf = io.BytesIO()
    doc.save(doc_buf)
    return doc_buf.getvalue()

def convert_docx_to_pdf(docx_bytes: bytes) -> bytes:
    # 1. Convert docx to HTML with inline base64 images
    docx_file = io.BytesIO(docx_bytes)
    result = mammoth.convert_to_html(docx_file)
    html_body = result.value
    
    # 2. Wrap in print styled HTML template
    full_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {{
    size: a4 portrait;
    margin: 2cm;
}}
body {{
    font-family: Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
}}
h1 {{
    font-size: 22pt;
    color: #111827;
    margin-bottom: 12pt;
    font-weight: bold;
    text-align: center;
}}
h2 {{
    font-size: 15pt;
    color: #1f2937;
    margin-top: 14pt;
    margin-bottom: 8pt;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4pt;
}}
h3 {{
    font-size: 12pt;
    color: #374151;
    margin-top: 10pt;
    margin-bottom: 6pt;
}}
p {{
    margin-bottom: 8pt;
}}
table {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 10pt;
    margin-bottom: 12pt;
}}
th, td {{
    border: 1px solid #d1d5db;
    padding: 6pt 8pt;
    text-align: left;
    font-size: 10pt;
}}
th {{
    background-color: #f3f4f6;
    font-weight: bold;
    color: #111827;
}}
tr:nth-child(even) {{
    background-color: #fafafa;
}}
ol, ul {{
    margin-top: 4pt;
    margin-bottom: 8pt;
    padding-left: 20pt;
}}
li {{
    margin-bottom: 3pt;
}}
img {{
    max-width: 100%;
    height: auto;
    margin: 8pt 0;
}}
strong, b {{
    font-weight: bold;
}}
em, i {{
    font-style: italic;
}}
u {{
    text-decoration: underline;
}}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

    # 3. Render HTML to PDF via xhtml2pdf
    pdf_out = io.BytesIO()
    pisa_status = pisa.CreatePDF(io.StringIO(full_html), dest=pdf_out)
    if pisa_status.err:
        raise ValueError(f"xhtml2pdf error: {pisa_status.err}")
        
    return pdf_out.getvalue()

if __name__ == "__main__":
    print("1. Creating test DOCX document...")
    docx_bytes = create_test_docx()
    print(f"   Created test DOCX: {len(docx_bytes)} bytes")
    
    print("2. Converting DOCX to PDF...")
    pdf_bytes = convert_docx_to_pdf(docx_bytes)
    print(f"   Generated PDF: {len(pdf_bytes)} bytes")
    
    print("3. Validating output PDF with PyMuPDF...")
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    print(f"   PDF Page Count: {len(doc)}")
    
    text = doc[0].get_text()
    print("   Extracted Text from PDF Page 1:")
    print("   ---------------------------------")
    print(text.strip())
    print("   ---------------------------------")
    
    assert "EasyPDF Test Document" in text, "Title missing!"
    assert "Key Features" in text, "Heading missing!"
    assert "PDF Engine" in text, "Table text missing!"
    
    with open("test_converted_output.pdf", "wb") as f:
        f.write(pdf_bytes)
        
    print("SUCCESS: DOCX to PDF conversion verified 100%!")
