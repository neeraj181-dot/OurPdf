import React, { useState } from "react";
import {
  FileText,
  Home,
  Grid,
  Plus,
  Trash2,
  FolderOpen,
  Lock,
  Volume2,
  VolumeX,
  Eraser,
  User,
  Search,
  Edit3,
  Download,
  X,
  StickyNote,
  Layers,
  Scissors,
  Crop,
  RotateCw,
  Hash,
  FileCode,
  TableProperties,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  Stamp,
  FileSignature,
  Code,
  ImagePlus,
  CheckCircle2,
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
  activeToolId?: string | null;
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
  activeToolId,
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
    } catch {
      alert("Failed to download document.");
    }
  };

  const navItemClass = (isActive: boolean) =>
    `flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors w-full text-left cursor-pointer ${
      isActive
        ? "bg-[#17191b] text-white border-l-2 border-[#1db954]"
        : "text-[#9aa0a6] hover:text-[#f1f3f5] hover:bg-[#17191b]/60"
    }`;

  const navIconClass = (isActive: boolean) =>
    `w-4 h-4 shrink-0 ${isActive ? "text-[#1db954]" : "text-zinc-400"}`;

  return (
    <aside className="w-60 bg-[#121315] border-r border-[#292c30] text-zinc-300 flex flex-col h-full select-none shrink-0 font-sans">
      {/* 1. Header: Brand Logo & Subtitle */}
      <div className="h-12 px-4 border-b border-[#292c30] flex items-center justify-between shrink-0">
        <div
          onClick={() => {
            soundEffects.playClick();
            setActiveView("home");
          }}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <img
            src="/ourpdf-icon.png"
            alt="OurPDF"
            className="w-6 h-6 rounded-md object-contain bg-[#17191b] border border-[#292c30] p-0.5"
          />
          <div>
            <h1 className="text-[#f1f3f5] font-bold tracking-tight text-xs leading-none">
              OurPDF
            </h1>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-normal">PDF workspace</p>
          </div>
        </div>

        {/* Audio Effects Toggle */}
        <button
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            soundEffects.enabled = next;
            if (next) soundEffects.playClick();
          }}
          title={soundEnabled ? "Mute audio effects" : "Enable audio effects"}
          className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-[#17191b] transition-colors"
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-[#1db954]" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* 2. Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-4 custom-scrollbar">
        {/* Section: WORKSPACE */}
        <div>
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            Workspace
          </div>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <button
              onClick={() => {
                soundEffects.playClick();
                setActiveView("home");
              }}
              className={navItemClass(activeView === "home" && !activeToolId)}
            >
              <Home className={navIconClass(activeView === "home" && !activeToolId)} />
              <span>Home</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                setActiveView("browse");
              }}
              className={navItemClass(activeView === "browse" && !activeToolId)}
            >
              <Grid className={navIconClass(activeView === "browse" && !activeToolId)} />
              <span>All Tools</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                setActiveView("my-docs");
              }}
              className={navItemClass(activeView === "my-docs")}
            >
              <FolderOpen className={navIconClass(activeView === "my-docs")} />
              <span>Documents</span>
            </button>
          </div>
        </div>

        {/* Section: CREATE & EDIT */}
        <div>
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            Create & Edit
          </div>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("create-pdf");
              }}
              className={navItemClass(activeToolId === "create-pdf")}
            >
              <FileText className={navIconClass(activeToolId === "create-pdf")} />
              <span>Create PDF</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("bit-notes-maker");
              }}
              className={navItemClass(activeToolId === "bit-notes-maker")}
            >
              <StickyNote className={navIconClass(activeToolId === "bit-notes-maker")} />
              <span>Bit Notes Maker</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("sign-pdf");
              }}
              className={navItemClass(activeToolId === "sign-pdf" || activeToolId === "sign")}
            >
              <FileSignature className={navIconClass(activeToolId === "sign-pdf" || activeToolId === "sign")} />
              <span>Fill & Sign</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("word-to-pdf");
              }}
              className={navItemClass(activeToolId === "word-to-pdf")}
            >
              <FileCode className={navIconClass(activeToolId === "word-to-pdf")} />
              <span>Word → PDF</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("img-to-pdf");
              }}
              className={navItemClass(activeToolId === "img-to-pdf")}
            >
              <ImagePlus className={navIconClass(activeToolId === "img-to-pdf")} />
              <span>Image → PDF</span>
            </button>
          </div>
        </div>

        {/* Section: ORGANIZE */}
        <div>
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            Organize
          </div>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("merge");
              }}
              className={navItemClass(activeToolId === "merge")}
            >
              <Layers className={navIconClass(activeToolId === "merge")} />
              <span>Merge</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("split");
              }}
              className={navItemClass(activeToolId === "split")}
            >
              <Scissors className={navIconClass(activeToolId === "split")} />
              <span>Split</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("organize");
              }}
              className={navItemClass(activeToolId === "organize")}
            >
              <Grid className={navIconClass(activeToolId === "organize")} />
              <span>Reorder Pages</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("rotate");
              }}
              className={navItemClass(activeToolId === "rotate")}
            >
              <RotateCw className={navIconClass(activeToolId === "rotate")} />
              <span>Rotate</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("crop-pdf");
              }}
              className={navItemClass(activeToolId === "crop-pdf")}
            >
              <Crop className={navIconClass(activeToolId === "crop-pdf")} />
              <span>Crop</span>
            </button>
          </div>
        </div>

        {/* Section: CONVERT */}
        <div>
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            Convert
          </div>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("pdf-to-word");
              }}
              className={navItemClass(activeToolId === "pdf-to-word")}
            >
              <FileCode className={navIconClass(activeToolId === "pdf-to-word")} />
              <span>PDF → Word</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("pdf-to-excel");
              }}
              className={navItemClass(activeToolId === "pdf-to-excel")}
            >
              <TableProperties className={navIconClass(activeToolId === "pdf-to-excel")} />
              <span>PDF → Excel</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("pdf-to-powerpoint");
              }}
              className={navItemClass(activeToolId === "pdf-to-powerpoint")}
            >
              <FileSpreadsheet className={navIconClass(activeToolId === "pdf-to-powerpoint")} />
              <span>PDF → PowerPoint</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("pdf-to-png");
              }}
              className={navItemClass(activeToolId === "pdf-to-png" || activeToolId === "pdf-to-jpg")}
            >
              <FileImage className={navIconClass(activeToolId === "pdf-to-png" || activeToolId === "pdf-to-jpg")} />
              <span>PDF → Images</span>
            </button>
          </div>
        </div>

        {/* Section: OPTIMIZE & SECURITY */}
        <div>
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            Optimize & Security
          </div>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("compress-pdf");
              }}
              className={navItemClass(activeToolId === "compress-pdf" || activeToolId === "compress")}
            >
              <FileArchive className={navIconClass(activeToolId === "compress-pdf" || activeToolId === "compress")} />
              <span>Compress PDF</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("protect");
              }}
              className={navItemClass(activeToolId === "protect")}
            >
              <Lock className={navIconClass(activeToolId === "protect")} />
              <span>Password Protect</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("watermark");
              }}
              className={navItemClass(activeToolId === "watermark")}
            >
              <Stamp className={navIconClass(activeToolId === "watermark")} />
              <span>Watermark</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playClick();
                onSelectPresetPipeline("remove-watermark");
              }}
              className={navItemClass(activeToolId === "remove-watermark")}
            >
              <Eraser className={navIconClass(activeToolId === "remove-watermark")} />
              <span>Remove Watermark</span>
            </button>
          </div>
        </div>

        {/* Section: RECENT DOCUMENTS LIST */}
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
          className={`pt-2 border-t border-[#292c30] flex flex-col gap-1.5 transition-colors ${
            isDraggingOver ? "bg-[#1db954]/5 rounded-md p-1 border border-[#1db954]" : ""
          }`}
        >
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
              Recent Documents
            </span>
            <button
              onClick={() => onOpenFilePicker()}
              className="text-zinc-500 hover:text-zinc-200 p-0.5 cursor-pointer"
              title="Add document"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {files.length === 0 ? (
            <p className="text-[11px] text-zinc-500 px-3 py-1 font-normal italic">
              No recent documents
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto custom-scrollbar pr-0.5">
              {filteredFiles.slice(0, 8).map((item) => {
                const isActive = item.id === activeFileId;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      soundEffects.playClick();
                      onSelectFile(item.id);
                    }}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                      isActive
                        ? "bg-[#17191b] text-white border-l-2 border-[#1db954]"
                        : "text-[#9aa0a6] hover:text-[#f1f3f5] hover:bg-[#17191b]/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-300" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium leading-tight">{item.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">
                          {item.pagesCount}p · {(item.size / 1024).toFixed(0)}KB
                        </p>
                      </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button
                        onClick={(e) => handleDownloadActiveFile(item, e)}
                        className="p-1 text-zinc-400 hover:text-[#1db954]"
                        title="Download"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEffects.playClick();
                          onRemoveFile(item.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-rose-400"
                        title="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Footer: Account & Settings Navigation */}
      <div className="p-2.5 border-t border-[#292c30] bg-[#0f1011] shrink-0">
        <button
          onClick={() => {
            soundEffects.playClick();
            setActiveView("profile");
          }}
          className={navItemClass(activeView === "profile")}
        >
          <User className={navIconClass(activeView === "profile")} />
          <span className="truncate">{user ? user.name : "Profile & Settings"}</span>
        </button>
      </div>

      {/* Rename Modal */}
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
