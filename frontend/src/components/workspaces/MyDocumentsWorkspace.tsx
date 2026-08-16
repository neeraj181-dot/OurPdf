import React, { useState, useEffect } from "react";
import {
  FolderLock,
  FileText,
  Download,
  Trash2,
  ExternalLink,
  History,
  CheckCircle2,
  RefreshCw,
  Edit3,
  Search,
  ArrowDownToLine,
  LogIn,
  Layers,
  Sparkles,
  Calendar,
} from "lucide-react";
import {
  UserProfile,
  SavedDocument,
  ProcessingHistoryItem,
  DownloadRecord,
  GoogleDriveStatus,
  GoogleDriveFile,
  apiGetDocuments,
  apiDeleteDocument,
  apiDownloadDocumentBlob,
  apiRenameDocument,
  apiGetHistory,
  apiGetDownloads,
  apiRecordDownload,
  apiDownloadStoredFile,
  apiDeleteDownloadRecord,
  apiGetGoogleDriveStatus,
  apiGetGoogleDriveAuthUrl,
  apiGetGoogleDriveFiles,
  apiDownloadGoogleDriveFile,
} from "../../lib/api";
import {
  getDownloadedDocs,
  deleteDownloadedDoc,
  StoredDownloadRecord,
  recordDownloadedDoc,
} from "../../lib/docStorage";
import { downloadPdfBytes } from "../../lib/pdfEngine";
import { downloadImageBlob } from "../../lib/imageEngine";
import { downloadWordBlob } from "../../lib/wordEngine";
import { soundEffects } from "../../lib/audio";
import { RenameDocModal } from "../RenameDocModal";

export interface UnifiedDownloadItem {
  id: string | number;
  filename: string;
  fileSize: number;
  fileType: string;
  downloadDate: string;
  toolUsed?: string;
  hasStoredFile?: boolean;
  blob?: Blob;
  backendId?: number;
}

interface MyDocumentsWorkspaceProps {
  user: UserProfile | null;
  initialTab?: "saved" | "downloads" | "recent" | "drive";
  refreshKey?: number;
  activeFileName?: string | null;
  onOpenAuthModal: (mode?: "login" | "register") => void;
  onOpenDocument: (file: File, docId?: number) => void;
  onRenameDocument?: (docId: number, newFilename: string) => void;
}

export const MyDocumentsWorkspace: React.FC<MyDocumentsWorkspaceProps> = ({
  user,
  initialTab = "saved",
  refreshKey = 0,
  activeFileName,
  onOpenAuthModal,
  onOpenDocument,
  onRenameDocument,
}) => {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [downloadedDocs, setDownloadedDocs] = useState<UnifiedDownloadItem[]>([]);
  const [history, setHistory] = useState<ProcessingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"saved" | "downloads" | "recent" | "drive">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  // Google Drive Tab State
  const [driveStatus, setDriveStatus] = useState<GoogleDriveStatus>({ connected: false });
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveImportingId, setDriveImportingId] = useState<string | null>(null);

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadData();
    if (user) {
      loadDriveData();
    }
  }, [user, refreshKey]);

  // Multi-channel OAuth listeners (postMessage, BroadcastChannel, storage events)
  useEffect(() => {
    const onAuthSuccess = () => {
      soundEffects.playSuccess();
      setIsConnectingDrive(false);
      loadDriveData();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "GOOGLE_DRIVE_AUTH_SUCCESS") {
        onAuthSuccess();
      } else if (event.data?.type === "GOOGLE_DRIVE_AUTH_ERROR") {
        setIsConnectingDrive(false);
      }
    };
    window.addEventListener("message", handleMessage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("ourpdf_google_drive");
      bc.onmessage = (event) => {
        if (event.data?.type === "GOOGLE_DRIVE_AUTH_SUCCESS") {
          onAuthSuccess();
        } else if (event.data?.type === "GOOGLE_DRIVE_AUTH_ERROR") {
          setIsConnectingDrive(false);
        }
      };
    } catch (e) {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ourpdf_google_drive_auth_event" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.type === "GOOGLE_DRIVE_AUTH_SUCCESS") {
            onAuthSuccess();
          } else if (data.type === "GOOGLE_DRIVE_AUTH_ERROR") {
            setIsConnectingDrive(false);
          }
        } catch (err) {}
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      if (bc) bc.close();
    };
  }, []);

  const loadDriveData = async () => {
    setIsLoadingDrive(true);
    try {
      const status = await apiGetGoogleDriveStatus();
      setDriveStatus(status);
      if (status.connected) {
        const res = await apiGetGoogleDriveFiles();
        setDriveFiles(res.files);
      }
    } catch (err) {
      console.warn("Failed to load Google Drive files:", err);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleConnectDrive = async () => {
    soundEffects.playClick();
    setIsConnectingDrive(true);
    try {
      const authUrl = await apiGetGoogleDriveAuthUrl();
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        "GoogleDriveAuth",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        window.location.href = authUrl;
        return;
      }

      let checks = 0;
      const maxChecks = 90;
      const pollTimer = setInterval(async () => {
        checks++;

        if (checks % 2 === 0) {
          try {
            const st = await apiGetGoogleDriveStatus();
            if (st.connected) {
              clearInterval(pollTimer);
              setIsConnectingDrive(false);
              soundEffects.playSuccess();
              setDriveStatus(st);
              loadDriveData();
              try { popup.close(); } catch(e) {}
              return;
            }
          } catch(e) {}
        }

        if (popup.closed) {
          clearInterval(pollTimer);
          setTimeout(async () => {
            try {
              const st = await apiGetGoogleDriveStatus();
              setIsConnectingDrive(false);
              if (st.connected) {
                soundEffects.playSuccess();
                setDriveStatus(st);
                loadDriveData();
              }
            } catch(e) {
              setIsConnectingDrive(false);
            }
          }, 800);
        } else if (checks >= maxChecks) {
          clearInterval(pollTimer);
          setIsConnectingDrive(false);
        }
      }, 1000);
    } catch (err: any) {
      setIsConnectingDrive(false);
      alert("Failed to start Google Drive connection.");
    }
  };

  const handleImportDriveFile = async (driveFile: GoogleDriveFile) => {
    soundEffects.playClick();
    setDriveImportingId(driveFile.id);
    try {
      const blob = await apiDownloadGoogleDriveFile(driveFile.id);
      const file = new File([blob], driveFile.name, {
        type: driveFile.mime_type || "application/pdf",
      });
      soundEffects.playSuccess();
      onOpenDocument(file);
    } catch (err) {
      alert("Failed to download and import Google Drive file.");
    } finally {
      setDriveImportingId(null);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (user) {
        const [docs, hist, backendDownloads] = await Promise.all([
          apiGetDocuments().catch(() => []),
          apiGetHistory().catch(() => []),
          apiGetDownloads().catch(() => []),
        ]);
        setDocuments(docs);
        setHistory(hist);
        const mapped: UnifiedDownloadItem[] = backendDownloads.map((b) => ({
          id: b.id,
          filename: b.filename,
          fileSize: b.file_size,
          fileType: b.file_type,
          downloadDate: b.downloaded_at,
          toolUsed: b.tool_used || "Export",
          hasStoredFile: b.has_stored_file,
          backendId: b.id,
        }));
        setDownloadedDocs(mapped);
      } else {
        const localDownloads = await getDownloadedDocs();
        const mapped: UnifiedDownloadItem[] = localDownloads.map((l) => ({
          id: l.id,
          filename: l.filename,
          fileSize: l.fileSize,
          fileType: l.filename.split(".").pop() || "pdf",
          downloadDate: l.downloadDate,
          toolUsed: l.toolUsed || "Export",
          hasStoredFile: !!l.blob,
          blob: l.blob,
          backendId: l.backendDocId,
        }));
        setDownloadedDocs(mapped);
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered documents by search query
  const filteredDocs = documents.filter((doc) =>
    doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDownloads = downloadedDocs.filter((dl) =>
    dl.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = async (doc: SavedDocument) => {
    soundEffects.playClick();
    try {
      const blob = await apiDownloadDocumentBlob(doc.id);
      if (doc.file_type === "pdf") {
        const buffer = await blob.arrayBuffer();
        downloadPdfBytes(new Uint8Array(buffer), doc.original_filename);
      } else {
        downloadImageBlob(blob, doc.original_filename);
      }

      // Record download in backend and local storage
      if (user) {
        await apiRecordDownload(blob, doc.original_filename, "Saved Document");
      } else {
        await recordDownloadedDoc(doc.original_filename, doc.file_size, 1, "Saved Document", blob, doc.id);
      }
      await loadData();
      soundEffects.playSuccess();
    } catch (err: any) {
      alert("Failed to download document.");
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm("Are you sure you want to delete this document from your account?")) return;
    soundEffects.playClick();
    try {
      await apiDeleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      soundEffects.playSuccess();
    } catch (err: any) {
      alert("Failed to delete document.");
    }
  };

  const handleOpenInEditor = async (doc: SavedDocument) => {
    soundEffects.playClick();
    try {
      const blob = await apiDownloadDocumentBlob(doc.id);
      const file = new File([blob], doc.original_filename, {
        type: doc.file_type === "pdf" ? "application/pdf" : `image/${doc.file_type}`,
      });
      onOpenDocument(file, doc.id);
    } catch (err) {
      alert("Failed to open document.");
    }
  };

  const handleOpenDownloadedFile = async (dl: UnifiedDownloadItem) => {
    soundEffects.playClick();
    if (dl.blob) {
      const file = new File([dl.blob], dl.filename, {
        type: dl.filename.toLowerCase().endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : dl.filename.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/octet-stream",
      });
      onOpenDocument(file);
    } else if (typeof dl.id === "number" && user) {
      try {
        const blob = await apiDownloadStoredFile(dl.id);
        const file = new File([blob], dl.filename, {
          type: dl.filename.toLowerCase().endsWith(".docx")
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : dl.filename.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "application/octet-stream",
        });
        onOpenDocument(file);
      } catch (err) {
        alert("Could not load stored file binary.");
      }
    } else if (dl.backendId && user) {
      try {
        const blob = await apiDownloadDocumentBlob(dl.backendId);
        const file = new File([blob], dl.filename, {
          type: dl.filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
        });
        onOpenDocument(file);
      } catch (err) {
        alert("Could not load stored file binary.");
      }
    } else {
      alert("Document binary cache is no longer available in this session.");
    }
  };

  const handleReDownloadFile = async (dl: UnifiedDownloadItem) => {
    soundEffects.playClick();
    try {
      if (dl.blob) {
        if (dl.filename.toLowerCase().endsWith(".docx")) {
          downloadWordBlob(dl.blob, dl.filename);
        } else {
          const buffer = await dl.blob.arrayBuffer();
          downloadPdfBytes(new Uint8Array(buffer), dl.filename);
        }
      } else if (typeof dl.id === "number" && user) {
        const blob = await apiDownloadStoredFile(dl.id);
        if (dl.filename.toLowerCase().endsWith(".docx")) {
          downloadWordBlob(blob, dl.filename);
        } else {
          const buffer = await blob.arrayBuffer();
          downloadPdfBytes(new Uint8Array(buffer), dl.filename);
        }
      } else if (dl.backendId && user) {
        const blob = await apiDownloadDocumentBlob(dl.backendId);
        if (dl.filename.toLowerCase().endsWith(".docx")) {
          downloadWordBlob(blob, dl.filename);
        } else {
          const buffer = await blob.arrayBuffer();
          downloadPdfBytes(new Uint8Array(buffer), dl.filename);
        }
      }
      soundEffects.playSuccess();
    } catch (err) {
      alert("Failed to re-download file.");
    }
  };

  const handleDeleteDownloadRecord = async (id: string | number) => {
    soundEffects.playClick();
    if (typeof id === "number" && user) {
      try {
        await apiDeleteDownloadRecord(id);
      } catch (err) {
        console.warn("Could not delete from backend downloads:", err);
      }
    } else if (typeof id === "string") {
      await deleteDownloadedDoc(id);
    }
    setDownloadedDocs((prev) => prev.filter((d) => d.id !== id));
    soundEffects.playSuccess();
  };

  const handleRenameSubmit = async (newFilename: string) => {
    if (!renameTarget) return;
    try {
      const extMatch = newFilename.match(/\.([a-zA-Z0-9]+)$/);
      const finalName = extMatch ? newFilename : `${newFilename}.pdf`;

      const updated = await apiRenameDocument(renameTarget.id, finalName);
      setDocuments((prev) =>
        prev.map((d) => (d.id === renameTarget.id ? { ...d, original_filename: updated.original_filename } : d))
      );
      onRenameDocument?.(renameTarget.id, finalName);
      setRenameTarget(null);
    } catch (err: any) {
      throw new Error(err?.message || "Failed to rename document.");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  };

  if (!user && activeTab === "saved") {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#18181b] rounded-2xl border border-zinc-800 p-8 max-w-xl mx-auto my-8 text-center text-white shadow-2xl gap-5 font-sans">
        <img
          src="/ourpdf-icon.png"
          alt="OurPDF"
          className="w-16 h-16 rounded-2xl object-contain bg-zinc-900 border border-zinc-800 shadow-inner p-1.5"
        />
        <div>
          <h2 className="text-xl font-bold text-white">Sign In to View Saved Documents</h2>
          <p className="text-xs text-zinc-400 max-w-md leading-relaxed mt-1">
            Sign in to access your persistent PDF documents across any browser, view your processing history, and manage your cloud files securely.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEffects.playClick();
              onOpenAuthModal("login");
            }}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              onOpenAuthModal("register");
            }}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs px-6 py-2.5 rounded-xl transition-all cursor-pointer border border-zinc-700"
          >
            <span>Create Account</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 font-sans text-white">
      {/* Header Bar */}
      <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#1DB954] text-black flex items-center justify-center font-bold shrink-0 shadow-md">
            <FolderLock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Documents & Activity</h2>
              {user && (
                <span className="bg-zinc-900 text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded border border-zinc-800">
                  {user.email}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Manage your saved PDFs, download history, and real-time processing logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#1DB954]" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("saved");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "saved"
                ? "bg-zinc-800 text-[#1DB954] border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Saved Documents ({documents.length})</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("downloads");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "downloads"
                ? "bg-zinc-800 text-[#1DB954] border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Downloads ({downloadedDocs.length})</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("recent");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "recent"
                ? "bg-zinc-800 text-[#1DB954] border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Recent Activity ({history.length})</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("drive");
              if (driveStatus.connected && driveFiles.length === 0) {
                loadDriveData();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "drive"
                ? "bg-zinc-800 text-[#1DB954] border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
            </svg>
            <span>Google Drive {driveStatus.connected ? `(${driveFiles.length})` : ""}</span>
          </button>
        </div>

        {/* Instant Document Search Bar */}
        {(activeTab === "saved" || activeTab === "downloads" || activeTab === "drive") && (
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "saved"
                  ? "Search saved documents..."
                  : activeTab === "downloads"
                  ? "Search downloads..."
                  : "Search Drive files..."
              }
              className="w-full bg-zinc-900 text-zinc-100 placeholder-zinc-500 text-xs font-normal pl-9 pr-8 py-2 rounded-xl border border-zinc-800 focus:border-[#1DB954] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 hover:text-white bg-zinc-800 px-1.5 py-0.5 rounded cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: SAVED DOCUMENTS */}
      {activeTab === "saved" && (
        <div>
          {documents.length === 0 ? (
            <div className="py-16 bg-[#18181b] rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 text-center text-zinc-400">
              <FileText className="w-12 h-12 text-zinc-600 mb-1" />
              <h3 className="text-sm font-bold text-zinc-200">No Saved Documents Yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                When you process or edit PDFs, click <span className="text-[#1DB954] font-semibold">"Save to My Documents"</span> to store them securely in your personal OurPDF account.
              </p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-16 bg-[#18181b] rounded-2xl border border-zinc-800 flex flex-col items-center justify-center gap-3 text-center text-zinc-400">
              <Search className="w-10 h-10 text-zinc-600 mb-1" />
              <h3 className="text-sm font-bold text-zinc-200">No documents found</h3>
              <p className="text-xs text-zinc-500">No saved documents matched "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs text-[#1DB954] hover:underline font-semibold cursor-pointer"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => {
                const isSelected = activeFileName === doc.original_filename;
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleOpenInEditor(doc)}
                    className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all shadow-lg cursor-pointer group hover:shadow-2xl ${
                      isSelected
                        ? "bg-[#14231b]/80 border-[#1DB954] shadow-[0_0_20px_rgba(29,185,84,0.18)]"
                        : "bg-[#18181b] border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 shadow-inner ${
                        isSelected ? "bg-[#1DB954] text-black" : "bg-zinc-900 border border-zinc-800 text-[#1DB954]"
                      }`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-white truncate" title={doc.original_filename}>
                            {doc.original_filename}
                          </h4>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-black bg-[#1DB954] px-2 py-0.5 rounded-full shrink-0">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
                          <span className="uppercase font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            {doc.file_type}
                          </span>
                          <span>{formatFileSize(doc.file_size)}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block mt-1">{formatDate(doc.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions Grid */}
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenInEditor(doc)}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#1DB954] hover:bg-[#1ed760] text-black border-[#1DB954]"
                            : "bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-800"
                        }`}
                        title="Select document"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{isSelected ? "Selected" : "Select & Use"}</span>
                      </button>

                      <button
                        onClick={() => setRenameTarget({ id: doc.id, name: doc.original_filename })}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
                        title="Rename Document"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                        title="Download Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DOWNLOADED DOCUMENTS */}
      {activeTab === "downloads" && (
        <div>
          {downloadedDocs.length === 0 ? (
            <div className="py-16 bg-[#18181b] rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 text-center text-zinc-400">
              <ArrowDownToLine className="w-12 h-12 text-zinc-600 mb-1" />
              <h3 className="text-sm font-bold text-zinc-200">No Downloaded Documents Yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                PDFs you download from OurPDF tools will appear here for easy reference and re-downloading.
              </p>
            </div>
          ) : filteredDownloads.length === 0 ? (
            <div className="py-16 bg-[#18181b] rounded-2xl border border-zinc-800 flex flex-col items-center justify-center gap-3 text-center text-zinc-400">
              <Search className="w-10 h-10 text-zinc-600 mb-1" />
              <h3 className="text-sm font-bold text-zinc-200">No downloads matched</h3>
              <p className="text-xs text-zinc-500">No downloaded files match "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs text-[#1DB954] hover:underline font-semibold cursor-pointer"
              >
                Clear Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDownloads.map((dl) => (
                <div
                  key={dl.id}
                  className="bg-[#18181b] p-5 rounded-2xl border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between gap-4 transition-all shadow-lg"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954] shrink-0 font-bold">
                      <ArrowDownToLine className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate" title={dl.filename}>
                        {dl.filename}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
                        <span className="bg-emerald-950/80 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          {dl.toolUsed || "Downloaded"}
                        </span>
                        <span>{formatFileSize(dl.fileSize)}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 block mt-1">{formatDate(dl.downloadDate)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 gap-1.5">
                    <button
                      onClick={() => handleOpenDownloadedFile(dl)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-bold text-white py-1.5 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                      title="Open in Workspace"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#1DB954]" />
                      <span>Open</span>
                    </button>

                    <button
                      onClick={() => handleReDownloadFile(dl)}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                      title="Download file again"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteDownloadRecord(dl.id)}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                      title="Remove from Download History"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RECENT ACTIVITY */}
      {activeTab === "recent" && (
        <div className="bg-[#18181b] p-5 rounded-2xl border border-zinc-800 shadow-xl flex flex-col gap-3">
          {history.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">No recent processing activity logged.</div>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-800">
              {history.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-[#1DB954]">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white capitalize block">{item.operation}</span>
                      <span className="text-[10px] text-zinc-400">{formatDate(item.created_at)}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GOOGLE DRIVE FILES */}
      {activeTab === "drive" && (
        <div>
          {!driveStatus.connected ? (
            <div className="py-16 bg-[#18181b] rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-4 text-center text-zinc-400">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center p-3 shadow-inner">
                <svg className="w-10 h-10" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-bold text-white">Google Drive is Not Connected</h3>
                <p className="text-xs text-zinc-400 mt-1 font-normal leading-relaxed">
                  Connect your Google account to access your Google Drive PDF and image documents directly inside OurPDF.
                </p>
              </div>
              <button
                onClick={handleConnectDrive}
                disabled={isConnectingDrive}
                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-3 rounded-full transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isConnectingDrive ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>Connect Google Drive</span>
                  </>
                )}
              </button>
            </div>
          ) : isLoadingDrive && driveFiles.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
              <Sparkles className="w-8 h-8 text-[#1DB954] animate-spin" />
              <p className="text-xs text-zinc-400">Loading Google Drive files...</p>
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="py-16 bg-[#18181b] rounded-2xl border border-zinc-800 flex flex-col items-center justify-center gap-3 text-center text-zinc-400">
              <FileText className="w-12 h-12 text-zinc-600 mb-1" />
              <h3 className="text-sm font-bold text-zinc-200">No supported files found</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                No PDF or image files found in your connected Google Drive account ({driveStatus.google_email}).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {driveFiles
                .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((file) => {
                  const isImporting = driveImportingId === file.id;
                  return (
                    <div
                      key={file.id}
                      className="bg-[#18181b] p-5 rounded-2xl border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between gap-4 transition-all shadow-lg"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                          {file.mime_type.includes("pdf") ? (
                            <FileText className="w-5 h-5 text-rose-400" />
                          ) : (
                            <Layers className="w-5 h-5 text-[#1DB954]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate" title={file.name}>
                            {file.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
                            <span className="bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-800 uppercase font-mono">
                              {file.mime_type.split("/").pop() || "drive"}
                            </span>
                            <span>{file.size ? formatFileSize(file.size) : "Cloud"}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 block mt-1">
                            {formatDate(file.modified_time || "")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 gap-2">
                        <button
                          onClick={() => handleImportDriveFile(file)}
                          disabled={isImporting}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black text-[11px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isImporting ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5 animate-spin" />
                              <span>Importing...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Import & Use</span>
                            </>
                          )}
                        </button>

                        {file.web_view_link && (
                          <a
                            href={file.web_view_link}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                            title="Open in Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Rename Document Modal */}
      {renameTarget && (
        <RenameDocModal
          isOpen={true}
          currentFilename={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onRename={handleRenameSubmit}
        />
      )}
    </div>
  );
};
