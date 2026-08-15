import React, { useState } from "react";
import { FileArchive, Download, CheckCircle2, Sliders, ShieldCheck } from "lucide-react";
import { PDFFileItem } from "../../types";
import { compressPDF, downloadPdfBytes } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";

interface CompressWorkspaceProps {
  activeFile: PDFFileItem | null;
  onOpenFilePicker: () => void;
}

export const CompressWorkspace: React.FC<CompressWorkspaceProps> = ({
  activeFile,
  onOpenFilePicker,
}) => {
  const [compressionLevel, setCompressionLevel] = useState<"low" | "balanced" | "high">("balanced");
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionResult, setCompressionResult] = useState<{
    bytes: Uint8Array;
    originalSizeBytes: number;
    compressedSizeBytes: number;
    savedPercentage: number;
  } | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleRunCompress = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsCompressing(true);
    try {
      const res = await compressPDF(activeFile.file, { level: compressionLevel });
      setCompressionResult(res);
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Compression error:", err);
      alert(`Compression Failed: ${err?.message || "Error processing PDF file"}`);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownloadCompressed = () => {
    if (!compressionResult || !activeFile) return;
    soundEffects.playSuccess();
    downloadPdfBytes(compressionResult.bytes, `compressed_${activeFile.name}`);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 font-sans text-white">
      {/* Header */}
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <FileArchive className="w-4 h-4" />
            <span>COMPRESS PDF (CLIENT-SIDE)</span>
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
                },
                {
                  id: "balanced",
                  title: "Balanced (Recommended)",
                  desc: "Good quality, medium size reduction.",
                },
                {
                  id: "high",
                  title: "High Compression",
                  desc: "Maximum size reduction, compressed assets.",
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
                    className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-zinc-800 border-[#1DB954] shadow-md"
                        : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{lvl.title}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">{lvl.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run Compress Action Button */}
          <button
            onClick={handleRunCompress}
            disabled={isCompressing}
            className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3.5 rounded-full transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            <FileArchive className={`w-4 h-4 ${isCompressing ? "animate-spin" : ""}`} />
            <span>{isCompressing ? "COMPRESSING PDF..." : "COMPRESS PDF NOW"}</span>
          </button>

          {/* Compression Results Section */}
          {compressionResult && (
            <div className="pt-6 border-t border-zinc-800 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954]">
                  <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />
                  <span>Compression Completed Successfully!</span>
                </div>

                <button
                  onClick={handleDownloadCompressed}
                  className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-black font-bold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download Compressed PDF</span>
                </button>
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
                  <span className="text-lg font-black text-emerald-300">{compressionResult.savedPercentage}% Saved</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
