from fastapi import APIRouter, File, UploadFile, HTTPException, status, Response
from app.services.word_converter import WordConverterService

router = APIRouter(prefix="/convert", tags=["Convert"])


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
