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
  onSaveToGoogleDrive?: () => void;
  isSavedToGoogleDrive?: boolean;
  isSavingToGoogleDrive?: boolean;
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
  onSaveToGoogleDrive,
  isSavedToGoogleDrive,
  isSavingToGoogleDrive,
}) => {
  const isInteractiveWorkspace =
    activeToolId === "remove-watermark" ||
    activeToolId === "editor" ||
    activeToolId === "browse" ||
    activeToolId === "home" ||
    activeToolId === "my-docs";

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


      {/* Right: Output Actions (Save to Cloud + Save to Drive + Download) */}
      <div className="flex items-center justify-end gap-2 w-1/3 min-w-[280px]">
        {downloadBytes ? (
          <>
            {onSaveToGoogleDrive && (
              <button
                onClick={onSaveToGoogleDrive}
                disabled={isSavedToGoogleDrive || isSavingToGoogleDrive}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isSavedToGoogleDrive
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 cursor-default"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700"
                }`}
                title="Save directly to Google Drive"
              >
                {isSavingToGoogleDrive ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-[#1DB954]" />
                    <span>Saving...</span>
                  </>
                ) : isSavedToGoogleDrive ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#1DB954]" />
                    <span>Drive Saved</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                    </svg>
                    <span>Save to Drive</span>
                  </>
                )}
              </button>
            )}

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
                onDownloadClick();
              }}
              className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-md shrink-0"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Download</span>
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
