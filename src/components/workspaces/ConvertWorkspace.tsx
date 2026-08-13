import React, { useState } from "react";
import { FileImage, ImagePlus, Download, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { PDFFileItem } from "../../types";
import { pdfToImages, downloadPdfBytes } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";

interface ConvertWorkspaceProps {
  mode: "pdf-to-img" | "img-to-pdf";
  activeFile: PDFFileItem | null;
  onImagesToPdfRun: (files: File[]) => void;
  isProcessing: boolean;
}

export const ConvertWorkspace: React.FC<ConvertWorkspaceProps> = ({
  mode,
  activeFile,
  onImagesToPdfRun,
  isProcessing,
}) => {
  // PDF to Image State
  const [renderedImages, setRenderedImages] = useState<string[]>([]);
  const [isRendering, setIsRendering] = useState(false);

  // Image to PDF State
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const handleRenderPdfToImages = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsRendering(true);
    try {
      const imgs = await pdfToImages(activeFile.file);
      setRenderedImages(imgs);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownloadSingleImage = (url: string, index: number) => {
    soundEffects.playSuccess();
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeFile?.name || "document"}_page_${index + 1}.png`;
    a.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const arr = Array.from(e.target.files);
      setImageFiles((prev) => [...prev, ...arr]);
      soundEffects.playClick();
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 font-sans text-white">
      {/* MODE 1: PDF TO IMAGES */}
      {mode === "pdf-to-img" && (
        <div className="flex flex-col gap-5">
          <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                <FileImage className="w-4 h-4" />
                <span>PDF TO IMAGE CONVERTER</span>
              </div>
              <h2 className="text-xl font-bold mt-0.5">Convert PDF Pages to PNG Images</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Active Document: <span className="text-white font-semibold">{activeFile?.name || "None"}</span>
              </p>
            </div>

            <button
              onClick={handleRenderPdfToImages}
              disabled={isRendering || !activeFile}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(29,185,84,0.3)] disabled:opacity-50"
            >
              <FileImage className={`w-4 h-4 ${isRendering ? "animate-spin" : ""}`} />
              <span>{isRendering ? "CONVERTING PAGES..." : "RASTERIZE PDF PAGES TO PNG"}</span>
            </button>
          </div>

          {renderedImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {renderedImages.map((imgUrl, idx) => (
                <div
                  key={idx}
                  className="bg-[#202020] p-3 rounded-xl border border-zinc-800 flex flex-col justify-between group"
                >
                  <div className="aspect-[3/4] bg-zinc-900 rounded overflow-hidden mb-2">
                    <img src={imgUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-400">Page {idx + 1}</span>
                    <button
                      onClick={() => handleDownloadSingleImage(imgUrl, idx)}
                      className="p-1.5 rounded bg-zinc-800 hover:bg-[#1DB954] text-white hover:text-black transition-colors"
                      title="Download PNG"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: IMAGES TO PDF */}
      {mode === "img-to-pdf" && (
        <div className="flex flex-col gap-5">
          <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <ImagePlus className="w-4 h-4" />
                <span>IMAGES TO PDF CONVERTER</span>
              </div>
              <h2 className="text-xl font-bold mt-0.5">Combine Photos & Scans into PDF</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Select JPG/PNG files to compile into a clean PDF document.</p>
            </div>

            <label className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-4 py-2.5 rounded-full cursor-pointer transition-colors">
              <Plus className="w-4 h-4 text-[#1DB954]" />
              <span>Select Image Files</span>
              <input
                type="file"
                multiple
                accept="image/png, image/jpeg, image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {imageFiles.length === 0 ? (
            <div className="py-16 bg-[#181818] rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <ImagePlus className="w-12 h-12 text-zinc-600" />
              <p className="text-sm font-bold">No images selected yet</p>
              <p className="text-xs text-zinc-500">Upload JPG, PNG, or WEBP photos to convert into PDF</p>
            </div>
          ) : (
            <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {imageFiles.map((file, idx) => (
                  <div key={idx} className="bg-[#202020] p-2 rounded-lg border border-zinc-800 relative group">
                    <div className="aspect-square bg-zinc-900 rounded overflow-hidden flex items-center justify-center">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="truncate max-w-[100px]">{file.name}</span>
                      <button
                        onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 rounded hover:bg-rose-950 text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  soundEffects.playClick();
                  onImagesToPdfRun(imageFiles);
                }}
                disabled={isProcessing}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3 rounded-full transition-all shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4 text-black stroke-[3]" />
                <span>COMPILE {imageFiles.length} IMAGES INTO PDF</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
