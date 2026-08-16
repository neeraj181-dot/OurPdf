import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  FileText,
  Image as ImageIcon,
  FileCode,
  Download,
  ExternalLink,
  Sparkles,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  UserProfile,
  GoogleDriveFile,
  GoogleDriveStatus,
  apiGetGoogleDriveStatus,
  apiGetGoogleDriveAuthUrl,
  apiGetGoogleDriveFiles,
  apiDownloadGoogleDriveFile,
} from "../lib/api";
import { soundEffects } from "../lib/audio";

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFile: (file: File) => void;
  user?: UserProfile | null;
  onOpenAuthModal?: (mode?: "login" | "register") => void;
}

export const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({
  isOpen,
  onClose,
  onImportFile,
  user,
  onOpenAuthModal,
}) => {
  const [status, setStatus] = useState<GoogleDriveStatus>({ connected: false });
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (user) {
        checkStatusAndLoad();
      } else {
        setStatus({ connected: false });
        setFiles([]);
        setError(null);
        setIsLoading(false);
      }
    }
  }, [isOpen, user]);

  // Multi-channel OAuth listeners (postMessage, BroadcastChannel, storage events)
  useEffect(() => {
    const onAuthSuccess = () => {
      soundEffects.playSuccess();
      setIsConnecting(false);
      checkStatusAndLoad();
    };

    const onAuthError = (errMsg?: string) => {
      setIsConnecting(false);
      setError(errMsg || "Google Drive connection failed.");
    };

    // 1. Window postMessage listener
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "GOOGLE_DRIVE_AUTH_SUCCESS") {
        onAuthSuccess();
      } else if (event.data?.type === "GOOGLE_DRIVE_AUTH_ERROR") {
        onAuthError(event.data?.error);
      }
    };
    window.addEventListener("message", handleMessage);

    // 2. BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("ourpdf_google_drive");
      bc.onmessage = (event) => {
        if (event.data?.type === "GOOGLE_DRIVE_AUTH_SUCCESS") {
          onAuthSuccess();
        } else if (event.data?.type === "GOOGLE_DRIVE_AUTH_ERROR") {
          onAuthError(event.data?.error);
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel not supported", e);
    }

    // 3. Storage event listener (across browser tabs/windows)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ourpdf_google_drive_auth_event" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.type === "GOOGLE_DRIVE_AUTH_SUCCESS") {
            onAuthSuccess();
          } else if (data.type === "GOOGLE_DRIVE_AUTH_ERROR") {
            onAuthError(data.error);
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

  const checkStatusAndLoad = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const driveStatus = await apiGetGoogleDriveStatus();
      setStatus(driveStatus);

      if (driveStatus.connected) {
        const res = await apiGetGoogleDriveFiles();
        setFiles(res.files);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to communicate with Google Drive service.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    soundEffects.playClick();
    if (!user) {
      onClose();
      onOpenAuthModal?.("login");
      return;
    }

    setIsConnecting(true);
    setError(null);
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
        // Fallback: If browser popup blocker intercepts the window, navigate in-tab
        window.location.href = authUrl;
        return;
      }

      // Start popup monitoring & status polling interval
      let checks = 0;
      const maxChecks = 90; // 90 seconds timeout
      const pollTimer = setInterval(async () => {
        checks++;

        // Periodically verify connection status from backend
        if (checks % 2 === 0) {
          try {
            const st = await apiGetGoogleDriveStatus();
            if (st.connected) {
              clearInterval(pollTimer);
              setIsConnecting(false);
              soundEffects.playSuccess();
              checkStatusAndLoad();
              try { popup.close(); } catch(e) {}
              return;
            }
          } catch(e) {}
        }

        // Check if popup was closed by user
        if (popup.closed) {
          clearInterval(pollTimer);
          setTimeout(async () => {
            try {
              const st = await apiGetGoogleDriveStatus();
              setIsConnecting(false);
              if (st.connected) {
                soundEffects.playSuccess();
                checkStatusAndLoad();
              }
            } catch(e) {
              setIsConnecting(false);
            }
          }, 800);
        } else if (checks >= maxChecks) {
          clearInterval(pollTimer);
          setIsConnecting(false);
          setError("Google Drive connection timed out. Please try again.");
        }
      }, 1000);
    } catch (err: any) {
      setIsConnecting(false);
      setError(err?.message || "Could not start Google Drive authorization.");
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!status.connected) return;
    setIsLoading(true);
    try {
      const res = await apiGetGoogleDriveFiles(query.trim() || undefined);
      setFiles(res.files);
    } catch (err: any) {
      console.warn("Search failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = async (driveFile: GoogleDriveFile) => {
    soundEffects.playClick();
    setImportingId(driveFile.id);
    setError(null);

    try {
      const blob = await apiDownloadGoogleDriveFile(driveFile.id);
      const file = new File([blob], driveFile.name, {
        type: driveFile.mime_type || "application/pdf",
      });

      soundEffects.playSuccess();
      onImportFile(file);
      onClose();
    } catch (err: any) {
      console.error("Import from Google Drive error:", err);
      setError(err?.message || "Failed to download and import file from Google Drive.");
    } finally {
      setImportingId(null);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) return <FileText className="w-5 h-5 text-rose-400" />;
    if (mimeType.includes("image")) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (mimeType.includes("word") || mimeType.includes("document"))
      return <FileCode className="w-5 h-5 text-blue-400" />;
    return <FileText className="w-5 h-5 text-zinc-400" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans select-none">
      <div className="bg-[#18181b] border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 via-emerald-500/20 to-amber-500/20 border border-zinc-700/60 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Google Drive</span>
                {status.connected && (
                  <span className="text-[10px] bg-emerald-950/80 text-[#1DB954] px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400 font-normal">
                {status.connected
                  ? `Logged in as ${status.google_email || "Google Account"}`
                  : "Import PDFs and images directly from your Google Drive"}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-950/70 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
          {!user ? (
            /* NOT LOGGED IN STATE */
            <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
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

              <div className="max-w-sm">
                <h4 className="text-base font-bold text-white">Sign In to Access Google Drive</h4>
                <p className="text-xs text-zinc-400 mt-1 font-normal leading-relaxed">
                  Sign in or register your free OurPDF account to connect your Google Drive and import files directly.
                </p>
              </div>

              <button
                onClick={() => {
                  soundEffects.playClick();
                  onClose();
                  onOpenAuthModal?.("login");
                }}
                className="mt-2 flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-3 rounded-full transition-all cursor-pointer shadow-lg"
              >
                <span>Sign In / Create Account</span>
              </button>
            </div>
          ) : !status.connected ? (
            /* NOT CONNECTED STATE */
            <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
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

              <div className="max-w-sm">
                <h4 className="text-base font-bold text-white">Connect Google Drive</h4>
                <p className="text-xs text-zinc-400 mt-1 font-normal leading-relaxed">
                  Connect your Google account to access, convert, and save documents directly to your Google Drive in one click.
                </p>
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="mt-2 flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-3 rounded-full transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <span>Connect Google Drive</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* CONNECTED: FILE BROWSER */
            <div className="flex flex-col gap-4">
              {/* Search & Refresh Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search Google Drive files..."
                    className="w-full bg-zinc-900 text-zinc-100 placeholder-zinc-500 text-xs font-normal pl-9 pr-4 py-2.5 rounded-xl border border-zinc-800 focus:border-[#1DB954] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  onClick={() => handleSearch(searchQuery)}
                  disabled={isLoading}
                  title="Refresh Files"
                  className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Files Grid / List */}
              {isLoading && files.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                  <Sparkles className="w-8 h-8 text-[#1DB954] animate-spin" />
                  <p className="text-xs text-zinc-400">Loading Google Drive files...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="py-16 bg-zinc-900/40 rounded-xl border border-zinc-800/80 flex flex-col items-center justify-center gap-2 text-center text-zinc-400">
                  <FileText className="w-10 h-10 text-zinc-600 mb-1" />
                  <h4 className="text-xs font-bold text-zinc-300">No supported files found</h4>
                  <p className="text-[11px] text-zinc-500 max-w-xs">
                    {searchQuery
                      ? `No Drive files matched "${searchQuery}"`
                      : "No PDF or image files found in your Google Drive."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                  {files.map((file) => {
                    const isImporting = importingId === file.id;
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleSelectFile(file)}
                        className="bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-zinc-700 p-3.5 rounded-xl flex items-start gap-3 transition-all cursor-pointer group shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                          {getFileIcon(file.mime_type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-[#1DB954] transition-colors" title={file.name}>
                            {file.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
                            <span>{formatBytes(file.size)}</span>
                            <span>•</span>
                            <span>{formatDate(file.modified_time)}</span>
                          </div>
                        </div>

                        <button
                          disabled={isImporting}
                          className="shrink-0 p-1.5 rounded-lg bg-zinc-800 group-hover:bg-[#1DB954] text-zinc-300 group-hover:text-black transition-colors"
                          title="Import this file"
                        >
                          {isImporting ? (
                            <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <span className="text-[11px]">Supported: PDF, PNG, JPG, WebP, DOCX</span>
          <button
            onClick={() => {
              soundEffects.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
