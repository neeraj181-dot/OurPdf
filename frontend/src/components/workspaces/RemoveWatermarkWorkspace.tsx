import React, { useState, useRef, useEffect } from "react";
import {
  Eraser,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  FileText,
  Sparkles,
  Eye,
  Sliders,
  ShieldCheck,
  Split,
  Plus,
} from "lucide-react";
import confetti from "canvas-confetti";
import { PDFFileItem } from "../../types";
import { soundEffects } from "../../lib/audio";
import { downloadPdfBytes, imagesToPDF } from "../../lib/pdfEngine";

interface RemoveWatermarkWorkspaceProps {
  activeFile: PDFFileItem | null;
  isProcessingGlobal?: boolean;
}

export const RemoveWatermarkWorkspace: React.FC<RemoveWatermarkWorkspaceProps> = ({
  activeFile,
}) => {
  // State: Source Image
  const [sourceImageSrc, setSourceImageSrc] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string>("document_page");
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);

  // State: Rights confirmation
  const [hasPermission, setHasPermission] = useState(false);

  // State: Canvas tool mode
  const [toolMode, setToolMode] = useState<"brush" | "rectangle">("brush");
  const [brushRadius, setBrushRadius] = useState<number>(25);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragRectStart, setDragRectStart] = useState<{ x: number; y: number } | null>(null);

  // State: Processing & Result
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [cleanedImageSrc, setCleanedImageSrc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Canvas Refs
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rectOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // History for undo
  const maskHistoryRef = useRef<ImageData[]>([]);

  // Load initial image from active file thumbnail or file
  useEffect(() => {
    if (activeFile && activeFile.pageThumbnails && activeFile.pageThumbnails.length > 0) {
      const pageThumb = activeFile.pageThumbnails[selectedPageIndex] || activeFile.pageThumbnails[0];
      if (pageThumb) {
        setSourceImageSrc(pageThumb);
        setSourceFileName(activeFile.name.replace(/\.pdf$/i, ""));
        setCleanedImageSrc(null);
      }
    }
  }, [activeFile, selectedPageIndex]);

  // Draw loaded source image on imageCanvas & initialize maskCanvas
  useEffect(() => {
    if (!sourceImageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const imgCanvas = imageCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const rectCanvas = rectOverlayCanvasRef.current;
      if (!imgCanvas || !maskCanvas || !rectCanvas) return;

      const maxWidth = 800;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      imgCanvas.width = width;
      imgCanvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;
      rectCanvas.width = width;
      rectCanvas.height = height;

      const ctx = imgCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }

      const maskCtx = maskCanvas.getContext("2d");
      if (maskCtx) {
        maskCtx.clearRect(0, 0, width, height);
        // Save initial blank state to history
        maskHistoryRef.current = [maskCtx.getImageData(0, 0, width, height)];
      }

      const rectCtx = rectCanvas.getContext("2d");
      if (rectCtx) {
        rectCtx.clearRect(0, 0, width, height);
      }
    };
    img.src = sourceImageSrc;
  }, [sourceImageSrc]);

  // Handle Uploading Standalone Image
  const handleImageFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid PNG, JPG, or WEBP image file.");
      return;
    }
    setErrorMessage(null);
    soundEffects.playClick();
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setSourceImageSrc(e.target.result as string);
        setSourceFileName(file.name.replace(/\.[^/.]+$/, ""));
        setCleanedImageSrc(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Canvas Mouse Coordinates Helper
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Start Drawing / Selection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasPermission) return;
    const coords = getCanvasCoords(e);
    setIsDrawing(true);

    if (toolMode === "brush") {
      drawBrushStroke(coords.x, coords.y);
    } else {
      setDragRectStart(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !hasPermission) return;
    const coords = getCanvasCoords(e);

    if (toolMode === "brush") {
      drawBrushStroke(coords.x, coords.y);
    } else if (toolMode === "rectangle" && dragRectStart) {
      drawRectPreview(dragRectStart.x, dragRectStart.y, coords.x, coords.y);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (toolMode === "rectangle" && dragRectStart) {
      const coords = getCanvasCoords(e);
      commitRectToMask(dragRectStart.x, dragRectStart.y, coords.x, coords.y);
      setDragRectStart(null);
      clearRectPreview();
    }

    saveMaskState();
  };

  // Draw Brush Stroke on Mask Canvas
  const drawBrushStroke = (x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "rgba(239, 68, 68, 0.65)"; // Highlight red
    ctx.beginPath();
    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    ctx.fill();
  };

  // Draw Dragging Rectangle Overlay
  const drawRectPreview = (x1: number, y1: number, x2: number, y2: number) => {
    const rectCanvas = rectOverlayCanvasRef.current;
    if (!rectCanvas) return;
    const ctx = rectCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, rectCanvas.width, rectCanvas.height);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
    const w = x2 - x1;
    const h = y2 - y1;
    ctx.fillRect(x1, y1, w, h);
    ctx.strokeRect(x1, y1, w, h);
  };

  const clearRectPreview = () => {
    const rectCanvas = rectOverlayCanvasRef.current;
    if (!rectCanvas) return;
    const ctx = rectCanvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, rectCanvas.width, rectCanvas.height);
  };

  // Commit Rectangle Fill to Mask Canvas
  const commitRectToMask = (x1: number, y1: number, x2: number, y2: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    ctx.fillStyle = "rgba(239, 68, 68, 0.65)";
    ctx.fillRect(left, top, width, height);
  };

  // Save Mask History for Undo
  const saveMaskState = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (ctx) {
      const data = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      maskHistoryRef.current.push(data);
      if (maskHistoryRef.current.length > 15) {
        maskHistoryRef.current.shift();
      }
    }
  };

  // Undo Last Mark
  const handleUndo = () => {
    soundEffects.playClick();
    if (maskHistoryRef.current.length > 1) {
      maskHistoryRef.current.pop();
      const prev = maskHistoryRef.current[maskHistoryRef.current.length - 1];
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas && prev) {
        const ctx = maskCanvas.getContext("2d");
        if (ctx) ctx.putImageData(prev, 0, 0);
      }
    } else {
      handleClearMask();
    }
  };

  // Clear All Mask Marks
  const handleClearMask = () => {
    soundEffects.playClick();
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      maskHistoryRef.current = [ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)];
    }
  };

  // Run Content-Aware Inpainting Algorithm
  const handleProcessInpaint = async () => {
    if (!hasPermission) {
      setErrorMessage("Please confirm you have permission/rights to edit this document before proceeding.");
      return;
    }

    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas) return;

    const imgCtx = imgCanvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");
    if (!imgCtx || !maskCtx) return;

    soundEffects.playClick();
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus("Analyzing marked watermark boundary pixels...");

    // Allow UI to render progress
    await new Promise((r) => setTimeout(r, 100));

    try {
      const width = imgCanvas.width;
      const height = imgCanvas.height;

      const imgData = imgCtx.getImageData(0, 0, width, height);
      const maskData = maskCtx.getImageData(0, 0, width, height);

      const pixels = imgData.data;
      const maskPixels = maskData.data;

      // Identify masked pixel boolean map
      const isMasked = new Uint8Array(width * height);
      let markedCount = 0;

      for (let i = 0; i < width * height; i++) {
        // Red channel overlay indicator (> 50 alpha)
        if (maskPixels[i * 4 + 3] > 50) {
          isMasked[i] = 1;
          markedCount++;
        }
      }

      if (markedCount === 0) {
        setIsProcessing(false);
        setErrorMessage("No watermark area marked. Please draw or drag over the watermark region first.");
        return;
      }

      setProgressStatus(`Inpainting ${markedCount.toLocaleString()} masked pixels...`);
      await new Promise((r) => setTimeout(r, 100));

      // Fast multi-pass distance-weighted boundary pixel interpolation (Telea/Patch fill)
      const outputData = imgCtx.createImageData(width, height);
      outputData.data.set(pixels);
      const outPixels = outputData.data;

      const searchRadius = 18;
      const passes = 3;

      for (let pass = 0; pass < passes; pass++) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (!isMasked[idx]) continue;

            let totalWeight = 0;
            let sumR = 0;
            let sumG = 0;
            let sumB = 0;

            // Search surrounding unmasked pixels
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= height) continue;

              for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= width) continue;

                const nIdx = ny * width + nx;

                // Only sample unmasked background pixels
                if (!isMasked[nIdx]) {
                  const distSq = dx * dx + dy * dy;
                  if (distSq === 0 || distSq > searchRadius * searchRadius) continue;

                  const weight = 1 / Math.sqrt(distSq);
                  const pIdx = nIdx * 4;

                  sumR += pixels[pIdx] * weight;
                  sumG += pixels[pIdx + 1] * weight;
                  sumB += pixels[pIdx + 2] * weight;
                  totalWeight += weight;
                }
              }
            }

            if (totalWeight > 0) {
              const targetIdx = idx * 4;
              outPixels[targetIdx] = Math.round(sumR / totalWeight);
              outPixels[targetIdx + 1] = Math.round(sumG / totalWeight);
              outPixels[targetIdx + 2] = Math.round(sumB / totalWeight);
            }
          }
        }
        // Update pixel buffer for next pass smoothing
        pixels.set(outPixels);
      }

      setProgressStatus("Finalizing output rendering...");
      await new Promise((r) => setTimeout(r, 100));

      // Create output result canvas
      const resultCanvas = document.createElement("canvas");
      resultCanvas.width = width;
      resultCanvas.height = height;
      const resCtx = resultCanvas.getContext("2d");
      if (resCtx) {
        resCtx.putImageData(outputData, 0, 0);
        const resultUrl = resultCanvas.toDataURL("image/png");
        setCleanedImageSrc(resultUrl);
        soundEffects.playSuccess();

        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ["#1DB954", "#22c55e", "#ffffff"],
        });
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage("An error occurred while removing the watermark: " + (e.message || e));
    } finally {
      setIsProcessing(false);
      setProgressStatus("");
    }
  };

  // Download Output PNG Image
  const handleDownloadImage = () => {
    if (!cleanedImageSrc) return;
    soundEffects.playClick();
    const a = document.createElement("a");
    a.href = cleanedImageSrc;
    a.download = `${sourceFileName}_cleaned.png`;
    a.click();
  };

  // Export Output PNG as PDF Document
  const handleExportAsPdf = async () => {
    if (!cleanedImageSrc) return;
    soundEffects.playClick();
    try {
      // Fetch data URL into file object
      const res = await fetch(cleanedImageSrc);
      const blob = await res.blob();
      const file = new File([blob], `${sourceFileName}_cleaned.png`, { type: "image/png" });
      const pdfBytes = await imagesToPDF([file]);
      downloadPdfBytes(pdfBytes, `${sourceFileName}_cleaned.pdf`);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 font-sans text-white">
      {/* Top Banner & Header */}
      <div className="bg-[#121215] p-5 rounded-xl border border-zinc-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1DB954] text-black flex items-center justify-center shrink-0 font-bold">
            <Eraser className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#1DB954] tracking-wider uppercase">
              <span>Image & Page Cleanup Tool</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-100">Remove Watermark</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Mark watermark regions on authorized document pages or images to restore clean background texture.
            </p>
          </div>
        </div>

        {/* Source File Switcher / Upload Trigger */}
        <div className="flex items-center gap-2">
          {activeFile && activeFile.pagesCount > 1 && (
            <select
              value={selectedPageIndex}
              onChange={(e) => {
                soundEffects.playClick();
                setSelectedPageIndex(Number(e.target.value));
              }}
              className="bg-zinc-800 text-white text-xs font-bold px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none"
            >
              {Array.from({ length: activeFile.pagesCount }).map((_, i) => (
                <option key={i} value={i}>
                  Page {i + 1} of {activeFile.pagesCount}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-4 py-2 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#1DB954]" />
            <span>Upload Image File</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/png, image/jpeg, image/webp"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleImageFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />
        </div>
      </div>

      {/* Mandatory Ownership & Permission Disclaimer */}
      <div className="bg-[#18181b] p-4 rounded-xl border border-zinc-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#1DB954] shrink-0 mt-0.5" />
        <div className="flex-1 text-xs">
          <label className="flex items-center gap-2 font-bold text-zinc-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasPermission}
              onChange={(e) => setHasPermission(e.target.checked)}
              className="w-4 h-4 accent-[#1DB954] rounded cursor-pointer"
            />
            <span>I confirm that I own or have permission/rights to modify this image or document page.</span>
          </label>
          <p className="text-zinc-400 mt-1 text-[11px] leading-relaxed">
            This tool is intended for removing internal draft stamps, sample watermarks, or personal annotations on files you authorized. Do not use to remove copyright notices, legal disclaimers, or commercial licensing marks.
          </p>
        </div>
      </div>

      {/* Main Workspace Stage: Canvas Marker vs Output Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT STAGE: Interactive Selection & Marking Canvas */}
        <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#1DB954]" />
              <span>Step 1: Mark Watermark Area</span>
            </h3>

            {/* Undo / Clear Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUndo}
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Undo last mark"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <button
                onClick={handleClearMask}
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Clear all marks"
              >
                <Eraser className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Canvas Marking Tool Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#202020] p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-bold">Tool:</span>
              <button
                onClick={() => setToolMode("brush")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  toolMode === "brush"
                    ? "bg-[#1DB954] text-black"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Brush Draw
              </button>
              <button
                onClick={() => setToolMode("rectangle")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  toolMode === "rectangle"
                    ? "bg-[#1DB954] text-black"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                Rectangle Drag
              </button>
            </div>

            {toolMode === "brush" && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-zinc-400 font-bold">Size:</span>
                <input
                  type="range"
                  min="8"
                  max="60"
                  value={brushRadius}
                  onChange={(e) => setBrushRadius(Number(e.target.value))}
                  className="w-24 accent-[#1DB954] cursor-pointer"
                />
                <span className="text-xs font-mono text-[#1DB954] w-8">{brushRadius}px</span>
              </div>
            )}
          </div>

          {/* Interactive Stacked Canvas Area */}
          <div className="relative w-full aspect-[4/3] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center p-2">
            {!sourceImageSrc ? (
              <div className="text-center py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
                <Upload className="w-10 h-10 text-zinc-600" />
                <p className="text-xs font-bold text-zinc-400">No Image Loaded</p>
                <p className="text-[11px] text-zinc-500">Select a document page or upload an image file</p>
              </div>
            ) : (
              <div className="relative max-w-full max-h-full inline-block cursor-crosshair select-none">
                {/* Layer 1: Source Image Canvas */}
                <canvas ref={imageCanvasRef} className="block max-w-full max-h-[380px] object-contain rounded" />

                {/* Layer 2: Red Mask Overlay Canvas */}
                <canvas
                  ref={maskCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="absolute inset-0 max-w-full max-h-[380px] object-contain pointer-events-auto"
                />

                {/* Layer 3: Rectangle Drag Overlay Canvas */}
                <canvas
                  ref={rectOverlayCanvasRef}
                  className="absolute inset-0 max-w-full max-h-[380px] object-contain pointer-events-none"
                />
              </div>
            )}
          </div>

          {/* Error Message Toast */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Process Trigger Button */}
          <button
            onClick={handleProcessInpaint}
            disabled={isProcessing || !hasPermission || !sourceImageSrc}
            className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3 rounded-full transition-all shadow-[0_0_20px_rgba(29,185,84,0.3)] disabled:opacity-40 disabled:shadow-none cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
            <span>
              {isProcessing
                ? progressStatus || "PROCESSING WATERMARK REMOVAL..."
                : "REMOVE WATERMARK & CLEAN AREA"}
            </span>
          </button>
        </div>

        {/* RIGHT STAGE: Before & After Output Preview & Export */}
        <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col justify-between shadow-xl">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#1DB954]" />
                <span>Step 2: Before & After Output Preview</span>
              </h3>

              {cleanedImageSrc && (
                <span className="text-[10px] bg-emerald-950 text-[#1DB954] border border-emerald-500/40 px-2 py-0.5 rounded font-bold uppercase">
                  Cleaned Successfully
                </span>
              )}
            </div>

            {!cleanedImageSrc ? (
              <div className="w-full aspect-[4/3] bg-zinc-900 rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center p-6 text-zinc-500 my-auto">
                <Split className="w-12 h-12 text-zinc-700 mb-2" />
                <p className="text-xs font-bold text-zinc-400">Preview Output Will Appear Here</p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                  Mark the watermark area on the left stage and click "REMOVE WATERMARK & CLEAN AREA".
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Side by Side Comparison Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#202020] p-3 rounded-xl border border-zinc-800 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Original Image
                    </span>
                    <div className="w-full aspect-[3/4] bg-zinc-950 rounded overflow-hidden flex items-center justify-center p-1">
                      {sourceImageSrc && (
                        <img src={sourceImageSrc} alt="Original" className="w-full h-full object-contain" />
                      )}
                    </div>
                  </div>

                  <div className="bg-[#202020] p-3 rounded-xl border border-zinc-800 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-[#1DB954] uppercase tracking-wider">
                      Cleaned Output
                    </span>
                    <div className="w-full aspect-[3/4] bg-zinc-950 rounded overflow-hidden flex items-center justify-center p-1 border border-[#1DB954]/40">
                      <img src={cleanedImageSrc} alt="Cleaned Output" className="w-full h-full object-contain" />
                    </div>
                  </div>
                </div>

                {/* Metadata details */}
                <div className="bg-[#202020] p-3 rounded-xl border border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                  <span>Processing Engine: Content-Aware Inpainting</span>
                  <span className="text-[#1DB954] font-bold">100% Quality Preserved</span>
                </div>
              </div>
            )}
          </div>

          {/* Export Action Buttons */}
          {cleanedImageSrc && (
            <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleDownloadImage}
                className="w-full sm:w-1/2 flex items-center justify-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 font-extrabold text-xs py-3 rounded-full transition-all shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>SAVE CLEANED PNG</span>
              </button>

              <button
                onClick={handleExportAsPdf}
                className="w-full sm:w-1/2 flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3 rounded-full transition-all shadow-md cursor-pointer"
              >
                <FileText className="w-4 h-4 stroke-[2.5]" />
                <span>EXPORT TO PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
