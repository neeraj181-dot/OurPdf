import io
import re
import math
import tempfile
from collections import Counter
from typing import List, Dict, Any, Optional, Union
import pymupdf as fitz
import pdfplumber
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from PIL import Image

from app.services.ocr_service import OCRService


class PdfToolsService:
    # -------------------------------------------------------------
    # TOOL 1: COMPRESS PDF
    # -------------------------------------------------------------
    @staticmethod
    def compress_pdf(pdf_bytes: bytes, level: str = "medium") -> Dict[str, Any]:
        """
        Compress PDF by deflating streams, removing unused objects, and re-encoding images.
        Levels:
          - low: Safe stream deflation & garbage collection.
          - medium: Stream compression, object deduplication, image optimization.
          - high: Maximum stream deflation, aggressive image downsampling & recompression.
        """
        if not pdf_bytes or len(pdf_bytes) == 0:
            raise ValueError("Uploaded PDF document is empty.")

        orig_size = len(pdf_bytes)

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if len(doc) == 0:
                raise ValueError("PDF contains no pages.")

            # Apply level-specific image optimization
            lvl = level.lower().strip()
            
            if lvl == "high":
                # Downsample and compress images in the document
                for page_idx in range(len(doc)):
                    page = doc[page_idx]
                    image_list = page.get_images(full=True)
                    for img_info in image_list:
                        xref = img_info[0]
                        try:
                            base_image = doc.extract_image(xref)
                            if base_image and "image" in base_image:
                                img_data = base_image["image"]
                                pil_img = Image.open(io.BytesIO(img_data))
                                
                                # Resize if large
                                if pil_img.width > 1200 or pil_img.height > 1200:
                                    pil_img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
                                
                                # Convert RGBA to RGB for JPEG if needed
                                out_buf = io.BytesIO()
                                if pil_img.mode in ("RGBA", "P"):
                                    pil_img = pil_img.convert("RGB")
                                pil_img.save(out_buf, format="JPEG", quality=60, optimize=True)
                                
                                new_bytes = out_buf.getvalue()
                                if len(new_bytes) < len(img_data):
                                    doc.update_stream(xref, new_bytes)
                        except Exception:
                            pass
            elif lvl == "medium":
                # Moderate image optimization
                for page_idx in range(len(doc)):
                    page = doc[page_idx]
                    image_list = page.get_images(full=True)
                    for img_info in image_list:
                        xref = img_info[0]
                        try:
                            base_image = doc.extract_image(xref)
                            if base_image and "image" in base_image:
                                img_data = base_image["image"]
                                pil_img = Image.open(io.BytesIO(img_data))
                                if pil_img.width > 1800 or pil_img.height > 1800:
                                    pil_img.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
                                    out_buf = io.BytesIO()
                                    if pil_img.mode in ("RGBA", "P"):
                                        pil_img = pil_img.convert("RGB")
                                    pil_img.save(out_buf, format="JPEG", quality=75, optimize=True)
                                    new_bytes = out_buf.getvalue()
                                    if len(new_bytes) < len(img_data):
                                        doc.update_stream(xref, new_bytes)
                        except Exception:
                            pass

            # Save with PyMuPDF compression options
            # deflate=True, garbage=4 (remove all unused/orphaned objects), clean=True, linear=True
            compressed_bytes = doc.tobytes(
                garbage=4,
                deflate=True,
                deflate_images=True,
                deflate_fonts=True,
                clean=True,
            )
            doc.close()

            # If compression somehow increased file size, keep original
            final_bytes = compressed_bytes if len(compressed_bytes) < orig_size else pdf_bytes
            final_size = len(final_bytes)
            saved_pct = round(((orig_size - final_size) / orig_size) * 100, 1) if orig_size > 0 else 0.0
            if saved_pct < 0:
                saved_pct = 0.0

            return {
                "bytes": final_bytes,
                "original_size": orig_size,
                "compressed_size": final_size,
                "saved_percent": max(0.0, saved_pct),
            }
        except Exception as e:
            raise ValueError(f"Failed to compress PDF: {str(e)}")

    # -------------------------------------------------------------
    # TOOL 2: OCR PDF (SEARCHABLE PDF GENERATION)
    # -------------------------------------------------------------
    @staticmethod
    def ocr_to_searchable_pdf(pdf_bytes: bytes, language: str = "eng") -> bytes:
        """
        Extracts text from scanned pages and injects an invisible searchable text layer
        onto each page, creating a real searchable PDF document.
        """
        if not pdf_bytes:
            raise ValueError("Uploaded PDF file is empty.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if len(doc) == 0:
                raise ValueError("PDF contains no pages.")

            ocr_service = OCRService()

            for page_num in range(len(doc)):
                page = doc[page_num]
                existing_text = (page.get_text() or "").strip()

                # If the page has very little native text, run OCR
                if len(re.sub(r"\s+", "", existing_text)) < 25:
                    page_text = ocr_service._ocr_scanned_page(page, page_num + 1)
                    if page_text and page_text.strip():
                        # Overlay searchable text using invisible render mode (render_mode=3)
                        # We layout lines across the page so text can be searched and copied
                        lines = [line.strip() for line in page_text.split("\n") if line.strip()]
                        y_pos = 50
                        line_height = max(12, min(24, (page.rect.height - 100) / max(len(lines), 1)))
                        for line in lines:
                            if y_pos > page.rect.height - 30:
                                break
                            try:
                                page.insert_text(
                                    (40, y_pos),
                                    line,
                                    fontsize=10,
                                    render_mode=3, # Invisible text layer for searchability
                                )
                            except Exception:
                                pass
                            y_pos += line_height

            searchable_bytes = doc.tobytes(garbage=3, deflate=True)
            doc.close()
            return searchable_bytes
        except Exception as e:
            raise ValueError(f"OCR processing failed: {str(e)}")

    # -------------------------------------------------------------
    # TOOL 3: SIGN PDF
    # -------------------------------------------------------------
    @staticmethod
    def apply_signatures(pdf_bytes: bytes, signatures: List[Dict[str, Any]]) -> bytes:
        """
        Embeds signatures (data URL or image bytes) at exact page coordinates and rotation.
        Signature dict structure:
          { page_index: int, image_data_url: str, x: float, y: float, width: float, height: float, rotation: float }
        """
        if not pdf_bytes or len(pdf_bytes) == 0:
            raise ValueError("PDF document is empty.")
        if not signatures:
            return pdf_bytes

        import io
        import base64
        from PIL import Image

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            orig_page_count = len(doc)
            if orig_page_count == 0:
                raise ValueError("PDF document contains zero pages.")

            for sig in signatures:
                page_idx = int(sig.get("page_index", 0))
                if page_idx < 0 or page_idx >= orig_page_count:
                    continue

                page = doc[page_idx]
                page_w = page.rect.width
                page_h = page.rect.height

                img_data_url = sig.get("image_data_url") or sig.get("image")
                if not img_data_url:
                    continue

                # Parse base64 data URI
                if "," in img_data_url:
                    b64_str = img_data_url.split(",", 1)[1]
                else:
                    b64_str = img_data_url

                try:
                    raw_img_bytes = base64.b64decode(b64_str)
                    pil_img = Image.open(io.BytesIO(raw_img_bytes))
                    
                    # Convert to standard RGBA PNG bytes
                    out_img_buf = io.BytesIO()
                    pil_img.save(out_img_buf, format="PNG")
                    img_bytes = out_img_buf.getvalue()
                except Exception as img_err:
                    print(f"Warning: Failed to decode signature image: {img_err}")
                    continue

                raw_x = float(sig.get("x", 100))
                raw_y = float(sig.get("y", 100))
                raw_w = max(20.0, float(sig.get("width", 150)))
                raw_h = max(10.0, float(sig.get("height", 60)))

                # Clamp to page bounds
                x0 = max(0.0, min(page_w - 10, raw_x))
                y0 = max(0.0, min(page_h - 10, raw_y))
                x1 = min(page_w, x0 + raw_w)
                y1 = min(page_h, y0 + raw_h)

                rect = fitz.Rect(x0, y0, x1, y1)

                page.insert_image(
                    rect,
                    stream=img_bytes,
                    keep_proportion=True,
                    overlay=True,
                )

            signed_bytes = doc.tobytes(garbage=3, deflate=True)
            doc.close()

            # Pre-return PDF validation
            if not signed_bytes.startswith(b"%PDF-"):
                raise ValueError("Generated file does not begin with valid %PDF header.")

            verify_doc = fitz.open(stream=signed_bytes, filetype="pdf")
            if len(verify_doc) != orig_page_count:
                verify_doc.close()
                raise ValueError(f"Exported PDF page count mismatch: Expected {orig_page_count}, got {len(verify_doc)}")
            verify_doc.close()

            return signed_bytes
        except Exception as e:
            raise ValueError(f"Failed to apply signatures: {str(e)}")

    # -------------------------------------------------------------
    # TOOL 4: FILL PDF (ACROFORM & TEXT OVERLAY)
    # -------------------------------------------------------------
    @staticmethod
    def get_form_fields(pdf_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Detects all interactive form fields (AcroForm widgets) in the PDF.
        """
        if not pdf_bytes:
            raise ValueError("PDF document is empty.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            fields: List[Dict[str, Any]] = []

            for page_idx in range(len(doc)):
                page = doc[page_idx]
                for widget in page.widgets():
                    field_type_str = "text"
                    if widget.field_type in (fitz.PDF_WIDGET_TYPE_CHECKBOX,):
                        field_type_str = "checkbox"
                    elif widget.field_type in (fitz.PDF_WIDGET_TYPE_RADIOBUTTON,):
                        field_type_str = "radio"
                    elif widget.field_type in (fitz.PDF_WIDGET_TYPE_COMBOBOX, fitz.PDF_WIDGET_TYPE_LISTBOX):
                        field_type_str = "select"

                    fields.append({
                        "name": widget.field_name or f"Field_{len(fields) + 1}",
                        "value": widget.field_value or "",
                        "type": field_type_str,
                        "page": page_idx,
                        "rect": [widget.rect.x0, widget.rect.y0, widget.rect.x1, widget.rect.y1],
                        "choices": widget.choice_values if hasattr(widget, "choice_values") else [],
                    })

            doc.close()
            return fields
        except Exception as e:
            raise ValueError(f"Failed to inspect PDF form fields: {str(e)}")

    @staticmethod
    def fill_pdf(
        pdf_bytes: bytes,
        form_values: Dict[str, Any] = None,
        custom_texts: List[Dict[str, Any]] = None,
    ) -> bytes:
        """
        Updates form field values and inserts arbitrary text fields, then flattens/saves.
        """
        if not pdf_bytes:
            raise ValueError("PDF document is empty.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")

            # 1. Fill detected AcroForm fields
            if form_values:
                for page in doc:
                    for widget in page.widgets():
                        name = widget.field_name
                        if name and name in form_values:
                            val = form_values[name]
                            if widget.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                                widget.field_value = bool(val)
                            else:
                                widget.field_value = str(val)
                            widget.update()

            # 2. Insert custom placed texts
            if custom_texts:
                for item in custom_texts:
                    page_idx = int(item.get("page", 0))
                    if page_idx < 0 or page_idx >= len(doc):
                        continue
                    page = doc[page_idx]
                    text = item.get("text", "")
                    x = float(item.get("x", 50))
                    y = float(item.get("y", 50))
                    font_size = float(item.get("font_size", 12))
                    color_hex = item.get("color", "#111827").lstrip("#")
                    
                    try:
                        r = int(color_hex[0:2], 16) / 255.0
                        g = int(color_hex[2:4], 16) / 255.0
                        b = int(color_hex[4:6], 16) / 255.0
                    except Exception:
                        r, g, b = 0, 0, 0

                    page.insert_text((x, y), text, fontsize=font_size, color=(r, g, b))

            filled_bytes = doc.tobytes(garbage=3, deflate=True)
            doc.close()
            return filled_bytes
        except Exception as e:
            raise ValueError(f"Failed to fill PDF: {str(e)}")

    # -------------------------------------------------------------
    # TOOL 5: PDF → EXCEL (.XLSX)
    # -------------------------------------------------------------
    @staticmethod
    def pdf_to_excel(pdf_bytes: bytes) -> bytes:
        """
        Extracts structured tables from PDF pages and creates a multi-sheet formatted Excel workbook (.xlsx).
        """
        if not pdf_bytes:
            raise ValueError("PDF document is empty.")

        try:
            wb = openpyxl.Workbook()
            # Remove default sheet
            wb.remove(wb.active)

            header_fill = PatternFill(start_color="1DB954", end_color="1DB954", fill_type="solid")
            header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
            cell_font = Font(name="Calibri", size=11)
            thin_border = Border(
                left=Side(style="thin", color="E5E7EB"),
                right=Side(style="thin", color="E5E7EB"),
                top=Side(style="thin", color="E5E7EB"),
                bottom=Side(style="thin", color="E5E7EB"),
            )

            table_count = 0

            # 1. Strategy 1: pdfplumber table extraction (High accuracy on borders & text)
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page_idx, page in enumerate(pdf.pages):
                    extracted_tables = page.extract_tables()
                    
                    for t_idx, table_data in enumerate(extracted_tables):
                        if not table_data or len(table_data) == 0:
                            continue

                        table_count += 1
                        sheet_title = f"Page_{page_idx + 1}_T{t_idx + 1}"[:31]
                        ws = wb.create_sheet(title=sheet_title)

                        for r_idx, row in enumerate(table_data):
                            cleaned_row = [str(cell).strip() if cell is not None else "" for cell in row]
                            ws.append(cleaned_row)

                            # Style row
                            current_row_idx = r_idx + 1
                            for c_idx in range(1, len(cleaned_row) + 1):
                                cell_obj = ws.cell(row=current_row_idx, column=c_idx)
                                cell_obj.border = thin_border
                                if current_row_idx == 1:
                                    cell_obj.fill = header_fill
                                    cell_obj.font = header_font
                                    cell_obj.alignment = Alignment(horizontal="center", vertical="center")
                                else:
                                    cell_obj.font = cell_font
                                    cell_obj.alignment = Alignment(vertical="center")

                        # Auto-fit column widths
                        for col in ws.columns:
                            max_len = max(len(str(cell.value or "")) for cell in col)
                            col_letter = get_column_letter(col[0].column)
                            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

            # Fallback if no visual table borders were detected: PyMuPDF table finder or line-by-line tabular parsing
            if table_count == 0:
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                for page_idx in range(len(doc)):
                    page = doc[page_idx]
                    tabs = page.find_tables()
                    for t_idx, tab in enumerate(tabs):
                        table_count += 1
                        ws = wb.create_sheet(title=f"Page_{page_idx + 1}_T{t_idx + 1}"[:31])
                        table_df_rows = tab.extract()
                        for r_idx, row in enumerate(table_df_rows):
                            ws.append([str(c or "").strip() for c in row])

                # If still empty, extract text lines into columns
                if table_count == 0:
                    ws = wb.create_sheet(title="Extracted_Content")
                    ws.append(["Line #", "Document Content"])
                    ws.cell(row=1, column=1).fill = header_fill
                    ws.cell(row=1, column=1).font = header_font
                    ws.cell(row=1, column=2).fill = header_fill
                    ws.cell(row=1, column=2).font = header_font

                    row_num = 2
                    for page_idx in range(len(doc)):
                        text = doc[page_idx].get_text()
                        for line in text.split("\n"):
                            if line.strip():
                                ws.append([row_num - 1, line.strip()])
                                row_num += 1
                    ws.column_dimensions["A"].width = 10
                    ws.column_dimensions["B"].width = 60
                doc.close()

            excel_stream = io.BytesIO()
            wb.save(excel_stream)
            return excel_stream.getvalue()
        except Exception as e:
            raise ValueError(f"PDF to Excel conversion failed: {str(e)}")

    # -------------------------------------------------------------
    # TOOL 6: PDF → POWERPOINT (.PPTX)
    # -------------------------------------------------------------
    @staticmethod
    def pdf_to_powerpoint(pdf_bytes: bytes) -> bytes:
        """
        Converts each PDF page into a high-fidelity PowerPoint slide (.pptx).
        """
        if not pdf_bytes:
            raise ValueError("PDF document is empty.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if len(doc) == 0:
                raise ValueError("PDF document contains 0 pages.")

            prs = pptx.Presentation()
            # Set 16:9 widescreen presentation dimensions
            prs.slide_width = Inches(13.333)
            prs.slide_height = Inches(7.5)
            blank_slide_layout = prs.slide_layouts[6] # Blank slide

            for page_idx in range(len(doc)):
                page = doc[page_idx]
                slide = prs.slides.add_slide(blank_slide_layout)

                # 1. Render high-resolution page background image
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes("png")
                img_stream = io.BytesIO(img_bytes)

                # Calculate aspect ratio to fit inside slide nicely
                page_ratio = page.rect.width / page.rect.height
                slide_ratio = prs.slide_width / prs.slide_height

                if page_ratio > slide_ratio:
                    img_w = prs.slide_width
                    img_h = prs.slide_width / page_ratio
                    left = Inches(0)
                    top = (prs.slide_height - img_h) / 2
                else:
                    img_h = prs.slide_height
                    img_w = prs.slide_height * page_ratio
                    top = Inches(0)
                    left = (prs.slide_width - img_w) / 2

                slide.shapes.add_picture(img_stream, left, top, width=img_w, height=img_h)

            doc.close()

            pptx_stream = io.BytesIO()
            prs.save(pptx_stream)
            return pptx_stream.getvalue()
        except Exception as e:
            raise ValueError(f"PDF to PowerPoint conversion failed: {str(e)}")

    # -------------------------------------------------------------
    # TOOL 7: CROP PDF
    # -------------------------------------------------------------
    @staticmethod
    def crop_pdf(pdf_bytes: bytes, crop_config: Dict[str, Any]) -> bytes:
        """
        Crops PDF pages by updating Mediabox & Cropbox.
        crop_config structure:
          {
            apply_to: "all" | "current" | "selected",
            selected_pages: [0, 1, ...],
            crop_box: { x: float, y: float, width: float, height: float }, # coordinates in PDF points
            preset: "custom" | "remove_margins" | "a4" | "letter"
          }
        """
        if not pdf_bytes:
            raise ValueError("PDF document is empty.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if len(doc) == 0:
                raise ValueError("PDF document contains 0 pages.")

            apply_to = crop_config.get("apply_to", "all")
            selected_pages = crop_config.get("selected_pages", [0])
            box = crop_config.get("crop_box") or {}
            preset = crop_config.get("preset", "custom")

            for page_idx in range(len(doc)):
                if apply_to == "selected" and page_idx not in selected_pages:
                    continue
                if apply_to == "current" and page_idx != selected_pages[0]:
                    continue

                page = doc[page_idx]
                rect = page.rect

                if preset == "remove_margins":
                    # Auto-detect text/drawing bounds
                    text_rects = [r for r in page.get_drawings() if hasattr(r, "rect")]
                    bbox = page.get_text("blocks")
                    if bbox:
                        x0 = min(b[0] for b in bbox) - 15
                        y0 = min(b[1] for b in bbox) - 15
                        x1 = max(b[2] for b in bbox) + 15
                        y1 = max(b[3] for b in bbox) + 15
                        crop_rect = fitz.Rect(max(0, x0), max(0, y0), min(rect.width, x1), min(rect.height, y1))
                    else:
                        crop_rect = fitz.Rect(rect.width * 0.05, rect.height * 0.05, rect.width * 0.95, rect.height * 0.95)
                elif box and "width" in box and "height" in box:
                    x0 = float(box.get("x", 0))
                    y0 = float(box.get("y", 0))
                    w = float(box.get("width", rect.width))
                    h = float(box.get("height", rect.height))
                    crop_rect = fitz.Rect(x0, y0, x0 + w, y0 + h)
                else:
                    # Default slight crop
                    crop_rect = fitz.Rect(rect.width * 0.05, rect.height * 0.05, rect.width * 0.95, rect.height * 0.95)

                page.set_cropbox(crop_rect)
                page.set_mediabox(crop_rect)

            cropped_bytes = doc.tobytes(garbage=3, deflate=True)
            doc.close()
            return cropped_bytes
        except Exception as e:
            raise ValueError(f"Failed to crop PDF: {str(e)}")

    # -------------------------------------------------------------
    # TOOL 8: PAGE NUMBERS
    # -------------------------------------------------------------
    @staticmethod
    def add_page_numbers(
        pdf_bytes: bytes,
        position: str = "bottom-center",
        format_type: str = "1",
        start_number: int = 1,
        font_size: float = 10.0,
        margin_pt: float = 30.0,
        color_hex: str = "#4b5563",
        pages_scope: str = "all",
        start_page: int = 1,
        end_page: Optional[int] = None,
    ) -> bytes:
        """
        Embeds styled page numbers at precise positions across the PDF document.
        Positions: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right.
        Formats: '1', 'Page 1', '1 / 10', 'Page 1 of 10'.
        """
        if not pdf_bytes:
            raise ValueError("PDF document is empty.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = len(doc)
            if total_pages == 0:
                raise ValueError("PDF contains no pages.")

            # Parse hex color
            c_hex = color_hex.lstrip("#")
            try:
                r = int(c_hex[0:2], 16) / 255.0
                g = int(c_hex[2:4], 16) / 255.0
                b = int(c_hex[4:6], 16) / 255.0
            except Exception:
                r, g, b = 0.3, 0.3, 0.3

            font_obj = fitz.Font("helv")

            for idx in range(total_pages):
                current_pno = idx + 1
                if pages_scope == "range":
                    if current_pno < start_page or (end_page and current_pno > end_page):
                        continue

                page = doc[idx]
                page_num_val = (current_pno - start_page) + start_number

                # Format string
                if format_type == "Page 1":
                    text_str = f"Page {page_num_val}"
                elif format_type == "1 / 10":
                    text_str = f"{page_num_val} / {total_pages}"
                elif format_type == "Page 1 of 10":
                    text_str = f"Page {page_num_val} of {total_pages}"
                else:
                    text_str = f"{page_num_val}"

                # Calculate coordinates
                text_len = font_obj.text_length(text_str, fontsize=font_size)
                w, h = page.rect.width, page.rect.height

                if position == "top-left":
                    x = margin_pt
                    y = margin_pt + font_size
                elif position == "top-right":
                    x = w - margin_pt - text_len
                    y = margin_pt + font_size
                elif position == "top-center":
                    x = (w - text_len) / 2
                    y = margin_pt + font_size
                elif position == "bottom-left":
                    x = margin_pt
                    y = h - margin_pt
                elif position == "bottom-right":
                    x = w - margin_pt - text_len
                    y = h - margin_pt
                else: # bottom-center (default)
                    x = (w - text_len) / 2
                    y = h - margin_pt

                page.insert_text((x, y), text_str, fontsize=font_size, color=(r, g, b), fontname="helv")

            numbered_bytes = doc.tobytes(garbage=3, deflate=True)
            doc.close()
            return numbered_bytes
        except Exception as e:
            raise ValueError(f"Failed to add page numbers: {str(e)}")

    # -------------------------------------------------------------
    # TOOL 9: REDACT PDF (PERMANENT & IRREVERSIBLE)
    # -------------------------------------------------------------
    @staticmethod
    def apply_permanent_redactions(
        pdf_bytes: bytes,
        redactions: List[Dict[str, Any]],
        keywords: Optional[List[str]] = None,
    ) -> bytes:
        """
        Permanently purges sensitive text, characters, vectors, and image pixels
        underneath marked rectangles so the data cannot be selected, copied, or recovered.
        """
        if not pdf_bytes:
            raise ValueError("PDF document is empty.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if len(doc) == 0:
                raise ValueError("PDF document contains no pages.")

            # 1. Apply user-drawn / coordinate redactions
            for item in redactions:
                page_idx = int(item.get("page", 0))
                if page_idx < 0 or page_idx >= len(doc):
                    continue

                page = doc[page_idx]
                x0 = float(item.get("x", 0))
                y0 = float(item.get("y", 0))
                w = float(item.get("width", 100))
                h = float(item.get("height", 20))
                rect = fitz.Rect(x0, y0, x0 + w, y0 + h)

                page.add_redact_annot(rect, fill=(0, 0, 0))

            # 2. Apply keyword search redactions (e.g. emails, names, SSN, keywords)
            if keywords:
                for kw in keywords:
                    if not kw or not kw.strip():
                        continue
                    for page in doc:
                        matches = page.search_for(kw.strip())
                        for match_rect in matches:
                            page.add_redact_annot(match_rect, fill=(0, 0, 0))

            # 3. Apply redactions permanently across all pages
            for page in doc:
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)

            redacted_bytes = doc.tobytes(garbage=4, deflate=True, clean=True)
            doc.close()
            return redacted_bytes
        except Exception as e:
            raise ValueError(f"Failed to apply redactions: {str(e)}")

    # -------------------------------------------------------------
    # TOOL 10: DETECT PDF HEADINGS & STRUCTURE
    # -------------------------------------------------------------
    @staticmethod
    def detect_pdf_headings(pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Analyzes PDF text, layout, font metrics, and patterns to detect
        document title and hierarchical headings (H1, H2, H3).
        """
        if not pdf_bytes or len(pdf_bytes) == 0:
            raise ValueError("Uploaded PDF document is empty.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            raise ValueError(f"Could not open PDF file: {str(e)}")

        if len(doc) == 0:
            raise ValueError("PDF contains no pages.")

        # 1. Document title detection
        meta_title = (doc.metadata.get("title") or "").strip()
        doc_title = meta_title

        # Check existing PDF outline/TOC bookmarks
        existing_toc = doc.get_toc() # [[lvl, title, page_num], ...]

        # 2. Collect all text spans across the document for font size baseline analysis
        all_spans = []
        total_text_len = 0
        pages_info = []

        for pno in range(len(doc)):
            page = doc[pno]
            page_text = page.get_text()
            total_text_len += len(page_text.strip())

            blocks = page.get_text("dict", flags=fitz.TEXT_DEHYPHENATE).get("blocks", [])
            for b in blocks:
                if b.get("type") == 0:  # text block
                    for line in b.get("lines", []):
                        for span in line.get("spans", []):
                            txt = span.get("text", "").strip()
                            if txt:
                                all_spans.append({
                                    "text": txt,
                                    "size": round(float(span.get("size", 12.0)), 1),
                                    "flags": span.get("flags", 0),
                                    "font": span.get("font", ""),
                                    "bbox": [round(float(c), 1) for c in span.get("bbox", [0, 0, 0, 0])],
                                    "page": pno + 1,
                                })
            pages_info.append({
                "pageNumber": pno + 1,
                "width": round(page.rect.width, 1),
                "height": round(page.rect.height, 1),
            })

        is_scanned = total_text_len < 30
        headings: List[Dict[str, Any]] = []

        if is_scanned:
            doc.close()
            return {
                "title": doc_title or "Untitled Document",
                "pageCount": len(pages_info),
                "isScanned": True,
                "message": "No text headings were detected. Run OCR first or add headings manually.",
                "pages": pages_info,
                "headings": [],
            }

        # 3. Extract all structured text elements and headings
        size_counts: Dict[float, int] = {}
        for s in all_spans:
            sz = s["size"]
            size_counts[sz] = size_counts.get(sz, 0) + len(s["text"])

        body_size = max(size_counts.keys(), key=lambda k: size_counts[k]) if size_counts else 12.0

        all_elements: List[Dict[str, Any]] = []
        headings: List[Dict[str, Any]] = []
        seen_headings = set()
        el_idx = 1
        h_idx = 1

        for pno in range(1, len(doc) + 1):
            page = doc[pno - 1]
            blocks = page.get_text("dict", flags=fitz.TEXT_DEHYPHENATE).get("blocks", [])

            for b in blocks:
                if b.get("type") == 0:  # text block
                    lines = b.get("lines", [])
                    if not lines:
                        continue

                    # Collect all text lines and spans in this block
                    block_text_lines = []
                    block_spans = []
                    for line in lines:
                        spans = line.get("spans", [])
                        if spans:
                            line_str = re.sub(r"\s+", " ", "".join(s.get("text", "") for s in spans)).strip()
                            if line_str:
                                block_text_lines.append(line_str)
                                block_spans.extend(spans)

                    if not block_text_lines or not block_spans:
                        continue

                    block_text = "\n".join(block_text_lines)
                    first_span = block_spans[0]
                    sz = round(float(first_span.get("size", 12.0)), 1)
                    flags = first_span.get("flags", 0)
                    font_name = first_span.get("font", "").lower()
                    is_bold = bool((flags & 16) or "bold" in font_name or "black" in font_name or "heavy" in font_name)

                    # Overall block bounding box
                    b_box = [round(float(c), 1) for c in b.get("bbox", [50, 50, 400, 70])]

                    # Classification heuristics
                    is_num_h1 = bool(re.match(r"^\d+\.?\s+[A-Za-z]", block_text) or re.match(r"^(Chapter|Section|Part|Unit|Appendix)\s+\d+[:\.]?\s*", block_text, re.IGNORECASE))
                    is_num_h2 = bool(re.match(r"^\d+\.\d+\.?\s+[A-Za-z]", block_text))
                    is_num_h3 = bool(re.match(r"^\d+\.\d+\.\d+\.?\s+[A-Za-z]", block_text))
                    is_all_caps = bool(re.match(r"^[A-Z0-9\s\-_:]{3,60}$", block_text) and len(block_text.split()) <= 7 and not block_text.isdigit())

                    level = "body"
                    if pno == 1 and not doc_title and sz >= body_size * 1.3:
                        doc_title = block_text.replace("\n", " ")
                        level = "Title"
                    elif sz >= body_size * 1.35 or (sz >= body_size * 1.15 and is_bold) or is_num_h1:
                        level = "H1"
                    elif sz >= body_size * 1.15 or (sz >= body_size * 1.05 and is_bold) or is_num_h2 or (is_all_caps and is_bold):
                        level = "H2"
                    elif (sz >= body_size * 1.05 or is_bold) and (is_num_h3 or is_all_caps):
                        level = "H3"

                    element = {
                        "id": f"txt-{pno}-{el_idx}",
                        "originalText": block_text,
                        "text": block_text,
                        "level": level,
                        "page": pno,
                        "fontSize": sz,
                        "isBold": is_bold,
                        "bbox": b_box,
                    }
                    all_elements.append(element)
                    el_idx += 1

                    if level in ("Title", "H1", "H2", "H3") and len(block_text) <= 130:
                        h_key = f"{pno}_{block_text.lower().replace(chr(10), ' ')}"
                        if h_key not in seen_headings:
                            seen_headings.add(h_key)
                            headings.append({
                                "id": element["id"],
                                "originalText": block_text,
                                "text": block_text.replace("\n", " "),
                                "level": level,
                                "page": pno,
                                "position": h_idx,
                                "fontSize": sz,
                                "isBold": is_bold,
                                "bbox": element["bbox"],
                            })
                            h_idx += 1

        if not doc_title and headings:
            for h in headings:
                if h["level"] in ("Title", "H1"):
                    doc_title = h["text"]
                    break
        if not doc_title:
            doc_title = "Document.pdf"

        for p in pages_info:
            p["headingCount"] = sum(1 for h in headings if h["page"] == p["pageNumber"])
            p["textElementCount"] = sum(1 for el in all_elements if el["page"] == p["pageNumber"])

        doc.close()
        return {
            "title": doc_title,
            "pageCount": len(pages_info),
            "isScanned": False,
            "pages": pages_info,
            "headings": headings,
            "textElements": all_elements,
        }

    # -------------------------------------------------------------
    # TOOL 11: EXPORT ORGANIZED PDF (TITLE, BOOKMARKS, HEADINGS, HEADER/FOOTER, PAGE NUMBERS)
    # -------------------------------------------------------------
    @staticmethod
    def export_organized_pdf(
        pdf_bytes: bytes,
        title: Optional[str] = None,
        headings: Optional[List[Dict[str, Any]]] = None,
        text_elements: Optional[List[Dict[str, Any]]] = None,
        header_text: Optional[str] = None,
        footer_text: Optional[str] = None,
        show_page_numbers: bool = True,
        page_numbers_position: str = "bottom-center",
        page_order: Optional[List[int]] = None,
    ) -> bytes:
        if not pdf_bytes or len(pdf_bytes) == 0:
            raise ValueError("Uploaded PDF document is empty.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            raise ValueError(f"Could not open PDF document: {str(e)}")

        if len(doc) == 0:
            raise ValueError("PDF document contains no pages.")

        # 1. Apply page reordering / duplicate / delete if page_order provided
        if page_order is not None and len(page_order) > 0:
            valid_order = [p for p in page_order if 0 <= p < len(doc)]
            if valid_order:
                doc.select(valid_order)

        # 2. Update PDF Metadata
        meta = doc.metadata or {}
        if title and title.strip():
            meta["title"] = title.strip()
        doc.set_metadata(meta)

        # 3. Apply In-Place Text Replacements onto PDF Pages (All Text Blocks)
        elements_to_apply = text_elements or headings or []
        for el in elements_to_apply:
            txt = (el.get("text") or "").strip()
            orig_txt = (el.get("originalText") or "").strip()
            if not txt:
                continue

            bbox = el.get("bbox")
            if bbox and len(bbox) >= 4 and ((orig_txt and orig_txt != txt) or el.get("isEdited")):
                pnum = int(el.get("page", 1))
                page_idx = pnum - 1
                if 0 <= page_idx < len(doc):
                    page = doc[page_idx]
                    x0, y0, x1, y1 = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])

                    # Clean white rectangle cover over original text
                    font_sz = float(el.get("fontSize") or 12.0)
                    cover_rect = fitz.Rect(x0 - 2, y0 - 1, max(x1 + 6, x0 + 60), y1 + 3)
                    page.draw_rect(cover_rect, color=(1, 1, 1), fill=(1, 1, 1))

                    # Redraw updated text
                    is_bold = bool(el.get("isBold", False) or el.get("level") in ("Title", "H1"))
                    font_name = "hebo" if is_bold else "helv"

                    # Single line or multi-line fit
                    if len(txt) > 80 or "\n" in txt:
                        text_box = fitz.Rect(x0, y0, max(x1 + 30, page.rect.width - 40), max(y1 + 40, y0 + 120))
                        page.insert_textbox(
                            text_box,
                            txt,
                            fontsize=font_sz,
                            fontname=font_name,
                            color=(0.08, 0.08, 0.1),
                        )
                    else:
                        page.insert_text(
                            (x0, y0 + font_sz * 0.85),
                            txt,
                            fontsize=font_sz,
                            fontname=font_name,
                            color=(0.08, 0.08, 0.1),
                        )

        # 4. Build & Apply PDF Bookmarks / Outline (TOC) for Headings
        if headings is not None:
            toc_list = []
            for h in headings:
                txt = (h.get("text") or "").strip()
                if not txt:
                    continue
                lvl_raw = h.get("level", "H1")
                if lvl_raw in ("Title", 0):
                    lvl_num = 1
                elif lvl_raw in ("H1", 1):
                    lvl_num = 1
                elif lvl_raw in ("H2", 2):
                    lvl_num = 2
                elif lvl_raw in ("H3", 3):
                    lvl_num = 3
                else:
                    continue

                pnum = int(h.get("page", 1))
                pnum = max(1, min(pnum, len(doc)))
                toc_list.append([lvl_num, txt, pnum])

            doc.set_toc(toc_list)

        # 4. Apply Header, Footer, and Page Numbers
        total_pages = len(doc)
        font_obj = fitz.Font("helv")

        for idx in range(total_pages):
            page = doc[idx]
            w, h = page.rect.width, page.rect.height
            margin_pt = 30.0
            font_sz = 9.0
            text_color = (0.35, 0.35, 0.4)

            # A. Header
            if header_text and header_text.strip():
                h_txt = header_text.strip()
                page.insert_text(
                    (margin_pt, margin_pt),
                    h_txt,
                    fontsize=font_sz,
                    color=text_color,
                    fontname="helv",
                )
                page.draw_line(
                    (margin_pt, margin_pt + 6),
                    (w - margin_pt, margin_pt + 6),
                    color=(0.85, 0.85, 0.88),
                    width=0.5,
                )

            # B. Footer
            if footer_text and footer_text.strip():
                f_txt = footer_text.strip()
                page.insert_text(
                    (margin_pt, h - margin_pt + font_sz),
                    f_txt,
                    fontsize=font_sz,
                    color=text_color,
                    fontname="helv",
                )
                page.draw_line(
                    (margin_pt, h - margin_pt - 4),
                    (w - margin_pt, h - margin_pt - 4),
                    color=(0.85, 0.85, 0.88),
                    width=0.5,
                )

            # C. Page Numbers
            if show_page_numbers:
                p_txt = f"Page {idx + 1} of {total_pages}"
                p_len = font_obj.text_length(p_txt, fontsize=font_sz)

                pos = (page_numbers_position or "bottom-center").lower()
                if pos == "bottom-right":
                    px = w - margin_pt - p_len
                    py = h - margin_pt + font_sz
                elif pos == "bottom-left":
                    px = margin_pt
                    py = h - margin_pt + font_sz
                elif pos == "top-right":
                    px = w - margin_pt - p_len
                    py = margin_pt
                else:
                    px = (w - p_len) / 2
                    py = h - margin_pt + font_sz

                page.insert_text(
                    (px, py),
                    p_txt,
                    fontsize=font_sz,
                    color=text_color,
                    fontname="helv",
                )

        output_bytes = doc.tobytes(garbage=3, deflate=True)
        doc.close()
        return output_bytes

    @staticmethod
    def convert_to_markdown(file_bytes: bytes, filename: str = "document.pdf") -> Dict[str, Any]:
        """Converts multi-page PDF into clean, structured Markdown with headings, tables, lists, and paragraphs."""
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        if len(doc) == 0:
            return {
                "markdown": "",
                "pageCount": 0,
                "isScanned": False,
                "headings": 0,
                "tables": 0,
                "words": 0,
            }

        # 1. Determine body font size mode
        font_sizes = []
        for page in doc:
            for b in page.get_text("dict").get("blocks", []):
                if b.get("type") == 0:
                    for l in b.get("lines", []):
                        for s in l.get("spans", []):
                            t = s.get("text", "").strip()
                            if len(t) > 10:
                                font_sizes.append(round(s.get("size", 10), 1))

        body_size = Counter(font_sizes).most_common(1)[0][0] if font_sizes else 10.0

        sections = []
        doc_title = None
        headings_count = 0
        tables_count = 0

        for pno, page in enumerate(doc):
            blocks = page.get_text("dict", flags=fitz.TEXT_DEHYPHENATE).get("blocks", [])

            # Filter out running footers / headers / page numbers
            filtered_blocks = []
            for b_idx, b in enumerate(blocks):
                if b.get("type") == 0:
                    lines = b.get("lines", [])
                    if not lines:
                        continue
                    block_txt = " ".join("".join(s.get("text", "") for s in l.get("spans", [])).strip() for l in lines).strip()

                    y_pos = b.get("bbox", [0, 0, 0, 0])[1]
                    is_bottom = y_pos > page.rect.height - 70
                    is_top = y_pos < 50

                    if (is_bottom or is_top or b_idx == len(blocks) - 1):
                        if re.search(r"Page\s+\d+(\s+of\s+\d+)?$", block_txt, re.IGNORECASE) or re.search(r"^\d+\s*[\/\|]\s*\d+$", block_txt):
                            continue
                        if re.match(r"^.*Page\s+\d+$", block_txt, re.IGNORECASE) and len(block_txt) < 80:
                            continue

                    filtered_blocks.append(b)

            i = 0
            while i < len(filtered_blocks):
                b = filtered_blocks[i]
                lines = b.get("lines", [])
                if not lines:
                    i += 1
                    continue

                # Detect table blocks
                is_table = False
                first_line_spans = lines[0].get("spans", [])
                first_line_text = "".join(s.get("text", "") for s in first_line_spans).strip()

                if i + 1 < len(filtered_blocks):
                    next_b = filtered_blocks[i + 1]
                    next_lines = next_b.get("lines", [])
                    if next_lines:
                        first_txt = "\n".join(" ".join(s.get("text", "") for s in l.get("spans", [])).strip() for l in lines)
                        next_txt = "\n".join(" ".join(s.get("text", "") for s in l.get("spans", [])).strip() for l in next_lines)
                        if (len(lines) == 2 or "|" in first_txt) and (len(next_lines) == 2 or "|" in next_txt):
                            is_table = True

                if is_table or "|" in first_line_text or (len(lines) == 2 and len(lines[0].get("spans", [])) == 1 and len(lines[1].get("spans", [])) == 1 and lines[0]["bbox"][0] < lines[1]["bbox"][0] and lines[0]["spans"][0].get("size", 10) <= body_size * 1.05):
                    table_rows = []
                    while i < len(filtered_blocks):
                        curr_b = filtered_blocks[i]
                        curr_lines = curr_b.get("lines", [])
                        if not curr_lines:
                            i += 1
                            continue

                        if len(curr_lines) == 2 and curr_lines[0]["bbox"][0] < curr_lines[1]["bbox"][0]:
                            col1 = "".join(s.get("text", "") for s in curr_lines[0].get("spans", [])).strip()
                            col2 = "".join(s.get("text", "") for s in curr_lines[1].get("spans", [])).strip()
                            table_rows.append([col1, col2])
                            i += 1
                        elif "|" in "".join(s.get("text", "") for l in curr_lines for s in l.get("spans", [])):
                            for l in curr_lines:
                                row_txt = "".join(s.get("text", "") for s in l.get("spans", [])).strip()
                                if "|" in row_txt:
                                    cols = [c.strip() for c in row_txt.split("|") if c.strip()]
                                    table_rows.append(cols)
                            i += 1
                        elif len(curr_lines) == 1 and len(curr_lines[0].get("spans", [])) >= 2:
                            spans = curr_lines[0].get("spans", [])
                            cols = [s.get("text", "").strip() for s in spans if s.get("text", "").strip()]
                            if len(cols) >= 2:
                                table_rows.append(cols)
                                i += 1
                            else:
                                break
                        else:
                            break

                    if len(table_rows) >= 2:
                        col_count = max(len(r) for r in table_rows)
                        header = table_rows[0]
                        while len(header) < col_count:
                            header.append("")
                        header_str = " | ".join(header)
                        sep_str = " | ".join(["---"] * col_count)
                        table_md = f"| {header_str} |\n| {sep_str} |\n"
                        for row in table_rows[1:]:
                            while len(row) < col_count:
                                row.append("")
                            row_str = " | ".join(row)
                            table_md += f"| {row_str} |\n"
                        sections.append(table_md.strip())
                        tables_count += 1
                        continue

                # Paragraph text: Join consecutive lines with single space
                spans = [s for l in lines for s in l.get("spans", [])]
                line_texts = [" ".join(s.get("text", "") for s in l.get("spans", [])).strip() for l in lines]
                block_text = " ".join(t for t in line_texts if t).strip()
                block_text = re.sub(r"\s+", " ", block_text)

                if not block_text:
                    i += 1
                    continue

                first_span = spans[0]
                sz = round(first_span.get("size", 10), 1)
                flags = first_span.get("flags", 0)
                font_name = first_span.get("font", "").lower()
                is_bold = bool((flags & 16) or "bold" in font_name or "hebo" in font_name or "goth" in font_name)

                # 1. Document Title
                if pno == 0 and not doc_title and (sz >= body_size * 1.5 or (sz >= body_size * 1.35 and is_bold)) and len(block_text) < 120 and not re.match(r"^\d+\.", block_text):
                    doc_title = block_text
                    sections.append(f"# {block_text}")
                    headings_count += 1
                    i += 1
                    continue

                # 2. Numbered and Stylistic Headings
                is_num_h3 = bool(re.match(r"^\d+\.\d+\.\d+\.?\s+[A-Za-z]", block_text))
                is_num_h2 = bool(re.match(r"^\d+\.\d+\.?\s+[A-Za-z]", block_text)) and not is_num_h3
                is_num_h1 = bool(re.match(r"^\d+\.?\s+[A-Za-z]", block_text) or re.match(r"^(Chapter|Section|Part|Unit|Appendix)\s+\d+[:\.]?\s*", block_text, re.IGNORECASE)) and not is_num_h2 and not is_num_h3
                is_title_heading = is_bold and (sz >= body_size * 1.35) and len(block_text) < 80 and not is_num_h2 and not is_num_h3

                if (is_num_h1 or is_title_heading or (sz >= body_size * 1.35 and is_bold)) and len(block_text) < 120:
                    sections.append(f"## {block_text}")
                    headings_count += 1
                elif (is_num_h2 or (sz >= body_size * 1.15 and is_bold and not is_num_h3)) and len(block_text) < 120:
                    sections.append(f"### {block_text}")
                    headings_count += 1
                elif (is_num_h3 or (sz >= body_size * 1.05 and is_bold and sz < body_size * 1.15)) and len(block_text) < 120:
                    sections.append(f"#### {block_text}")
                    headings_count += 1
                elif any(bullet in block_text for bullet in ("•", "▪", "▫", "\ufffd", "\u2022", "\u25cf", "–", "—")) or (block_text.startswith("- ") or block_text.startswith("* ")):
                    for line in block_text.split("\n"):
                        clean_item = re.sub(r"^[^\w\s\(\[\"\']+\s*", "", line).strip()
                        if clean_item:
                            sections.append(f"- {clean_item}")
                else:
                    sections.append(block_text)

                i += 1

        final_md = "\n\n".join(sections)
        if not doc_title and not final_md.startswith("# "):
            clean_name = filename.replace(".pdf", "")
            final_md = f"# {clean_name}\n\n{final_md}"

        return {
            "markdown": final_md,
            "pageCount": len(doc),
            "isScanned": len(final_md.strip()) < 20,
            "headings": headings_count,
            "tables": tables_count,
            "words": len(final_md.split()),
        }
