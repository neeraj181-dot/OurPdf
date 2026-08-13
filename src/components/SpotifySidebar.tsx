import React from "react";
import {
  FileText,
  Home,
  Grid,
  FileSearch,
  Plus,
  Trash2,
  FolderOpen,
  Check,
  Zap,
  Lock,
  Volume2,
  VolumeX,
  FileCheck,
  Eraser,
} from "lucide-react";
import { PDFFileItem } from "../types";
import { soundEffects } from "../lib/audio";

interface SpotifySidebarProps {
  files: PDFFileItem[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onRemoveFile: (id: string) => void;
  onUploadClick: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
  onSelectPresetPipeline: (preset: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
}

export const SpotifySidebar: React.FC<SpotifySidebarProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onRemoveFile,
  onUploadClick,
  activeView,
  setActiveView,
  onSelectPresetPipeline,
  soundEnabled,
  setSoundEnabled,
}) => {
  return (
    <aside className="w-64 bg-[#09090b] text-zinc-400 flex flex-col h-full gap-2 p-2 select-none shrink-0 font-sans">
      {/* Top Navigation Box */}
      <div className="bg-[#121215] rounded-xl p-4 flex flex-col gap-3 border border-zinc-800/80">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1DB954] flex items-center justify-center text-black font-bold">
              <FileText className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-zinc-100 font-bold tracking-tight text-sm leading-none flex items-center gap-1.5">
                PDF Studio
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
              setActiveView("ai-lab");
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === "ai-lab"
                ? "bg-zinc-800 text-zinc-100"
                : "hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <FileSearch className={`w-4 h-4 ${activeView === "ai-lab" ? "text-[#1DB954]" : "text-zinc-400"}`} />
            Smart Document Analysis
          </button>
        </nav>
      </div>

      {/* Library & Active Documents Section */}
      <div className="bg-[#121215] rounded-xl p-3 flex-1 flex flex-col min-h-0 border border-zinc-800/80 overflow-hidden">
        <div className="flex items-center justify-between px-2 py-1.5 mb-2">
          <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
            <FolderOpen className="w-4 h-4 text-[#1DB954]" />
            <span>Active Documents</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
              {files.length}
            </span>
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              onUploadClick();
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-zinc-400"
            title="Upload new PDF file"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Uploaded Files List */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar">
          {files.length === 0 ? (
            <div className="text-center py-6 px-3 border border-dashed border-zinc-800 rounded-lg my-2 flex flex-col items-center gap-2 bg-zinc-900/30">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                <FileText className="w-4 h-4" />
              </div>
              <p className="text-xs text-zinc-400 font-normal">No PDF uploaded</p>
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onUploadClick();
                }}
                className="mt-1 bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
              >
                Upload File
              </button>
            </div>
          ) : (
            files.map((item) => {
              const isActive = item.id === activeFileId;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    soundEffects.playClick();
                    onSelectFile(item.id);
                  }}
                  className={`group relative flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100 border-l-2 border-[#1DB954]"
                      : "hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-700/50 flex items-center justify-center shrink-0 overflow-hidden relative">
                    {item.pageThumbnails[0] ? (
                      <img
                        src={item.pageThumbnails[0]}
                        alt="Thumbnail"
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <FileText className="w-4 h-4 text-zinc-400" />
                    )}
                    {isActive && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-[#1DB954]" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate text-zinc-200">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <span>{item.pagesCount} pages</span>
                      <span>•</span>
                      <span>{(item.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEffects.playClick();
                      onRemoveFile(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 transition-all"
                    title="Remove document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
    </aside>
  );
};
