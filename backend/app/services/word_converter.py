import os
import io
import tempfile
import mammoth
from xhtml2pdf import pisa
import pymupdf


class WordConverterService:
    @staticmethod
    def convert_word_to_pdf_bytes(file_bytes: bytes, filename: str = "document.docx") -> bytes:
        if not file_bytes or len(file_bytes) == 0:
            raise ValueError("Uploaded Word document is empty.")

        ext = filename.lower().split(".")[-1] if "." in filename else "docx"
        if ext not in ["doc", "docx"]:
            ext = "docx"

        # Strategy 1: Native Microsoft Word COM Automation (Highest fidelity for both .doc and .docx)
        try:
            import win32com.client
            import pythoncom

            pythoncom.CoInitialize()
            word = None
            try:
                word = win32com.client.DispatchEx("Word.Application")
                word.Visible = False
                word.DisplayAlerts = False

                with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tf:
                    temp_doc_path = tf.name
                    tf.write(file_bytes)

                temp_pdf_path = temp_doc_path.rsplit(".", 1)[0] + ".pdf"

                abs_doc = os.path.abspath(temp_doc_path)
                abs_pdf = os.path.abspath(temp_pdf_path)

                doc_obj = word.Documents.Open(abs_doc, ReadOnly=True, ConfirmConversions=False)
                # 17 = wdFormatPDF
                doc_obj.SaveAs(abs_pdf, FileFormat=17)
                doc_obj.Close(SaveChanges=False)

                with open(abs_pdf, "rb") as pf:
                    pdf_bytes = pf.read()

                if os.path.exists(temp_doc_path):
                    try:
                        os.remove(temp_doc_path)
                    except Exception:
                        pass

                if os.path.exists(temp_pdf_path):
                    try:
                        os.remove(temp_pdf_path)
                    except Exception:
                        pass

                if pdf_bytes and len(pdf_bytes) > 100:
                    return pdf_bytes
            finally:
                if word is not None:
                    try:
                        word.Quit()
                    except Exception:
                        pass
                try:
                    pythoncom.CoUninitialize()
                except Exception:
                    pass
        except Exception as com_err:
            print(f"Native Word COM conversion note: {com_err}. Attempting cross-platform Mammoth engine.")

        # Strategy 2: Cross-platform Mammoth + xhtml2pdf (for .docx)
        if ext == "docx" or file_bytes[:4] == b"PK\x03\x04":
            docx_file = io.BytesIO(file_bytes)
            try:
                conversion_result = mammoth.convert_to_html(docx_file)
                html_body = conversion_result.value
            except Exception as e:
                raise ValueError(f"Failed to parse Word document: {str(e)}.")

            if not html_body or not html_body.strip():
                html_body = "<p>[Word document contains no text content]</p>"

            styled_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{filename}</title>
<style>
@page {{
    size: a4 portrait;
    margin: 2cm;
}}
body {{
    font-family: Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #111827;
}}
h1 {{
    font-size: 22pt;
    color: #111827;
    margin-top: 14pt;
    margin-bottom: 12pt;
    font-weight: bold;
}}
h2 {{
    font-size: 16pt;
    color: #1f2937;
    margin-top: 14pt;
    margin-bottom: 8pt;
    font-weight: bold;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4pt;
}}
h3 {{
    font-size: 13pt;
    color: #374151;
    margin-top: 12pt;
    margin-bottom: 6pt;
    font-weight: bold;
}}
p {{
    margin-top: 0;
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
strong, b {{ font-weight: bold; }}
em, i {{ font-style: italic; }}
u {{ text-decoration: underline; }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

            pdf_stream = io.BytesIO()
            pisa_status = pisa.CreatePDF(io.StringIO(styled_html), dest=pdf_stream)
            if not pisa_status.err:
                pdf_bytes = pdf_stream.getvalue()
                if len(pdf_bytes) > 0:
                    return pdf_bytes

        raise ValueError(f"Unable to convert .{ext} file to PDF. Please ensure the document is a valid Word document.")
