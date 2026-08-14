# EasyPDF

EasyPDF is a privacy-focused PDF management application for working with PDF files directly through a simple web interface. It provides tools for common PDF operations such as merging, splitting, watermarking, page numbering, and other document processing tasks.

The application uses a React + Vite frontend and a FastAPI + Python backend.


## 1. Frontend Setup (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

The frontend will run at the URL shown in your terminal (typically `http://localhost:3000`).

---

## 2. Backend Setup (FastAPI + Python)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

* Backend API URL: `http://127.0.0.1:8000`
* FastAPI Swagger Docs URL: `http://127.0.0.1:8000/docs`

---

## 3. Running Both (2 Terminals Required)

To run the complete application, open two separate PowerShell terminals:

### Terminal 1 (Frontend):

```powershell
cd frontend
npm install
npm run dev
```

### Terminal 2 (Backend):

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

---

## 4. Troubleshooting

* **Script Execution Error in PowerShell**: If `.ps1` execution is disabled, run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
  ```
* **Port Conflict**: If port 8000 is in use, specify a custom port for uvicorn:
  ```powershell
  uvicorn app.main:app --reload --port 8080
  ```
