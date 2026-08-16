import React from "react";
import {
  FileText,
  Download,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  FolderPlus,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import { PDFFileItem } from "../types";
import { soundEffects } from "../lib/audio";

interface SpotifyPlayerBarProps {
  activeFile: PDFFileItem | null;
  activeToolTitle: string | null;
  activeToolId?: string | null;
  onProcessAction: () => void;
  isProcessing: boolean;
  downloadBytes: Uint8Array | null;
  downloadFileName: string;
  onDownloadClick: () => void;
  onReset: () => void;
  onSaveToCloud?: () => void;
  isSavedToCloud?: boolean;
}

export const SpotifyPlayerBar: React.FC<SpotifyPlayerBarProps> = ({
  activeFile,
  activeToolTitle,
  activeToolId,
  onProcessAction,
  isProcessing,
  downloadBytes,
  downloadFileName,
  onDownloadClick,
  onReset,
  onSaveToCloud,
  isSavedToCloud,
}) => {
  const isInteractiveWorkspace =
    activeToolId === "remove-watermark" ||
    activeToolId === "editor" ||
    activeToolId === "browse" ||
    activeToolId === "home" ||
    activeToolId === "my-docs";

  const triggerConfetti = () => {
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.85 },
      colors: ["#1DB954", "#22c55e", "#ffffff"],
    });
  };

  return (
    <footer className="h-16 bg-[#121215] border-t border-zinc-800/80 px-6 flex items-center justify-between shrink-0 select-none font-sans z-30">
      {/* Left: Active Document Metadata */}
      <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
        {activeFile ? (
          <>
            <div className="w-9 h-9 rounded bg-zinc-900 border border-zinc-700/60 overflow-hidden shrink-0 relative">
              {activeFile.pageThumbnails[0] ? (
                <img
                  src={activeFile.pageThumbnails[0]}
                  alt="Document Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#1DB954]">
                  <FileText className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-100 truncate">
                {activeFile.name}
              </p>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5 font-normal">
                <span className="text-[#1DB954] font-medium flex items-center gap-1">
                  Selected Document
                </span>
                <span>•</span>
                <span>{activeFile.pagesCount} Pages</span>
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-normal">
            <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <FileText className="w-4 h-4 text-zinc-600" />
            </div>
            <span>No document selected</span>
          </div>
        )}
      </div>

      {/* Center: Action controls */}
      <div className="flex flex-col items-center gap-1 flex-1 max-w-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEffects.playClick();
              onReset();
            }}
            title="Reset workspace"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {!isInteractiveWorkspace && (
            <button
              onClick={() => {
                soundEffects.playClick();
                onProcessAction();
              }}
              disabled={isProcessing || !activeFile}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                isProcessing
                  ? "bg-zinc-800 text-zinc-400 cursor-wait border border-zinc-700"
                  : !activeFile
                  ? "bg-zinc-800/60 text-zinc-500 cursor-not-allowed border border-zinc-800"
                  : "bg-[#1DB954] hover:bg-[#1ed760] text-black"
              }`}
            >
              {isProcessing ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Document...</span>
                </>
              ) : (
                <>
                  <span>
                    {activeToolTitle ? `Process ${activeToolTitle}` : "Select Tool"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </>
              )}
            </button>
          )}
        </div>

        <p className="text-[11px] text-zinc-400 font-normal">
          {activeToolTitle
            ? isInteractiveWorkspace
              ? `Studio Mode: ${activeToolTitle}`
              : `Active Tool: ${activeToolTitle}`
            : "Select a tool to process your PDF or Image"}
        </p>
      </div>


      {/* Right: Output Actions (Save to My Documents + Download) */}
      <div className="flex items-center justify-end gap-2.5 w-1/3 min-w-[240px]">
        {downloadBytes ? (
          <>
            {onSaveToCloud && (
              <button
                onClick={onSaveToCloud}
                disabled={isSavedToCloud}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isSavedToCloud
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 cursor-default"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700"
                }`}
                title="Save to My Documents"
              >
                {isSavedToCloud ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#1DB954]" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-3.5 h-3.5 text-[#1DB954]" />
                    <span>Save to Cloud</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => {
                soundEffects.playSuccess();
                triggerConfetti();
                onDownloadClick();
              }}
              className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Download PDF</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954]" />
            </button>
          </>
        ) : (
          <div className="text-right">
            <p className="text-[11px] text-zinc-400 font-normal">Client-Side Processing</p>
            <p className="text-[10px] text-zinc-400 font-normal">Zero Server Retention</p>
          </div>
        )}
      </div>
    </footer>
  );
};
