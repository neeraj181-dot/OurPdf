# EasyPDF — All-in-One Document & Image Workspace

EasyPDF is a comprehensive document productivity application featuring a **Word-style PDF editor**, **PDF & Image Toolkits**, **FastAPI Python backend with OCR**, **PostgreSQL database with Alembic migrations**, **User Authentication**, and **Persistent Document Storage**.

---

## Architecture Overview

```text
EasyPDF/
├── frontend/          # React 19 + Vite + TypeScript + Tailwind CSS + pdf-lib + pdfjs-dist
├── backend/           # FastAPI + SQLAlchemy 2.x + Alembic + PostgreSQL + PyMuPDF
└── README.md
```

---

## 1. Backend Setup (FastAPI + PostgreSQL)

### Step 1: Open PowerShell and navigate to `backend`
```powershell
cd backend
```

### Step 2: Create and activate virtual environment
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### Step 3: Install dependencies
```powershell
pip install -r requirements.txt
```

### Step 4: Configure Environment & Database
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

Configure your PostgreSQL database URL in `backend/.env`:
```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/easypdf
SECRET_KEY=your_secret_jwt_key_here
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```
*(Note: If PostgreSQL is not running, the backend automatically defaults to local SQLite `sqlite:///./easypdf.db`)*

### Step 5: Run Database Migrations
```powershell
alembic upgrade head
```

### Step 6: Start FastAPI Backend Server
```powershell
python -m uvicorn app.main:app --reload --port 8000
```

* **Backend URL**: `http://127.0.0.1:8000`
* **Swagger API Interactive Docs**: `http://127.0.0.1:8000/docs`
* **ReDoc Documentation**: `http://127.0.0.1:8000/redoc`

---

## 2. Frontend Setup (React 19 + Vite)

Open a second PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

* **Frontend Web App**: `http://localhost:3000`

---

## 3. Core Feature Capabilities

### [ PDF ] Mode
* **Create & Edit PDF**: Microsoft Word-style rich text document editor, continuous typing, A4/Letter pages, headings, tables, images, headers/footers, page numbers, and direct PDF compilation.
* **Word ↔ PDF**: Full Word (`.docx`) to PDF and PDF to Word (`.docx`) conversions.
* **Organize & Pages**: Merge PDF, Split PDF, Organize & Rotate (90°/180°/270°), Duplicate, and Delete pages.
* **Enhance & Edit**: Add Watermark, Remove Watermark, Annotate & Draw, and Add Page Numbers.
* **Optimize**: Compress PDF with Low, Balanced, High settings and real size comparison stats (`Saved %`).
* **Extract & OCR**: Scanned PDF & image text extraction via FastAPI Python backend.
* **Security & Search**: Protect PDF (password encryption), Unlock PDF, and keyword Search PDF with page navigation.

### [ IMAGE ] Mode
* **Image Workspace Studio**: Crop, Resize (aspect-ratio lock), Rotate (90°/180°/270°), Flip (H/V), Quality slider.
* **Images → PDF**: Convert single or multiple PNG/JPG/WebP images into a consolidated PDF.
* **Image → SVG**: Client-side vector tracing (`imagetracerjs`) to true vector SVG.
* **Image Format Conversion**: Convert between PNG, JPG, JPEG, WebP, and SVG.
* **Image Compression**: Real before/after file size reduction and direct download.

### User Accounts & Saved Documents
* **Authentication**: JWT-based user registration, login, and secure bcrypt password hashing.
* **My Documents**: User-isolated persistent storage (`backend/storage/user_<id>/`) with ownership validation.
* **Recent Activity**: Live database audit log of document processing operations.
* **Privacy-First**: Client-side processing by default; files are only uploaded to storage when the user explicitly clicks *"Save to My Documents"*.

---

## 4. Build & Production Verification

```powershell
# Frontend TypeScript check and production build:
cd frontend
npm run lint
npm run build

# Backend test suite:
cd backend
python test_api_client.py
```