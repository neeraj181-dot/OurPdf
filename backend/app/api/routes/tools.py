import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, File, UploadFile, Form, Body, HTTPException, status, Response
from pydantic import BaseModel, Field

from app.services.html_converter import HtmlConverterService
from app.services.pdf_tools_service import PdfToolsService

router = APIRouter(prefix="/tools", tags=["Tools"])


# -------------------------------------------------------------
# 0. HTML TO PDF
# -------------------------------------------------------------
@router.post("/html-to-pdf")
async def tool_html_to_pdf(
    file: Optional[UploadFile] = File(None),
    html_content: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    page_size: Optional[str] = Form("A4"),
    orientation: Optional[str] = Form("portrait"),
    margin: Optional[str] = Form("default"),
    print_background: Optional[bool] = Form(True),
):
    raw_html = ""
    target_filename = filename or "document.html"

    if file is not None and file.filename:
        target_filename = filename or file.filename
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded HTML file is empty.")
        try:
            raw_html = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_html = file_bytes.decode("latin-1", errors="replace")
    elif html_content is not None and html_content.strip():
        raw_html = html_content
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No HTML code or file was provided.")

    try:
        pdf_bytes = HtmlConverterService.convert_html_to_pdf_bytes(
            raw_html=raw_html,
            filename=target_filename,
            page_size=page_size or "A4",
            orientation=orientation or "portrait",
            margin=margin or "default",
            print_background=True if print_background is None else print_background,
        )
        base_name = target_filename.rsplit(".", 1)[0]
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{base_name}.pdf"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 1. COMPRESS PDF
# -------------------------------------------------------------
@router.post("/compress-pdf")
async def tool_compress_pdf(
    file: UploadFile = File(...),
    level: str = Form("medium"), # low, medium, high
):
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No PDF file uploaded.")
    
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        res = PdfToolsService.compress_pdf(file_bytes, level=level)
        filename = (file.filename or "compressed.pdf").rsplit(".", 1)[0] + ".pdf"
        
        return Response(
            content=res["bytes"],
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition, X-Original-Size, X-Compressed-Size, X-Saved-Percent",
                "X-Original-Size": str(res["original_size"]),
                "X-Compressed-Size": str(res["compressed_size"]),
                "X-Saved-Percent": str(res["saved_percent"]),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 2. OCR PDF (SEARCHABLE PDF GENERATION)
# -------------------------------------------------------------
@router.post("/ocr-pdf")
async def tool_ocr_pdf(
    file: UploadFile = File(...),
    language: str = Form("eng"), # eng, hin, mal
):
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No PDF file uploaded.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        searchable_bytes = PdfToolsService.ocr_to_searchable_pdf(file_bytes, language=language)
        filename = (file.filename or "ocr_searchable.pdf").rsplit(".", 1)[0] + "_searchable.pdf"
        
        return Response(
            content=searchable_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 3. SIGN PDF
# -------------------------------------------------------------
@router.post("/sign-pdf")
async def tool_sign_pdf(
    file: UploadFile = File(...),
    signatures: str = Form("[]"), # JSON array of signatures
):
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No PDF file uploaded.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        sig_list = json.loads(signatures) if isinstance(signatures, str) else signatures
        signed_bytes = PdfToolsService.apply_signatures(file_bytes, sig_list)
        filename = (file.filename or "signed.pdf").rsplit(".", 1)[0] + "_signed.pdf"
        
        return Response(
            content=signed_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 4. FILL PDF
# -------------------------------------------------------------
@router.post("/form-fields")
async def tool_get_form_fields(file: UploadFile = File(...)):
    """Inspects and returns all interactive form fields in the uploaded PDF."""
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        fields = PdfToolsService.get_form_fields(file_bytes)
        return {"success": True, "fields": fields, "count": len(fields)}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/fill-pdf")
async def tool_fill_pdf(
    file: UploadFile = File(...),
    form_values: str = Form("{}"),
    custom_texts: str = Form("[]"),
):
    """Fills form fields and places arbitrary text onto PDF pages."""
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        f_vals = json.loads(form_values) if isinstance(form_values, str) else form_values
        c_texts = json.loads(custom_texts) if isinstance(custom_texts, str) else custom_texts

        filled_bytes = PdfToolsService.fill_pdf(file_bytes, form_values=f_vals, custom_texts=c_texts)
        filename = (file.filename or "filled.pdf").rsplit(".", 1)[0] + "_completed.pdf"

        return Response(
            content=filled_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 5. PDF → EXCEL (.XLSX)
# -------------------------------------------------------------
@router.post("/pdf-to-excel")
async def tool_pdf_to_excel(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No PDF file uploaded.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        excel_bytes = PdfToolsService.pdf_to_excel(file_bytes)
        filename = (file.filename or "data.pdf").rsplit(".", 1)[0] + ".xlsx"

        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 6. PDF → POWERPOINT (.PPTX)
# -------------------------------------------------------------
@router.post("/pdf-to-powerpoint")
async def tool_pdf_to_powerpoint(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No PDF file uploaded.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        pptx_bytes = PdfToolsService.pdf_to_powerpoint(file_bytes)
        filename = (file.filename or "presentation.pdf").rsplit(".", 1)[0] + ".pptx"

        return Response(
            content=pptx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 6B. PDF TO MARKDOWN
# -------------------------------------------------------------
@router.post("/pdf-to-markdown")
async def tool_pdf_to_markdown(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No PDF file uploaded.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        res = PdfToolsService.convert_to_markdown(file_bytes, file.filename or "document.pdf")
        return res
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 7. CROP PDF
# -------------------------------------------------------------
@router.post("/crop-pdf")
async def tool_crop_pdf(
    file: UploadFile = File(...),
    crop_config: str = Form("{}"),
):
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        config = json.loads(crop_config) if isinstance(crop_config, str) else crop_config
        cropped_bytes = PdfToolsService.crop_pdf(file_bytes, config)
        filename = (file.filename or "cropped.pdf").rsplit(".", 1)[0] + "_cropped.pdf"

        return Response(
            content=cropped_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 8. PAGE NUMBERS
# -------------------------------------------------------------
@router.post("/page-numbers")
async def tool_page_numbers(
    file: UploadFile = File(...),
    position: str = Form("bottom-center"),
    format_type: str = Form("1"),
    start_number: int = Form(1),
    font_size: float = Form(10.0),
    margin: float = Form(30.0),
    color: str = Form("#4b5563"),
    pages_scope: str = Form("all"),
    start_page: int = Form(1),
    end_page: Optional[int] = Form(None),
):
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        numbered_bytes = PdfToolsService.add_page_numbers(
            pdf_bytes=file_bytes,
            position=position,
            format_type=format_type,
            start_number=start_number,
            font_size=font_size,
            margin_pt=margin,
            color_hex=color,
            pages_scope=pages_scope,
            start_page=start_page,
            end_page=end_page,
        )
        filename = (file.filename or "numbered.pdf").rsplit(".", 1)[0] + "_numbered.pdf"

        return Response(
            content=numbered_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 9. REDACT PDF (PERMANENT & IRREVERSIBLE)
# -------------------------------------------------------------
@router.post("/redact-pdf")
async def tool_redact_pdf(
    file: UploadFile = File(...),
    redactions: str = Form("[]"),
    keywords: str = Form("[]"),
):
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        redact_list = json.loads(redactions) if isinstance(redactions, str) else redactions
        kw_list = json.loads(keywords) if isinstance(keywords, str) else keywords

        redacted_bytes = PdfToolsService.apply_permanent_redactions(
            pdf_bytes=file_bytes,
            redactions=redact_list,
            keywords=kw_list,
        )
        filename = (file.filename or "redacted.pdf").rsplit(".", 1)[0] + "_redacted.pdf"

        return Response(
            content=redacted_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 10. DETECT HEADINGS & DOCUMENT STRUCTURE
# -------------------------------------------------------------
@router.post("/detect-headings")
async def tool_detect_headings(
    file: UploadFile = File(...),
):
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        structure = PdfToolsService.detect_pdf_headings(file_bytes)
        return structure
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 11. EXPORT ORGANIZED PDF (TITLE, BOOKMARKS, HEADINGS, HEADER/FOOTER, NUMBERS)
# -------------------------------------------------------------
@router.post("/export-organized-pdf")
@router.post("/organize-headings-export")
async def tool_export_organized_pdf(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    headings: str = Form("[]"),
    text_elements: str = Form("[]"),
    inserted_elements: str = Form("[]"),
    page_rotations: Optional[str] = Form(None),
    header_text: Optional[str] = Form(None),
    footer_text: Optional[str] = Form(None),
    show_page_numbers: bool = Form(True),
    page_numbers_position: str = Form("bottom-center"),
    page_order: Optional[str] = Form(None),
):
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded PDF is empty.")

    try:
        headings_list = json.loads(headings) if isinstance(headings, str) else (headings or [])
        elements_list = json.loads(text_elements) if isinstance(text_elements, str) else (text_elements or [])
        inserted_list = json.loads(inserted_elements) if isinstance(inserted_elements, str) else (inserted_elements or [])
        order_list = json.loads(page_order) if page_order and isinstance(page_order, str) else None
        rotations_dict = json.loads(page_rotations) if page_rotations and isinstance(page_rotations, str) else None

        output_bytes = PdfToolsService.export_organized_pdf(
            pdf_bytes=file_bytes,
            title=title,
            headings=headings_list,
            text_elements=elements_list,
            inserted_elements=inserted_list,
            page_rotations=rotations_dict,
            header_text=header_text,
            footer_text=footer_text,
            show_page_numbers=show_page_numbers,
            page_numbers_position=page_numbers_position,
            page_order=order_list,
        )

        orig_name = (file.filename or "document.pdf").rsplit(".", 1)[0]
        export_filename = f"{orig_name}-edited.pdf"

        return Response(
            content=output_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{export_filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# -------------------------------------------------------------
# 12. PROTECT PDF (GENUINE AES-256 PDF ENCRYPTION)
# -------------------------------------------------------------
@router.post("/protect-pdf")
async def tool_protect_pdf(
    file: Optional[UploadFile] = File(None),
    password: Optional[str] = Form(None),
):
    if file is None or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No PDF file uploaded.",
        )

    filename = file.filename.lower()
    if not filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a valid PDF document.",
        )

    if not password or not password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required and cannot be empty.",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF file is empty.",
        )

    # 50MB file size limit
    if len(file_bytes) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum allowed limit of 50MB.",
        )

    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PDF file. The uploaded file is corrupted or not a valid PDF.",
        )

    try:
        protected_bytes = PdfToolsService.protect_pdf(
            pdf_bytes=file_bytes,
            password=password,
        )

        return Response(
            content=protected_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="protected.pdf"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        print(f"Protect PDF error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to protect PDF document.")

