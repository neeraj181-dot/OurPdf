/**
 * Frontend API Service Layer for Authentication, Documents, and History
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

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

export interface DownloadRecord {
  id: number;
  user_id: number;
  filename: string;
  file_type: string;
  file_size: number;
  tool_used?: string;
  has_stored_file: boolean;
  downloaded_at: string;
}

export interface GoogleDriveStatus {
  connected: boolean;
  google_account_id?: string;
  google_email?: string;
  google_name?: string;
  google_picture?: string;
  connected_at?: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mime_type: string;
  size?: number;
  modified_time?: string;
  thumbnail_link?: string;
  web_view_link?: string;
  icon_link?: string;
}

// Token Helpers
export function getStoredToken(): string | null {
  return localStorage.getItem("ourpdf_access_token") || localStorage.getItem("easypdf_access_token");
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem("ourpdf_access_token", token);
  } else {
    localStorage.removeItem("ourpdf_access_token");
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

export async function apiUpdateProfile(name: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/auth/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update profile" }));
    throw new Error(err.detail || "Failed to update profile");
  }

  return await res.json();
}

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to change password" }));
    throw new Error(err.detail || "Failed to change password");
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

export async function apiRenameDocument(docId: number, originalFilename: string): Promise<SavedDocument> {
  const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ original_filename: originalFilename }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to rename document" }));
    throw new Error(err.detail || "Failed to rename document");
  }

  return await res.json();
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
  method: "telea" | "ns" | "smart" | string = "telea",
  radius = 5,
  dilate = 4
): Promise<string> {
  const finalMethod = method === "smart" ? "telea" : method;
  const formData = new FormData();
  formData.append("image_base64", imageSrc);
  formData.append("mask_base64", maskDataUrl);
  formData.append("method", finalMethod);
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

// 6. DOWNLOADS API
export async function apiGetDownloads(): Promise<DownloadRecord[]> {
  const res = await fetch(`${API_BASE_URL}/downloads`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch download history");
  }
  return res.json();
}

export async function apiRecordDownload(
  fileOrBlobOrBytes: Blob | File | Uint8Array,
  filename: string,
  toolUsed = "Export"
): Promise<DownloadRecord> {
  const formData = new FormData();
  let blob: Blob;
  if (fileOrBlobOrBytes instanceof Blob) {
    blob = fileOrBlobOrBytes;
  } else if (fileOrBlobOrBytes instanceof Uint8Array) {
    blob = new Blob([fileOrBlobOrBytes], {
      type: filename.toLowerCase().endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : filename.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "application/octet-stream",
    });
  } else {
    blob = new Blob([fileOrBlobOrBytes]);
  }

  formData.append("file", blob, filename);
  formData.append("filename", filename);
  formData.append("file_size", blob.size.toString());
  formData.append("tool_used", toolUsed);

  const res = await fetch(`${API_BASE_URL}/downloads`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to record download" }));
    throw new Error(err.detail || "Failed to record download");
  }

  return res.json();
}

export async function apiDownloadStoredFile(downloadId: number): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/downloads/${downloadId}/download`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    throw new Error("Failed to download stored file");
  }
  return res.blob();
}

export async function apiDeleteDownloadRecord(downloadId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/downloads/${downloadId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    throw new Error("Failed to delete download record");
  }
}

// 7. GOOGLE DRIVE INTEGRATION API
export async function apiGetGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  const res = await fetch(`${API_BASE_URL}/integrations/google-drive/status`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    return { connected: false };
  }
  return res.json();
}

export async function apiGetGoogleDriveAuthUrl(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/integrations/google-drive/auth-url`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to generate Google auth URL" }));
    throw new Error(err.detail || "Failed to generate Google auth URL");
  }
  const data = await res.json();
  return data.auth_url;
}

export async function apiGetGoogleDriveFiles(search?: string, pageToken?: string): Promise<{ files: GoogleDriveFile[]; next_page_token?: string }> {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (pageToken) params.append("page_token", pageToken);

  const res = await fetch(`${API_BASE_URL}/integrations/google-drive/files?${params.toString()}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to list Google Drive files" }));
    throw new Error(err.detail || "Failed to list Google Drive files");
  }
  return res.json();
}

export async function apiDownloadGoogleDriveFile(fileId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/integrations/google-drive/files/${fileId}/download`, {
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to download file from Google Drive" }));
    throw new Error(err.detail || "Failed to download file from Google Drive");
  }
  return res.blob();
}

export async function apiUploadToGoogleDrive(
  fileOrBlobOrBytes: Blob | File | Uint8Array,
  filename: string
): Promise<{ id: string; name: string; web_view_link?: string }> {
  const formData = new FormData();
  let blob: Blob;
  if (fileOrBlobOrBytes instanceof Blob) {
    blob = fileOrBlobOrBytes;
  } else if (fileOrBlobOrBytes instanceof Uint8Array) {
    blob = new Blob([fileOrBlobOrBytes], {
      type: filename.toLowerCase().endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : filename.toLowerCase().endsWith(".png")
        ? "image/png"
        : "application/pdf",
    });
  } else {
    blob = new Blob([fileOrBlobOrBytes]);
  }

  formData.append("file", blob, filename);
  formData.append("filename", filename);

  const res = await fetch(`${API_BASE_URL}/integrations/google-drive/upload`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to upload file to Google Drive" }));
    throw new Error(err.detail || "Failed to upload file to Google Drive");
  }
  return res.json();
}

export async function apiDisconnectGoogleDrive(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/integrations/google-drive/disconnect`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to disconnect Google Drive" }));
    throw new Error(err.detail || "Failed to disconnect Google Drive");
  }
}

