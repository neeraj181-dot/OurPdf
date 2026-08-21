import React, { useState } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  FileText,
  CheckCircle2,
  Download,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Cloud,
  Check,
  HardDrive,
} from "lucide-react";
import { PDFFileItem } from "../../types";
import { soundEffects } from "../../lib/audio";
import { mergePDFs, downloadPdfBytes } from "../../lib/pdfEngine";
import { UserProfile, apiRecordDownload } from "../../lib/api";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface MergeWorkspaceProps {
  files: PDFFileItem[];
  onAddFilesClick: () => void;
  onRemoveFile: (id: string) => void;
  onReorderFiles: (newFiles: PDFFileItem[]) => void;
  user?: UserProfile | null;
  onSaveToCloud?: (bytes: Uint8Array, name: string) => Promise<void>;
  onSaveToGoogleDrive?: (bytes: Uint8Array, name: string) => Promise<void>;
  onDownloadRecorded?: () => void;
}

export const MergeWorkspace: React.FC<MergeWorkspaceProps> = ({
  files,
  onAddFilesClick,
  onRemoveFile,
  onReorderFiles,
  user,
  onSaveToCloud,
  onSaveToGoogleDrive,
  onDownloadRecorded,
}) => {
  const [mergedBytes, setMergedBytes] = useState<Uint8Array | null>(null);
  const [mergedStats, setMergedStats] = useState<{ filesCount: number; pagesCount: number } | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavedCloud, setIsSavedCloud] = useState(false);
  const [isSavedDrive, setIsSavedDrive] = useState(false);

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    soundEffects.playClick();
    setMergedBytes(null);
    setErrorMsg(null);
    const copy = [...files];
    const temp = copy[idx - 1];
    copy[idx - 1] = copy[idx];
    copy[idx] = temp;
    onReorderFiles(copy);
  };

  const moveDown = (idx: number) => {
    if (idx >= files.length - 1) return;
    soundEffects.playClick();
    setMergedBytes(null);
    setErrorMsg(null);
    const copy = [...files];
    const temp = copy[idx + 1];
    copy[idx + 1] = copy[idx];
    copy[idx] = temp;
    onReorderFiles(copy);
  };

  const handleRemove = (id: string) => {
    soundEffects.playClick();
    setMergedBytes(null);
    setErrorMsg(null);
    onRemoveFile(id);
  };

  const totalPages = files.reduce((acc, curr) => acc + (curr.pagesCount || 1), 0);

  // 1. Run Real Merge
  const handleRunMerge = async () => {
    if (files.length < 2) return;
    soundEffects.playClick();
    setIsMerging(true);
    setErrorMsg(null);
    setMergedBytes(null);

    try {
      const fileObjects = files.map((f) => f.file);
      const outputBytes = await mergePDFs(fileObjects);

      if (!outputBytes || outputBytes.length === 0) {
        throw new Error("The generated PDF is empty.");
      }

      setMergedBytes(outputBytes);
      setMergedStats({ filesCount: files.length, pagesCount: totalPages });
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Merge error:", err);
      setErrorMsg(err?.message || "Unable to create the merged PDF.");
    } finally {
      setIsMerging(false);
    }
  };

  // 2. Download Merged PDF
  const handleDownloadMergedPdf = () => {
    if (!mergedBytes || mergedBytes.length === 0) {
      setErrorMsg("Unable to download because the merged PDF is empty.");
      return;
    }

    soundEffects.playSuccess();
    const firstBase = files[0]?.name ? files[0].name.replace(/\.[^/.]+$/, "") : "OurPDF";
    const downloadName = `${firstBase}_Merged.pdf`;

    downloadPdfBytes(mergedBytes, downloadName);
    recordDownloadedDoc(downloadName, mergedBytes.byteLength, "Merge PDF");

    if (user) {
      apiRecordDownload(mergedBytes, downloadName, mergedBytes.byteLength, "Merge PDF");
    }
    if (onDownloadRecorded) onDownloadRecorded();
  };

  // 3. Cloud & Drive Actions
  const handleSaveCloudClick = async () => {
    if (!mergedBytes || !onSaveToCloud) return;
    soundEffects.playClick();
    const firstBase = files[0]?.name ? files[0].name.replace(/\.[^/.]+$/, "") : "OurPDF";
    const downloadName = `${firstBase}_Merged.pdf`;
    try {
      await onSaveToCloud(mergedBytes, downloadName);
      setIsSavedCloud(true);
      soundEffects.playSuccess();
      setTimeout(() => setIsSavedCloud(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveDriveClick = async () => {
    if (!mergedBytes || !onSaveToGoogleDrive) return;
    soundEffects.playClick();
    const firstBase = files[0]?.name ? files[0].name.replace(/\.[^/.]+$/, "") : "OurPDF";
    const downloadName = `${firstBase}_Merged.pdf`;
    try {
      await onSaveToGoogleDrive(mergedBytes, downloadName);
      setIsSavedDrive(true);
      soundEffects.playSuccess();
      setTimeout(() => setIsSavedDrive(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMergeAgain = () => {
    soundEffects.playClick();
    setMergedBytes(null);
    setErrorMsg(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 font-sans text-white">
      {/* Header Banner */}
      <div className="bg-[#121215] p-5 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center gap-5 shadow-xl">
        <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954] shrink-0">
          <Layers className="w-8 h-8" />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold text-[#1DB954] tracking-wider uppercase">
            <span>Document Pipeline</span>
            <span>•</span>
            <span>Multi-File Queue</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold mt-0.5 tracking-tight text-zinc-100">
            Merge PDF Documents
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-lg font-medium">
            Arrange multiple PDF files in your preferred sequence. Compile them into a single continuous document.
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-center sm:items-end gap-0.5 bg-zinc-900/80 px-4 py-2 rounded-xl border border-zinc-800">
          <span className="text-[11px] text-zinc-400 font-normal">Total Combined</span>
          <span className="text-sm font-bold text-[#1DB954]">
            {files.length} Files • {totalPages} Pages
          </span>
        </div>
      </div>

      {/* SUCCESS & DOWNLOAD SECTION (MAIN CONTENT AREA) */}
      {mergedBytes && mergedStats && (
        <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-5 shadow-xl animate-in fade-in duration-300">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-900 border border-emerald-500/50 flex items-center justify-center text-[#1DB954] shrink-0 shadow-lg">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">✓ Merge completed successfully</h3>
              <p className="text-xs text-emerald-300 font-semibold mt-0.5">
                {mergedStats.filesCount} files • {mergedStats.pagesCount} pages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleDownloadMergedPdf}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-3 rounded-full transition-all shadow-[0_0_20px_rgba(29,185,84,0.35)] cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download Merged PDF</span>
            </button>

            <button
              onClick={handleMergeAgain}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold px-4 py-3 rounded-full border border-zinc-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Merge Again</span>
            </button>

            {user && onSaveToCloud && (
              <button
                onClick={handleSaveCloudClick}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold px-4 py-3 rounded-full border border-zinc-700 transition-colors cursor-pointer"
              >
                {isSavedCloud ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <Cloud className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{isSavedCloud ? "Saved to Cloud" : "Save to Cloud"}</span>
              </button>
            )}

            {onSaveToGoogleDrive && (
              <button
                onClick={handleSaveDriveClick}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold px-4 py-3 rounded-full border border-zinc-700 transition-colors cursor-pointer"
              >
                {isSavedDrive ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <HardDrive className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{isSavedDrive ? "Saved to Drive" : "Save to Drive"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ERROR MESSAGE DISPLAY */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">✕ Merge failed</span>
            <span className="text-rose-300/90">{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Document Queue Controls */}
      <div className="bg-[#121215] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <h3 className="font-bold text-xs text-zinc-200 flex items-center gap-2">
            <span>Document Sequence</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-bold">
              {files.length} selected
            </span>
          </h3>

          <button
            onClick={() => {
              soundEffects.playClick();
              onAddFilesClick();
            }}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#1DB954]" />
            <span>Add More PDFs</span>
          </button>
        </div>

        {/* File Queue List */}
        {files.length === 0 ? (
          <div
            onClick={() => {
              soundEffects.playClick();
              onAddFilesClick();
            }}
            className="py-14 border-2 border-dashed border-zinc-800 hover:border-[#1DB954]/50 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-zinc-950/50 group"
          >
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-[#1DB954] group-hover:text-[#1DB954] text-zinc-400 flex items-center justify-center transition-all">
              <Plus className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-zinc-200">Your Merge Queue is Empty</p>
            <p className="text-xs text-zinc-500">Click or drop 2 or more PDF files here to begin merging</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {files.map((file, idx) => (
              <div
                key={file.id}
                className="flex items-center gap-4 bg-[#18181b] hover:bg-[#202024] p-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors group shadow-md"
              >
                <span className="font-mono text-xs font-extrabold text-[#1DB954] bg-emerald-950/60 border border-emerald-800/40 w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                  #{idx + 1}
                </span>

                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700/80 overflow-hidden shrink-0">
                  {file.pageThumbnails && file.pageThumbnails[0] ? (
                    <img
                      src={file.pageThumbnails[0]}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <FileText className="w-5 h-5 text-zinc-500" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{file.name}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                    {file.pagesCount} pages • {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                {/* Move Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors border border-zinc-800"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === files.length - 1}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors border border-zinc-800"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemove(file.id)}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/80 text-zinc-400 hover:text-rose-400 cursor-pointer transition-colors border border-zinc-800"
                    title="Remove file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Merge Trigger Action button */}
        {files.length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-end">
            <button
              onClick={handleRunMerge}
              disabled={isMerging || files.length < 2}
              className={`flex items-center gap-2 px-7 py-3 rounded-full font-extrabold text-xs transition-all shadow-lg cursor-pointer ${
                files.length < 2
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800"
                  : "bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-[0_0_15px_rgba(29,185,84,0.3)]"
              }`}
            >
              {isMerging ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-black" />
                  <span>MERGING {files.length} DOCUMENTS...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>
                    {files.length < 2
                      ? "Add at least 2 files to merge"
                      : `Merge ${files.length} Documents`}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
