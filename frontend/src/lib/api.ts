/**
 * Frontend API Service Layer for Authentication, Documents, and History
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface SavedDocument {
  id: number;
  user_id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface ProcessingHistoryItem {
  id: number;
  user_id: number;
  document_id: number | null;
  operation: string;
  status: string;
  created_at: string;
}

// Token Helpers
export function getStoredToken(): string | null {
  return localStorage.getItem("easypdf_access_token");
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem("easypdf_access_token", token);
  } else {
    localStorage.removeItem("easypdf_access_token");
  }
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 1. AUTH API
export async function apiRegister(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }

  const data: AuthResponse = await res.json();
  setStoredToken(data.access_token);
  return data;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Invalid email or password" }));
    throw new Error(err.detail || "Invalid email or password");
  }

  const data: AuthResponse = await res.json();
  setStoredToken(data.access_token);
  return data;
}

export async function apiGetMe(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    throw new Error("Session expired");
  }

  return await res.json();
}

export function apiLogout() {
  setStoredToken(null);
}

// 2. SAVED DOCUMENTS API
export async function apiGetDocuments(): Promise<SavedDocument[]> {
  const res = await fetch(`${API_BASE_URL}/documents`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    throw new Error("Failed to load saved documents");
  }

  return await res.json();
}

export async function apiSaveDocument(fileOrBlob: File | Blob, originalFilename: string, operation = "save"): Promise<SavedDocument> {
  const formData = new FormData();
  formData.append("file", fileOrBlob, originalFilename);
  formData.append("operation", operation);

  const res = await fetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to save document" }));
    throw new Error(err.detail || "Failed to save document to storage");
  }

  return await res.json();
}

export async function apiDownloadDocumentBlob(docId: number): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/documents/${docId}/download`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    throw new Error("Failed to download document");
  }

  return await res.blob();
}

export async function apiDeleteDocument(docId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    throw new Error("Failed to delete document");
  }
}

// 3. PROCESSING HISTORY API
export async function apiGetHistory(): Promise<ProcessingHistoryItem[]> {
  const res = await fetch(`${API_BASE_URL}/history`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    return [];
  }

  return await res.json();
}

export async function apiRecordHistory(operation: string, documentId?: number): Promise<void> {
  const token = getStoredToken();
  if (!token) return; // Only log if logged in

  await fetch(`${API_BASE_URL}/history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ operation, document_id: documentId, status: "completed" }),
  }).catch(() => {});
}

// 4. DOCUMENT CONVERSION API
export async function apiConvertWordToPdf(file: File): Promise<Uint8Array> {
  const isDocx = file.name.toLowerCase().endsWith(".docx");

  try {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const res = await fetch(`${API_BASE_URL}/convert/word-to-pdf`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } else {
      const err = await res.json().catch(() => ({ detail: "Server conversion failed." }));
      if (!isDocx) {
        throw new Error(err.detail || "Unable to convert .doc file. Please ensure the file is valid.");
      }
    }
  } catch (err: any) {
    if (!isDocx) {
      throw new Error(
        err?.message ||
          "Could not convert .doc document. Please ensure the backend conversion service is online or save your document as .docx."
      );
    }
    console.warn("Backend Word conversion endpoint unreachable. Running high-fidelity client conversion engine:", err);
  }

  // Client-side engine fallback for .docx files
  const { convertWordToPdfClient } = await import("./wordEngine");
  return await convertWordToPdfClient(file);
}

// 5. INPAINTING & WATERMARK REMOVAL API
export async function apiInpaintImage(
  imageSrc: string,
  maskDataUrl: string,
  method: "telea" | "ns" = "telea",
  radius = 5,
  dilate = 4
): Promise<string> {
  const formData = new FormData();
  formData.append("image_base64", imageSrc);
  formData.append("mask_base64", maskDataUrl);
  formData.append("method", method);
  formData.append("radius", radius.toString());
  formData.append("dilate", dilate.toString());

  const res = await fetch(`${API_BASE_URL}/document/inpaint`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Inpainting failed" }));
    throw new Error(err.detail || "Server inpainting failed");
  }

  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(blob);
  });
}

