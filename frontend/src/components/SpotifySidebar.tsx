import React, { useState } from "react";
import {
  FileText,
  Home,
  Grid,
  Plus,
  Trash2,
  FolderOpen,
  Zap,
  Lock,
  Volume2,
  VolumeX,
  FileCheck,
  Eraser,
  User,
  Search,
  Edit3,
  Download,
  MoreVertical,
  X,
} from "lucide-react";
import { PDFFileItem } from "../types";
import { UserProfile } from "../lib/api";
import { soundEffects } from "../lib/audio";
import { RenameDocModal } from "./RenameDocModal";
import { downloadPdfBytes } from "../lib/pdfEngine";

interface SpotifySidebarProps {
  files: PDFFileItem[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onRemoveFile: (id: string) => void;
  onRenameFile?: (id: string, newName: string) => void;
  onUploadClick: () => void;
  onOpenFilePicker: () => void;
  onDropFiles?: (files: FileList | File[]) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  onSelectPresetPipeline: (preset: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  user: UserProfile | null;
  onOpenAuthModal: (mode?: "login" | "register") => void;
  onLogout: () => void;
}

export const SpotifySidebar: React.FC<SpotifySidebarProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onRemoveFile,
  onRenameFile,
  onUploadClick,
  onOpenFilePicker,
  onDropFiles,
  activeView,
  setActiveView,
  onSelectPresetPipeline,
  soundEnabled,
  setSoundEnabled,
  user,
  onOpenAuthModal,
  onLogout,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [renameTarget, setRenameTarget] = useState<PDFFileItem | null>(null);

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  const handleDownloadActiveFile = async (item: PDFFileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playClick();
    try {
      const buffer = await item.file.arrayBuffer();
      downloadPdfBytes(new Uint8Array(buffer), item.name);
      soundEffects.playSuccess();
    } catch (err) {
      alert("Failed to download document.");
    }
  };

  return (
    <aside className="w-64 bg-[#09090b] text-zinc-400 flex flex-col h-full gap-2 p-2 select-none shrink-0 font-sans">
      {/* Top Navigation Box */}
      <div className="bg-[#121215] rounded-xl p-4 flex flex-col gap-3 border border-zinc-800/80">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5">
            <img
              src="/ourpdf-icon.png"
              alt="OurPDF"
              className="w-8 h-8 rounded-lg object-contain bg-zinc-900 border border-zinc-800 shadow-sm p-0.5"
            />
            <div>
              <h1 className="text-zinc-100 font-bold tracking-tight text-sm leading-none flex items-center gap-1.5">
                OurPDF
              </h1>
              <p className="text-[11px] text-zinc-400 mt-1 font-normal">Document Processing</p>
            </div>
          </div>

          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundEffects.enabled = next;
              if (next) soundEffects.playClick();
            }}
            title={soundEnabled ? "Mute audio effects" : "Enable audio effects"}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#1DB954]" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-400" />
            )}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex flex-col gap-1 mt-1">
          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveView("home");
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === "home"
                ? "bg-zinc-800 text-zinc-100"
                : "hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Home className={`w-4 h-4 ${activeView === "home" ? "text-[#1DB954]" : "text-zinc-400"}`} />
            Workspace Home
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveView("browse");
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === "browse"
                ? "bg-zinc-800 text-zinc-100"
                : "hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Grid className={`w-4 h-4 ${activeView === "browse" ? "text-[#1DB954]" : "text-zinc-400"}`} />
            All PDF Tools
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveView("editor");
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === "editor"
                ? "bg-zinc-800 text-zinc-100"
                : "hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <FileText className={`w-4 h-4 ${activeView === "editor" ? "text-[#1DB954]" : "text-zinc-400"}`} />
            Create & Edit PDF
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveView("my-docs");
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === "my-docs"
                ? "bg-zinc-800 text-zinc-100"
                : "hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <FolderOpen className={`w-4 h-4 ${activeView === "my-docs" ? "text-[#1DB954]" : "text-zinc-400"}`} />
            My Documents
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveView("profile");
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === "profile"
                ? "bg-zinc-800 text-zinc-100"
                : "hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <User className={`w-4 h-4 ${activeView === "profile" ? "text-[#1DB954]" : "text-zinc-400"}`} />
            Profile & Account
          </button>
        </nav>
      </div>

      {/* Library & Active Documents Section with Drag & Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onDropFiles) {
            onDropFiles(e.dataTransfer.files);
          }
        }}
        className={`relative bg-[#121215] rounded-xl p-3 flex-1 flex flex-col min-h-0 border transition-all overflow-hidden ${
          isDraggingOver ? "border-[#1DB954] bg-[#1DB954]/10 shadow-[0_0_20px_rgba(29,185,84,0.2)]" : "border-zinc-800/80"
        }`}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center border-2 border-dashed border-[#1DB954] rounded-xl">
            <FolderOpen className="w-8 h-8 text-[#1DB954] animate-bounce mb-2" />
            <p className="text-xs font-bold text-zinc-100">Drop PDF or Image files here</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">They will be added to Active Documents</p>
          </div>
        )}

        <div className="flex items-center justify-between px-1 py-1 mb-1.5">
          <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
            <FolderOpen className="w-4 h-4 text-[#1DB954]" />
            <span>Active Documents</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
              {files.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {files.length > 0 && (
              <button
                onClick={() => {
                  setIsSearching(!isSearching);
                  if (isSearching) setDocSearchQuery("");
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isSearching ? "bg-zinc-800 text-[#1DB954]" : "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                }`}
                title="Search active documents"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => {
                soundEffects.playClick();
                onOpenFilePicker();
              }}
              className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-zinc-400 cursor-pointer"
              title="Upload PDF or Image file"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mini Document Search Input */}
        {isSearching && (
          <div className="relative mb-2">
            <Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
              placeholder="Filter active files..."
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-[11px] rounded-lg pl-7 pr-6 py-1.5 focus:border-[#1DB954] focus:outline-none"
              autoFocus
            />
            {docSearchQuery && (
              <button
                onClick={() => setDocSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Uploaded Files List */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar">
          {files.length === 0 ? (
            <div className="text-center py-6 px-3 border border-dashed border-zinc-800 rounded-lg my-2 flex flex-col items-center gap-2 bg-zinc-900/30">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                <FileText className="w-4 h-4" />
              </div>
              <p className="text-xs text-zinc-400 font-normal">No PDF uploaded</p>
              <p className="text-[10px] text-zinc-500">Click below or drag & drop files here</p>
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onOpenFilePicker();
                }}
                className="mt-1 bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors cursor-pointer"
              >
                Upload File
              </button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-6 px-2 text-zinc-500 text-xs">
              No matching files found.
            </div>
          ) : (
            filteredFiles.map((item) => {
              const isActive = item.id === activeFileId;
              const isImage = !item.name.toLowerCase().endsWith(".pdf");
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    soundEffects.playClick();
                    onSelectFile(item.id);
                  }}
                  className={`group relative flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100 border-l-2 border-[#1DB954]"
                      : "hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-700/50 flex items-center justify-center shrink-0 overflow-hidden relative">
                    {item.pageThumbnails[0] ? (
                      <img
                        src={item.pageThumbnails[0]}
                        alt="Thumbnail"
                        className="w-full h-full object-cover opacity-90"
                      />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate leading-tight text-zinc-200">{item.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1.5">
                      <span>{isImage ? "Image" : `${item.pagesCount} p`}</span>
                      <span>•</span>
                      <span>{(item.size / 1024).toFixed(0)} KB</span>
                    </p>
                  </div>

                  {/* Actions on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(item);
                      }}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                      title="Rename document"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={(e) => handleDownloadActiveFile(item, e)}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-[#1DB954] transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-3 h-3" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundEffects.playClick();
                        onRemoveFile(item.id);
                      }}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 transition-colors"
                      title="Remove document"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Quick Workflows */}
          <div className="mt-4 pt-3 border-t border-zinc-800/80">
            <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold px-2 mb-2">
              Quick Actions
            </p>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("ai-summary");
              }}
              className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800/60 text-xs text-zinc-300 font-medium transition-colors"
            >
              <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <FileCheck className="w-3 h-3 text-[#1DB954]" />
              </div>
              <span className="truncate">Executive Brief</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("merge");
              }}
              className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800/60 text-xs text-zinc-300 font-medium transition-colors"
            >
              <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <Zap className="w-3 h-3 text-[#1DB954]" />
              </div>
              <span className="truncate">Merge Multiple PDFs</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("watermark");
              }}
              title="Add text or logo watermark"
              className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800/60 text-xs text-zinc-300 font-medium transition-colors"
            >
              <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <Lock className="w-3 h-3 text-[#1DB954]" />
              </div>
              <span className="truncate">Add Watermark</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("remove-watermark");
              }}
              title="Mark and erase unwanted watermarks from authorized documents or images"
              className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800/60 text-xs text-zinc-300 font-medium transition-colors"
            >
              <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <Eraser className="w-3 h-3 text-[#1DB954]" />
              </div>
              <span className="truncate">Remove Watermark</span>
            </button>
          </div>
        </div>
      </div>

      {/* User Account Section */}
      <div className="bg-[#121215] rounded-xl p-3 border border-zinc-800/80 flex items-center justify-between text-xs">
        {user ? (
          <div className="flex items-center justify-between w-full">
            <div
              onClick={() => {
                soundEffects.playClick();
                setActiveView("profile");
              }}
              className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
            >
              <div className="w-8 h-8 rounded-full bg-[#1DB954] text-black font-extrabold flex items-center justify-center text-xs shrink-0 group-hover:ring-2 group-hover:ring-[#1DB954]/50 transition-all">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-white block truncate group-hover:text-[#1DB954] transition-colors">
                  {user.name}
                </span>
                <span className="text-[10px] text-zinc-400 block truncate">{user.email}</span>
              </div>
            </div>
            <button
              onClick={() => {
                soundEffects.playClick();
                onLogout();
              }}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 text-[10px] font-bold cursor-pointer"
              title="Sign Out"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 w-full">
            <button
              onClick={() => {
                soundEffects.playClick();
                onOpenAuthModal("login");
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-md"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => {
                soundEffects.playClick();
                onOpenAuthModal("register");
              }}
              className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold py-1.5 rounded-lg text-xs transition-colors cursor-pointer border border-zinc-700"
            >
              <span>Create Free Account</span>
            </button>
          </div>
        )}
      </div>

      {/* Rename Modal for Active Documents */}
      {renameTarget && (
        <RenameDocModal
          isOpen={true}
          currentFilename={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onRename={(newName) => {
            onRenameFile?.(renameTarget.id, newName);
            setRenameTarget(null);
          }}
        />
      )}
    </aside>
  );
};
