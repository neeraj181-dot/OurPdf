# SpotiPDF Studio - FastAPI Backend

Python FastAPI backend for SpotiPDF Studio, featuring a provider-independent AI architecture.

## Setup & Running

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment (optional but recommended):**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Configuration:**
   Copy `.env.example` to `.env` and set your `AI_API_KEY`:
   ```bash
   cp .env.example .env
   ```

5. **Start the FastAPI server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

## Endpoints Summary

- **Health Check:** `GET /api/health`
- **Swagger Docs:** `http://localhost:8000/docs`
- **OpenAPI Schema:** `http://localhost:8000/openapi.json`
- **AI Summarize:** `POST /api/ai/summarize`
- **AI Chat:** `POST /api/ai/chat`
- **AI OCR Enhance:** `POST /api/ai/ocr-enhance`
- **AI Translate:** `POST /api/ai/translate`
- **AI Smart Extract:** `POST /api/ai/smart-extract`
