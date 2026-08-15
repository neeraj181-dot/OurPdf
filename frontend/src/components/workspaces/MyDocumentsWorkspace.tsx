import React, { useState, useEffect } from "react";
import {
  FolderLock,
  FileText,
  Download,
  Trash2,
  ExternalLink,
  History,
  CheckCircle2,
  Clock,
  LogIn,
  RefreshCw,
  Plus,
  Lock,
} from "lucide-react";
import {
  UserProfile,
  SavedDocument,
  ProcessingHistoryItem,
  apiGetDocuments,
  apiDeleteDocument,
  apiDownloadDocumentBlob,
  apiGetHistory,
} from "../../lib/api";
import { downloadPdfBytes } from "../../lib/pdfEngine";
import { downloadImageBlob } from "../../lib/imageEngine";
import { soundEffects } from "../../lib/audio";

interface MyDocumentsWorkspaceProps {
  user: UserProfile | null;
  onOpenAuthModal: (mode?: "login" | "register") => void;
  onOpenDocument: (file: File) => void;
}

export const MyDocumentsWorkspace: React.FC<MyDocumentsWorkspaceProps> = ({
  user,
  onOpenAuthModal,
  onOpenDocument,
}) => {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [history, setHistory] = useState<ProcessingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"documents" | "history">("documents");

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [docs, hist] = await Promise.all([apiGetDocuments(), apiGetHistory()]);
      setDocuments(docs);
      setHistory(hist);
    } catch (err) {
      console.error("Failed to load user data:", err);
    } finally {
      setIsLoading(false);
    }
  };

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
      onOpenDocument(file);
    } catch (err) {
      alert("Failed to open document.");
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

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#181818] rounded-2xl border border-zinc-800 p-8 max-w-xl mx-auto my-8 text-center text-white shadow-2xl gap-5 font-sans">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954]">
          <FolderLock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Sign In to View My Documents</h2>
          <p className="text-xs text-zinc-400 max-w-md leading-relaxed mt-1">
            Sign in to save and access your documents, view your processing history, and manage your cloud files securely.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEffects.playClick();
              onOpenAuthModal("login");
            }}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-full transition-all cursor-pointer shadow-lg"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              onOpenAuthModal("register");
            }}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs px-6 py-2.5 rounded-full transition-all cursor-pointer border border-zinc-700"
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
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#1DB954] text-black flex items-center justify-center font-bold shrink-0">
            <FolderLock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">My Documents & Activity</h2>
              <span className="bg-zinc-800 text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded border border-zinc-700">
                {user.email}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Securely stored documents and real-time processing history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "documents"
              ? "bg-zinc-800 text-[#1DB954] border border-zinc-700"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Saved Documents ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "history"
              ? "bg-zinc-800 text-[#1DB954] border border-zinc-700"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Recent Activity ({history.length})</span>
        </button>
      </div>

      {/* TAB 1: SAVED DOCUMENTS */}
      {activeTab === "documents" && (
        <div>
          {documents.length === 0 ? (
            <div className="py-16 bg-[#181818] rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 text-center text-zinc-400">
              <FileText className="w-12 h-12 text-zinc-600 mb-1" />
              <h3 className="text-sm font-bold text-zinc-200">No Saved Documents Yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                When you process or edit PDFs and images, click <span className="text-[#1DB954] font-semibold">"Save to My Documents"</span> to store them securely here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between gap-4 transition-all shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954] shrink-0 font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate" title={doc.original_filename}>
                        {doc.original_filename}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
                        <span className="uppercase font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                          {doc.file_type}
                        </span>
                        <span>{formatFileSize(doc.file_size)}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 block mt-1">{formatDate(doc.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 gap-2">
                    <button
                      onClick={() => handleOpenInEditor(doc)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-bold text-white py-1.5 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#1DB954]" />
                      <span>Open</span>
                    </button>

                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                      title="Download Document"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                      title="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECENT ACTIVITY */}
      {activeTab === "history" && (
        <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 shadow-xl flex flex-col gap-3">
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
    </div>
  );
};
