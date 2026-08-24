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

export interface HtmlToPdfOptions {
  file?: File | null;
  html?: string;
  filename?: string;
  pageSize?: "A4" | "Letter" | "Legal" | string;
  orientation?: "portrait" | "landscape";
  margin?: "default" | "small" | "none";
  printBackground?: boolean;
}

export async function apiConvertHtmlToPdf(options: HtmlToPdfOptions): Promise<Uint8Array> {
  const formData = new FormData();
  if (options.file) {
    formData.append("file", options.file, options.file.name);
  }
  if (options.html) {
    formData.append("html_content", options.html);
  }
  if (options.filename) {
    formData.append("filename", options.filename);
  }
  if (options.pageSize) {
    formData.append("page_size", options.pageSize);
  }
  if (options.orientation) {
    formData.append("orientation", options.orientation);
  }
  if (options.margin) {
    formData.append("margin", options.margin);
  }
  if (options.printBackground !== undefined) {
    formData.append("print_background", options.printBackground ? "true" : "false");
  }

  const res = await fetch(`${API_BASE_URL}/convert/html-to-pdf`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "HTML to PDF conversion failed." }));
    throw new Error(err.detail || "HTML to PDF conversion failed.");
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
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

export async function apiConvertPdfToMarkdown(file: File): Promise<{
  markdown: string;
  pageCount: number;
  isScanned: boolean;
  headings: number;
  tables: number;
  words: number;
}> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await fetch(`${API_BASE_URL}/tools/pdf-to-markdown`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server markdown conversion failed." }));
    throw new Error(err.detail || "Server conversion failed");
  }

  return res.json();
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

// =============================================================
// 8. SUITE OF 9 CORE PDF TOOLS API
// =============================================================

// 1. Compress PDF
export async function apiCompressPdf(
  file: File,
  level: "low" | "medium" | "high" = "medium"
): Promise<{ bytes: Uint8Array; originalSize: number; compressedSize: number; savedPercent: number }> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("level", level);

  const res = await fetch(`${API_BASE_URL}/tools/compress-pdf`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Compression failed" }));
    throw new Error(err.detail || "Compression failed");
  }

  const originalSize = Number(res.headers.get("X-Original-Size") || file.size);
  const compressedSize = Number(res.headers.get("X-Compressed-Size") || 0);
  const savedPercent = Number(res.headers.get("X-Saved-Percent") || 0);

  const arrayBuffer = await res.arrayBuffer();
  return {
    bytes: new Uint8Array(arrayBuffer),
    originalSize: originalSize || file.size,
    compressedSize: compressedSize || arrayBuffer.byteLength,
    savedPercent,
  };
}

// 2. OCR PDF (Searchable Output)
export async function apiOcrPdf(file: File, language: "eng" | "hin" | "mal" = "eng"): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("language", language);

  const res = await fetch(`${API_BASE_URL}/tools/ocr-pdf`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "OCR processing failed" }));
    throw new Error(err.detail || "OCR processing failed");
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// 3. Sign PDF
export async function apiSignPdf(file: File, signatures: any[]): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("signatures", JSON.stringify(signatures));

  const res = await fetch(`${API_BASE_URL}/tools/sign-pdf`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Signing failed" }));
    throw new Error(err.detail || "Signing failed");
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// 4. Fill PDF
export async function apiGetFormFields(file: File): Promise<{ fields: any[]; count: number }> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await fetch(`${API_BASE_URL}/tools/form-fields`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    return { fields: [], count: 0 };
  }

  return res.json();
}

export async function apiFillPdf(file: File, formValues: any, customTexts: any[] = []): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("form_values", JSON.stringify(formValues));
  formData.append("custom_texts", JSON.stringify(customTexts));

  const res = await fetch(`${API_BASE_URL}/tools/fill-pdf`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Form filling failed" }));
    throw new Error(err.detail || "Form filling failed");
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// 5. PDF to Excel (.xlsx)
export async function apiPdfToExcel(file: File): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await fetch(`${API_BASE_URL}/tools/pdf-to-excel`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Excel conversion failed" }));
    throw new Error(err.detail || "Excel conversion failed");
  }

  return res.blob();
}

// 6. PDF to PowerPoint (.pptx)
export async function apiPdfToPowerpoint(file: File): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await fetch(`${API_BASE_URL}/tools/pdf-to-powerpoint`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "PowerPoint conversion failed" }));
    throw new Error(err.detail || "PowerPoint conversion failed");
  }

  return res.blob();
}

// 7. Crop PDF
export async function apiCropPdf(file: File, cropConfig: any): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("crop_config", JSON.stringify(cropConfig));

  const res = await fetch(`${API_BASE_URL}/tools/crop-pdf`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Crop failed" }));
    throw new Error(err.detail || "Crop failed");
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// 8. Page Numbers
export async function apiAddPageNumbers(file: File, options: any): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("position", options.position || "bottom-center");
  formData.append("format_type", options.format_type || "1");
  formData.append("start_number", String(options.start_number || 1));
  formData.append("font_size", String(options.font_size || 10));
  formData.append("margin", String(options.margin || 30));
  formData.append("color", options.color || "#4b5563");
  formData.append("pages_scope", options.pages_scope || "all");
  formData.append("start_page", String(options.start_page || 1));
  if (options.end_page) {
    formData.append("end_page", String(options.end_page));
  }

  const res = await fetch(`${API_BASE_URL}/tools/page-numbers`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Page numbers application failed" }));
    throw new Error(err.detail || "Page numbers application failed");
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// 9. Redact PDF
export async function apiRedactPdf(file: File, redactions: any[], keywords: string[] = []): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("redactions", JSON.stringify(redactions));
  formData.append("keywords", JSON.stringify(keywords));

  const res = await fetch(`${API_BASE_URL}/tools/redact-pdf`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Redaction failed" }));
    throw new Error(err.detail || "Redaction failed");
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// 10. Title & Heading Organizer APIs
export interface DetectedHeadingItem {
  id: string;
  originalText?: string;
  text: string;
  level: "Title" | "H1" | "H2" | "H3";
  page: number;
  position?: number;
  fontSize?: number;
  fontFamily?: string;
  isBold?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  highlight?: string;
  align?: "left" | "center" | "right" | "justify";
  bbox?: number[];
  isEdited?: boolean;
}

export interface DocumentPageInfo {
  pageNumber: number;
  width: number;
  height: number;
  headingCount?: number;
}

export interface DetectedStructureResponse {
  title: string;
  pageCount: number;
  isScanned: boolean;
  message?: string;
  pages: DocumentPageInfo[];
  headings: DetectedHeadingItem[];
  textElements?: DetectedHeadingItem[];
}

export interface InsertedElementItem {
  id: string;
  type: "text" | "image" | "signature" | "shape";
  page: number; // 1-indexed
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlight?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: "left" | "center" | "right" | "justify";
  shapeType?: "rectangle" | "circle" | "line" | "arrow";
  borderColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  dataUrl?: string; // base64 for image / signature
  rotation?: number;
}

export interface ExportOrganizedPdfOptions {
  title?: string;
  headings: DetectedHeadingItem[];
  text_elements?: DetectedHeadingItem[];
  inserted_elements?: InsertedElementItem[];
  page_rotations?: Record<number, number>;
  header_text?: string;
  footer_text?: string;
  show_page_numbers?: boolean;
  page_numbers_position?: string;
  page_order?: number[];
}

export async function apiDetectPdfHeadings(file: File): Promise<DetectedStructureResponse> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await fetch(`${API_BASE_URL}/tools/detect-headings`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to analyze PDF headings" }));
    throw new Error(err.detail || "Failed to analyze PDF headings");
  }

  return await res.json();
}

export async function apiExportOrganizedPdf(file: File, options: ExportOrganizedPdfOptions): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  if (options.title) formData.append("title", options.title);
  formData.append("headings", JSON.stringify(options.headings || []));
  if (options.text_elements) formData.append("text_elements", JSON.stringify(options.text_elements));
  if (options.inserted_elements) formData.append("inserted_elements", JSON.stringify(options.inserted_elements));
  if (options.page_rotations) formData.append("page_rotations", JSON.stringify(options.page_rotations));
  if (options.header_text) formData.append("header_text", options.header_text);
  if (options.footer_text) formData.append("footer_text", options.footer_text);
  formData.append("show_page_numbers", String(options.show_page_numbers ?? true));
  if (options.page_numbers_position) formData.append("page_numbers_position", options.page_numbers_position);
  if (options.page_order) formData.append("page_order", JSON.stringify(options.page_order));

  const res = await fetch(`${API_BASE_URL}/tools/export-organized-pdf`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to export organized PDF" }));
    throw new Error(err.detail || "Failed to export organized PDF");
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// 11. Protect PDF (Password Encryption API)
export async function apiProtectPdf(file: File, password: string): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("password", password);

  const res = await fetch(`${API_BASE_URL}/tools/protect-pdf`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to protect PDF document" }));
    throw new Error(err.detail || "Failed to protect PDF document");
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}



