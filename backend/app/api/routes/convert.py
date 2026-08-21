from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, Body, HTTPException, status, Response, Request
from pydantic import BaseModel, Field
from app.services.word_converter import WordConverterService
from app.services.html_converter import HtmlConverterService

router = APIRouter(prefix="/convert", tags=["Convert"])


class HtmlConvertRequest(BaseModel):
    html: str = Field(..., description="HTML content string to convert to PDF")
    filename: Optional[str] = Field(default="document.html", description="Output filename base")
    page_size: Optional[str] = Field(default="A4", description="Page size: A4, Letter, Legal, A3, A5")
    orientation: Optional[str] = Field(default="portrait", description="Orientation: portrait or landscape")
    margin: Optional[str] = Field(default="default", description="Margins: default, small, none")
    print_background: Optional[bool] = Field(default=True, description="Whether to include background graphics")


@router.post("/word-to-pdf")
async def convert_word_to_pdf(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Word document file uploaded.",
        )

    filename = file.filename or "document.docx"
    ext = filename.lower().split(".")[-1] if "." in filename else ""

    if ext not in ["docx", "doc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a Microsoft Word document (.docx or .doc).",
        )

    try:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded Word file is empty.",
            )

        # 50MB max file limit check
        if len(file_bytes) > 50 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds maximum allowed limit of 50MB.",
            )

        pdf_bytes = WordConverterService.convert_word_to_pdf_bytes(file_bytes, filename=filename)

        pdf_filename = filename.rsplit(".", 1)[0] + ".pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{pdf_filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        print(f"Word Conversion Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to convert Word document to PDF: {str(e)}",
        )


@router.post("/html-to-pdf")
async def convert_html_to_pdf(
    file: Optional[UploadFile] = File(None),
    html_content: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    page_size: Optional[str] = Form("A4"),
    orientation: Optional[str] = Form("portrait"),
    margin: Optional[str] = Form("default"),
    print_background: Optional[bool] = Form(True),
):
    """
    Convert HTML document (uploaded file or direct string) into a downloadable PDF.
    """
    raw_html = ""
    target_filename = filename or "document.html"

    # Case 1: Uploaded HTML file (.html or .htm)
    if file is not None and file.filename:
        target_filename = filename or file.filename
        ext = target_filename.lower().split(".")[-1] if "." in target_filename else ""
        if ext not in ["html", "htm", "txt", "xhtml"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload an HTML document (.html or .htm).",
            )

        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded HTML file is empty.",
            )

        if len(file_bytes) > 25 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="HTML file size exceeds 25MB limit.",
            )

        try:
            raw_html = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                raw_html = file_bytes.decode("latin-1")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not decode the HTML file encoding.",
                )

    # Case 2: Direct raw HTML string passed
    elif html_content is not None and html_content.strip():
        raw_html = html_content
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No HTML content or file provided for conversion.",
        )

    try:
        pdf_bytes = HtmlConverterService.convert_html_to_pdf_bytes(
            raw_html=raw_html,
            filename=target_filename,
            page_size=page_size or "A4",
            orientation=orientation or "portrait",
            margin=margin or "default",
            print_background=True if print_background is None else print_background,
        )

        base_name = target_filename.rsplit(".", 1)[0] if "." in target_filename else target_filename
        pdf_filename = f"{base_name}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{pdf_filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        print(f"HTML to PDF Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"HTML to PDF conversion failed: {str(e)}",
        )


@router.post("/html-to-pdf/json")
async def convert_html_to_pdf_json(req: HtmlConvertRequest):
    """
    JSON endpoint for raw HTML string conversion.
    """
    if not req.html or not req.html.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="HTML content cannot be empty.",
        )

    try:
        pdf_bytes = HtmlConverterService.convert_html_to_pdf_bytes(
            raw_html=req.html,
            filename=req.filename or "document.html",
            page_size=req.page_size or "A4",
            orientation=req.orientation or "portrait",
            margin=req.margin or "default",
            print_background=req.print_background if req.print_background is not None else True,
        )

        base_name = (req.filename or "document.html").rsplit(".", 1)[0]
        pdf_filename = f"{base_name}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{pdf_filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        print(f"HTML to PDF Error (JSON): {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"HTML to PDF conversion failed: {str(e)}",
        )
