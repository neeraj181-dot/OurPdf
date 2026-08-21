import React, { useState } from "react";
import { FileArchive, Download, CheckCircle2, Sliders, Sparkles, AlertCircle, RotateCcw, Cloud, FileText, ArrowRight } from "lucide-react";
import { PDFFileItem } from "../../types";
import { apiCompressPdf, apiRecordDownload, UserProfile } from "../../lib/api";
import { downloadPdfBytes } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface CompressWorkspaceProps {
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onDownloadRecorded?: () => void;
}

export const CompressWorkspace: React.FC<CompressWorkspaceProps> = ({
  activeFile,
  user,
  onOpenFilePicker,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  const [compressionLevel, setCompressionLevel] = useState<"low" | "medium" | "high">("medium");
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionResult, setCompressionResult] = useState<{
    bytes: Uint8Array;
    originalSizeBytes: number;
    compressedSizeBytes: number;
    savedPercentage: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavedToCloudState, setIsSavedToCloudState] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleRunCompress = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsCompressing(true);
    setErrorMsg(null);
    setCompressionResult(null);

    try {
      const res = await apiCompressPdf(activeFile.file, compressionLevel);
      setCompressionResult({
        bytes: res.bytes,
        originalSizeBytes: res.originalSize,
        compressedSizeBytes: res.compressedSize,
        savedPercentage: res.savedPercent,
      });
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Compression error:", err);
      setErrorMsg(err?.message || "Failed to compress PDF file.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownloadCompressed = () => {
    if (!compressionResult || !activeFile) return;
    soundEffects.playClick();
    const outName = `compressed_${activeFile.name}`;
    downloadPdfBytes(compressionResult.bytes, outName);

    if (user) {
      apiRecordDownload(compressionResult.bytes, outName, "Compress PDF")
        .then(() => onDownloadRecorded?.())
        .catch((e) => console.warn(e));
    } else {
      recordDownloadedDoc(
        outName,
        compressionResult.compressedSizeBytes,
        activeFile.pagesCount || 1,
        "Compress PDF",
        compressionResult.bytes
      );
      onDownloadRecorded?.();
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 font-sans text-white">
      {/* Header */}
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <FileArchive className="w-4 h-4" />
            <span>COMPRESS PDF</span>
            <span className="bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40 px-2 py-0.5 rounded text-[10px] font-bold ml-1">
              POPULAR
            </span>
          </div>
          <h2 className="text-xl font-bold mt-0.5">Reduce PDF File Size</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Active Document: <span className="text-white font-semibold">{activeFile?.name || "None Selected"}</span>
          </p>
        </div>

        {!activeFile && (
          <button
            onClick={onOpenFilePicker}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-all cursor-pointer shadow-md"
          >
            <span>SELECT PDF FILE</span>
          </button>
        )}
      </div>

      {activeFile && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-6 shadow-xl">
          {/* File Info Card */}
          <div className="bg-zinc-900/90 p-4 rounded-xl border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 text-[#1DB954] flex items-center justify-center border border-zinc-700">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block truncate max-w-xs sm:max-w-md">{activeFile.name}</span>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {activeFile.pagesCount} Pages • {formatFileSize(activeFile.size)} • Ready for Optimization
                </span>
              </div>
            </div>

            <button
              onClick={onOpenFilePicker}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-700 cursor-pointer"
            >
              Change File
            </button>
          </div>

          {/* Compression Level Selector */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#1DB954]" />
              <span>Select Compression Level</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "low",
                  title: "Low Compression",
                  desc: "High quality, minimal size reduction.",
                  badge: "Highest Quality",
                },
                {
                  id: "medium",
                  title: "Medium (Recommended)",
                  desc: "Good quality, balanced size reduction.",
                  badge: "Optimal Balance",
                },
                {
                  id: "high",
                  title: "High Compression",
                  desc: "Maximum size reduction, compressed assets.",
                  badge: "Smallest Size",
                },
              ].map((lvl) => {
                const isSelected = compressionLevel === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    onClick={() => {
                      soundEffects.playClick();
                      setCompressionLevel(lvl.id as any);
                    }}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-zinc-800 border-[#1DB954] shadow-lg shadow-[#1DB954]/10"
                        : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{lvl.title}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{lvl.desc}</p>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded w-fit border border-zinc-800">
                      {lvl.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run Compress Action Button */}
          <button
            onClick={handleRunCompress}
            disabled={isCompressing}
            className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-4 rounded-full transition-all shadow-xl shadow-[#1DB954]/20 cursor-pointer disabled:opacity-50"
          >
            {isCompressing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-black" />
                <span>OPTIMIZING & COMPRESSING STREAMS...</span>
              </>
            ) : (
              <>
                <FileArchive className="w-4 h-4" />
                <span>COMPRESS PDF NOW</span>
              </>
            )}
          </button>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Compression Failed</span>
                <span className="text-zinc-300 mt-0.5 block">{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Compression Results Section */}
          {compressionResult && !errorMsg && (
            <div className="pt-6 border-t border-zinc-800 flex flex-col gap-5 animate-in fade-in">
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1DB954] shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white">PDF Compressed Successfully!</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Your document has been optimized and is ready for download.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onSaveToCloud && (
                    <button
                      onClick={() => {
                        onSaveToCloud(compressionResult.bytes, `compressed_${activeFile.name}`, "compress-pdf");
                        setIsSavedToCloudState(true);
                      }}
                      disabled={isSavedToCloudState}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-3 py-1.5 rounded-lg border border-zinc-700 cursor-pointer"
                    >
                      {isSavedToCloudState ? "Saved" : "Save to Cloud"}
                    </button>
                  )}

                  <button
                    onClick={handleDownloadCompressed}
                    className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Statistics Comparison Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Original Size</span>
                  <span className="text-lg font-black text-white">{formatFileSize(compressionResult.originalSizeBytes)}</span>
                </div>

                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Compressed Size</span>
                  <span className="text-lg font-black text-[#1DB954]">{formatFileSize(compressionResult.compressedSizeBytes)}</span>
                </div>

                <div className="bg-emerald-950/60 p-4 rounded-xl border border-emerald-500/30 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Space Saved</span>
                  <span className="text-lg font-black text-emerald-300">
                    {compressionResult.savedPercentage > 0
                      ? `${compressionResult.savedPercentage}% Saved`
                      : "Already Optimized"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
