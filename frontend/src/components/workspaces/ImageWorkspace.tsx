import React, { useState, useRef } from "react";
import {
  Image as ImageIcon,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Crop as CropIcon,
  PenTool,
  Sliders,
  Download,
  FileCode,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  rotateImage,
  flipImage,
  resizeImage,
  compressImage,
  convertImageFormat,
  svgToImage,
  downloadImageBlob,
} from "../../lib/imageEngine";
import { convertImageToSvg, downloadSvgString } from "../../lib/imageToSvg";
import { imagesToPDF, downloadPdfBytes } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";

interface ImageWorkspaceProps {
  activeToolId: string | null;
  onSelectTool: (toolId: string) => void;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({
  activeToolId,
  onSelectTool,
}) => {
  // Uploaded Image Files Queue
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Active Processed Image Data URL
  const [currentImageDataUrl, setCurrentImageDataUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(1.333);

  // Format & Compression Settings
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg" | "webp" | "svg">("png");
  const [quality, setQuality] = useState<number>(85);

  // Compression Stats
  const [compressionResult, setCompressionResult] = useState<{
    originalSizeBytes: number;
    compressedSizeBytes: number;
    savedPercentage: number;
  } | null>(null);

  // Vector SVG Result
  const [generatedSvgMarkup, setGeneratedSvgMarkup] = useState<string | null>(null);

  // Loading States
  const [isProcessing, setIsProcessing] = useState(false);

  // File Input Ref
  const imageInputRef = useRef<HTMLInputElement>(null);

  const activeFile = imageFiles[activeImageIndex] || imageFiles[0] || null;

  // Handle Uploading Image Files
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    soundEffects.playClick();
    const newFiles = Array.from(e.target.files);
    const updated = [...imageFiles, ...newFiles];
    setImageFiles(updated);
    if (!currentImageDataUrl && newFiles.length > 0) {
      loadImageFile(newFiles[0]);
    }
    e.target.value = "";
  };

  const loadImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCurrentImageDataUrl(reader.result);
        // Load natural dimensions
        const img = new Image();
        img.onload = () => {
          setDimensions({ width: img.width, height: img.height });
          setAspectRatio(img.width / img.height);
        };
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  // Image Transformations
  const handleRotate = async (deg: 90 | 180 | 270) => {
    if (!currentImageDataUrl) return;
    soundEffects.playClick();
    setIsProcessing(true);
    try {
      const res = await rotateImage(currentImageDataUrl, deg);
      setCurrentImageDataUrl(res);
      soundEffects.playSuccess();
    } catch (err) {
      console.error("Rotation error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlip = async (dir: "horizontal" | "vertical") => {
    if (!currentImageDataUrl) return;
    soundEffects.playClick();
    setIsProcessing(true);
    try {
      const res = await flipImage(currentImageDataUrl, dir);
      setCurrentImageDataUrl(res);
      soundEffects.playSuccess();
    } catch (err) {
      console.error("Flip error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyResize = async () => {
    if (!currentImageDataUrl) return;
    soundEffects.playClick();
    setIsProcessing(true);
    try {
      const res = await resizeImage(currentImageDataUrl, {
        width: dimensions.width,
        height: dimensions.height,
      });
      setCurrentImageDataUrl(res);
      soundEffects.playSuccess();
    } catch (err) {
      console.error("Resize error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format Conversion & Export
  const handleRunFormatConvert = async () => {
    if (!currentImageDataUrl || !activeFile) return;
    soundEffects.playClick();
    setIsProcessing(true);
    try {
      if (outputFormat === "svg") {
        const svgMarkup = await convertImageToSvg(activeFile, { numberOfColors: 32 });
        setGeneratedSvgMarkup(svgMarkup);
      } else {
        const blob = await convertImageFormat(currentImageDataUrl, outputFormat, quality / 100);
        downloadImageBlob(blob, `${activeFile.name.replace(/\.[^/.]+$/, "")}.${outputFormat}`);
      }
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Conversion error:", err);
      alert(`Conversion Failed: ${err?.message || "Error processing image"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Image Compression
  const handleRunCompress = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsProcessing(true);
    try {
      const formatMime = outputFormat === "png" ? "image/png" : outputFormat === "webp" ? "image/webp" : "image/jpeg";
      const res = await compressImage(activeFile, quality / 100, formatMime);
      setCurrentImageDataUrl(res.dataUrl);
      setCompressionResult({
        originalSizeBytes: res.originalSizeBytes,
        compressedSizeBytes: res.compressedSizeBytes,
        savedPercentage: res.savedPercentage,
      });
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Image compression error:", err);
      alert(`Compression Failed: ${err?.message || "Error compressing image"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Images to PDF Conversion
  const handleRunImagesToPdf = async () => {
    if (imageFiles.length === 0) return;
    soundEffects.playClick();
    setIsProcessing(true);
    try {
      const pdfBytes = await imagesToPDF(imageFiles);
      soundEffects.playSuccess();
      downloadPdfBytes(pdfBytes, "Converted_Images.pdf");
    } catch (err: any) {
      console.error("Images to PDF error:", err);
      alert(`Images to PDF Failed: ${err?.message || "Error building PDF file"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper for size display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto p-4 font-sans text-white">
      {/* Header Bar */}
      <div className="bg-[#121215] p-5 rounded-xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1DB954] text-black flex items-center justify-center font-bold shrink-0">
            <ImageIcon className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-100">Image Workspace Studio</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Crop, rotate, resize, compress, format convert, and convert images to PDF or SVG.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-4 py-2.5 rounded-full transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Select / Add Images</span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept="image/png, image/jpeg, image/webp, image/svg+xml"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      </div>

      {imageFiles.length === 0 ? (
        <div className="py-20 bg-[#181818] rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <ImageIcon className="w-16 h-16 text-zinc-600 mb-2" />
          <h3 className="text-base font-bold text-zinc-200">No Image Files Uploaded</h3>
          <p className="text-xs text-zinc-500 max-w-sm text-center">
            Upload PNG, JPG, JPEG, WebP, or SVG image files to edit, compress, convert to PDF, or trace into vector SVG.
          </p>
          <button
            onClick={() => imageInputRef.current?.click()}
            className="mt-2 flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-3 rounded-full transition-all cursor-pointer shadow-lg"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Upload Images Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: IMAGE QUEUE SIDEBAR (3 cols) */}
          <div className="lg:col-span-3 bg-[#181818] p-4 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Image Queue ({imageFiles.length})
              </span>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="p-1 rounded bg-zinc-800 hover:bg-[#1DB954] text-white hover:text-black transition-colors"
                title="Add Image"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
              {imageFiles.map((file, idx) => {
                const isActive = activeImageIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      soundEffects.playClick();
                      setActiveImageIndex(idx);
                      loadImageFile(file);
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                      isActive ? "bg-zinc-800 border-[#1DB954] shadow-md" : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="w-12 h-12 bg-zinc-950 rounded border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-zinc-200 block truncate">{file.name}</span>
                      <span className="text-[10px] text-zinc-500 block">{formatFileSize(file.size)}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundEffects.playClick();
                        const updated = imageFiles.filter((_, i) => i !== idx);
                        setImageFiles(updated);
                        if (updated.length > 0) {
                          setActiveImageIndex(0);
                          loadImageFile(updated[0]);
                        } else {
                          setCurrentImageDataUrl(null);
                        }
                      }}
                      className="p-1 rounded hover:bg-rose-950 text-rose-400"
                      title="Remove Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick Multi-Image Actions */}
            <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
              <button
                onClick={handleRunImagesToPdf}
                disabled={isProcessing || imageFiles.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-2.5 rounded-full transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <FileText className="w-4 h-4 stroke-[2.5]" />
                <span>CONVERT {imageFiles.length} IMAGES TO PDF</span>
              </button>
            </div>
          </div>

          {/* CENTER: IMAGE PREVIEW & TRANSFORM CANVAS (6 cols) */}
          <div className="lg:col-span-6 bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl items-center justify-center min-h-[500px]">
            {/* Transform Controls Ribbon */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRotate(90)}
                  className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleFlip("horizontal")}
                  className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                  title="Flip Horizontal"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleFlip("vertical")}
                  className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                  title="Flip Vertical"
                >
                  <FlipVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Dimensions Indicator */}
              <div className="text-[11px] text-zinc-400 font-mono">
                {dimensions.width} x {dimensions.height} px
              </div>
            </div>

            {/* Main Image Stage Preview */}
            <div className="w-full aspect-square max-h-[420px] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center p-2 relative shadow-inner">
              {currentImageDataUrl ? (
                <img src={currentImageDataUrl} alt="Active" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-xs text-zinc-500">Select an image to preview</span>
              )}
            </div>
          </div>

          {/* RIGHT: IMAGE OPERATIONS & COMPRESSION PANEL (3 cols) */}
          <div className="lg:col-span-3 bg-[#181818] p-4 rounded-2xl border border-zinc-800 flex flex-col gap-5 shadow-xl text-xs">
            <span className="font-bold text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-2">
              Image Tools & Format
            </span>

            {/* Resize Tool Box */}
            <div className="flex flex-col gap-2 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
              <span className="font-bold text-[#1DB954] flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Resize Dimensions</span>
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-1">Width (px)</span>
                  <input
                    type="number"
                    value={dimensions.width}
                    onChange={(e) => {
                      const newW = Number(e.target.value);
                      const newH = lockAspectRatio ? Math.round(newW / aspectRatio) : dimensions.height;
                      setDimensions({ width: newW, height: newH });
                    }}
                    className="w-full bg-zinc-950 text-white p-1.5 rounded border border-zinc-800 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-1">Height (px)</span>
                  <input
                    type="number"
                    value={dimensions.height}
                    onChange={(e) => {
                      const newH = Number(e.target.value);
                      const newW = lockAspectRatio ? Math.round(newH * aspectRatio) : dimensions.width;
                      setDimensions({ width: newW, height: newH });
                    }}
                    className="w-full bg-zinc-950 text-white p-1.5 rounded border border-zinc-800 font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleApplyResize}
                className="mt-1 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-1.5 rounded text-xs transition-colors cursor-pointer"
              >
                Apply Resize
              </button>
            </div>

            {/* Format Convert & Compress Tool */}
            <div className="flex flex-col gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>Format & Compression</span>
              </span>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 font-semibold">Output Format</span>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="bg-zinc-950 text-white font-bold px-2.5 py-1.5 rounded border border-zinc-800 text-xs focus:outline-none"
                >
                  <option value="png">PNG (Lossless)</option>
                  <option value="jpeg">JPG / JPEG (Standard)</option>
                  <option value="webp">WebP (Modern)</option>
                  <option value="svg">SVG Vector Tracing</option>
                </select>
              </div>

              {outputFormat !== "svg" && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                    <span>Quality Level</span>
                    <span className="text-[#1DB954]">{quality}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="accent-[#1DB954] cursor-pointer"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleRunFormatConvert}
                  disabled={isProcessing}
                  className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-2 rounded text-[11px] transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  Convert & Save
                </button>

                <button
                  onClick={handleRunCompress}
                  disabled={isProcessing}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold py-2 rounded text-[11px] transition-all cursor-pointer disabled:opacity-50"
                >
                  Compress Size
                </button>
              </div>
            </div>

            {/* Compression Result Stats */}
            {compressionResult && (
              <div className="bg-emerald-950/60 p-3 rounded-xl border border-emerald-500/30 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Compression Results</span>
                <div className="flex justify-between text-[11px] text-zinc-300 mt-1">
                  <span>Original:</span>
                  <span className="font-mono">{formatFileSize(compressionResult.originalSizeBytes)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-emerald-400 font-bold">
                  <span>Compressed:</span>
                  <span className="font-mono">{formatFileSize(compressionResult.compressedSizeBytes)}</span>
                </div>
                <div className="text-xs font-black text-emerald-300 mt-1 text-right">
                  {compressionResult.savedPercentage}% Space Saved
                </div>
              </div>
            )}

            {/* Generated SVG Result Box */}
            {generatedSvgMarkup && (
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#1DB954]">SVG Vector Ready</span>
                  <button
                    onClick={() => downloadSvgString(generatedSvgMarkup, `${activeFile?.name || "vector"}.svg`)}
                    className="p-1 rounded bg-white text-black hover:bg-zinc-100 font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
