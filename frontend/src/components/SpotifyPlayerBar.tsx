import React from "react";
import {
  FileText,
  Download,
  RotateCcw,
  CheckCircle2,
  Check,
  FolderPlus,
  Shield,
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
    activeToolId === "bit-notes-maker" ||
    activeToolId === "bit-notes" ||
    activeToolId === "remove-watermark" ||
    activeToolId === "editor" ||
    activeToolId === "browse" ||
    activeToolId === "home" ||
    activeToolId === "my-docs";

  return (
    <footer className="h-10 bg-[#0f1011] border-t border-[#292c30] px-4 flex items-center justify-between shrink-0 select-none font-sans z-20 text-xs">
      {/* Left: Active Document Status */}
      <div className="flex items-center gap-2.5 min-w-[200px] truncate">
        {activeFile ? (
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-200 font-medium truncate max-w-[240px] text-xs">
              {activeFile.name}
            </span>
            <span className="text-zinc-500 font-mono text-[11px]">
              ({activeFile.pagesCount} {activeFile.pagesCount === 1 ? "page" : "pages"})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
            <FileText className="w-3.5 h-3.5 text-zinc-600" />
            <span>No document loaded</span>
          </div>
        )}
      </div>

      {/* Center: System Status */}
      <div className="hidden md:flex items-center gap-2 text-zinc-400 text-[11px]">
        <Shield className="w-3 h-3 text-[#1db954]" />
        <span>
          {activeToolTitle
            ? `Active tool: ${activeToolTitle}`
            : "Ready · Client-side processing (zero server retention)"}
        </span>
      </div>

      {/* Right: Output Actions if Generated */}
      <div className="flex items-center justify-end gap-2 min-w-[180px]">
        {downloadBytes ? (
          <div className="flex items-center gap-1.5">
            {onSaveToGoogleDrive && (
              <button
                onClick={onSaveToGoogleDrive}
                disabled={isSavedToGoogleDrive || isSavingToGoogleDrive}
                className="flex items-center gap-1 bg-[#17191b] hover:bg-[#1d2023] text-zinc-200 text-xs px-2.5 py-1 rounded-md border border-[#292c30] transition-colors cursor-pointer"
                title="Save to Google Drive"
              >
                {isSavedToGoogleDrive ? (
                  <>
                    <Check className="w-3 h-3 text-[#1db954]" />
                    <span>Drive Saved</span>
                  </>
                ) : (
                  <span>Save to Drive</span>
                )}
              </button>
            )}

            {onSaveToCloud && (
              <button
                onClick={onSaveToCloud}
                disabled={isSavedToCloud}
                className="flex items-center gap-1 bg-[#17191b] hover:bg-[#1d2023] text-zinc-200 text-xs px-2.5 py-1 rounded-md border border-[#292c30] transition-colors cursor-pointer"
                title="Save to Documents"
              >
                {isSavedToCloud ? (
                  <>
                    <Check className="w-3 h-3 text-[#1db954]" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-3 h-3 text-zinc-400" />
                    <span>Save</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => {
                soundEffects.playSuccess();
                onDownloadClick();
              }}
              className="flex items-center gap-1 bg-[#1db954] hover:bg-[#1ed760] text-black font-semibold text-xs px-3 py-1 rounded-md transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3 stroke-[2.5]" />
              <span>Download PDF</span>
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-500 font-mono">100% Private</span>
        )}
      </div>
    </footer>
  );
};

