import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  RotateCcw,
  Download,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
  Target,
  Square,
  Trash2,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { PDFFileItem } from "../../types";
import { soundEffects } from "../../lib/audio";
import {
  downloadPdfBytes,
  imagesToPDF,
  renderPdfPageToDataUrl,
  replacePdfPageWithImage,
  replaceMultiplePdfPagesWithImages,
} from "../../lib/pdfEngine";
import { apiInpaintImage } from "../../lib/api";

interface RemoveWatermarkWorkspaceProps {
  activeFile: PDFFileItem | null;
  isProcessingGlobal?: boolean;
  onUploadFile?: (files: FileList | File[]) => void;
  onProcessedOutput?: (bytes: Uint8Array, filename: string) => void;
}

interface SpotMarker {
  id: string;
  type: "spot" | "box";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
}

export const RemoveWatermarkWorkspace: React.FC<RemoveWatermarkWorkspaceProps> = ({
  activeFile,
  onUploadFile,
  onProcessedOutput,
}) => {
  // State: Source Image & Page
  const [sourceImageSrc, setSourceImageSrc] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string>("document_page");
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);

  // Multi-page edits tracking: stores pageIndex (0-based) -> cleanedImageDataUrl
  const [modifiedPages, setModifiedPages] = useState<{ [pageIndex: number]: string }>({});

  // State: Spot & Box Tool Modes
  const [toolMode, setToolMode] = useState<"spot" | "box">("spot");
  const [spotRadius, setSpotRadius] = useState<number>(30);
  const [spots, setSpots] = useState<SpotMarker[]>([]);

  // Dragging box state
  const [isDraggingBox, setIsDraggingBox] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // State: Processing & Result
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cleanedImageSrc, setCleanedImageSrc] = useState<string | null>(null);
  const [cleanedPdfBytes, setCleanedPdfBytes] = useState<Uint8Array | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset modified pages when activeFile ID changes
  const prevFileIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeFile && activeFile.id !== prevFileIdRef.current) {
      prevFileIdRef.current = activeFile.id;
      setModifiedPages({});
      setCleanedPdfBytes(null);
      setSelectedPageIndex(0);
    }
  }, [activeFile]);

  // Canvas Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load high-resolution page when activeFile or selectedPageIndex changes
  useEffect(() => {
    let isCancelled = false;

    async function loadPage() {
      if (!activeFile) {
        setSourceImageSrc(null);
        setCleanedImageSrc(null);
        setSpots([]);
        return;
      }

      setIsLoadingPage(true);
      setErrorMessage(null);
      setSpots([]);

      const targetIndex = Math.min(Math.max(0, selectedPageIndex), Math.max(0, activeFile.pagesCount - 1));
      setSourceFileName(activeFile.name.replace(/\.pdf$/i, ""));

      // If this page was already modified/cleaned, restore the cleaned preview
      if (modifiedPages[targetIndex]) {
        if (!isCancelled) {
          setSourceImageSrc(modifiedPages[targetIndex]);
          setCleanedImageSrc(modifiedPages[targetIndex]);
          setIsLoadingPage(false);
        }
        return;
      }

      setCleanedImageSrc(null);

      try {
        if (activeFile.file && (activeFile.name.toLowerCase().endsWith(".pdf") || activeFile.file.type.includes("pdf"))) {
          const result = await renderPdfPageToDataUrl(activeFile.file, targetIndex, 1.6);
          if (!isCancelled) {
            setSourceImageSrc(result.dataUrl);
          }
        } else if (activeFile.pageThumbnails && activeFile.pageThumbnails[targetIndex]) {
          if (!isCancelled) {
            setSourceImageSrc(activeFile.pageThumbnails[targetIndex]);
          }
        }
      } catch (err: any) {
        console.error("Error rendering page:", err);
        if (!isCancelled) {
          if (activeFile.pageThumbnails && activeFile.pageThumbnails[targetIndex]) {
            setSourceImageSrc(activeFile.pageThumbnails[targetIndex]);
          } else {
            setErrorMessage(`Failed to load page: ${err?.message || "Invalid file"}`);
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPage(false);
        }
      }
    }

    loadPage();

    return () => {
      isCancelled = true;
    };
  }, [activeFile, selectedPageIndex, modifiedPages]);

  // Draw loaded source image on imageCanvas & initialize mask/overlay canvases
  useEffect(() => {
    if (!sourceImageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const imgCanvas = imageCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!imgCanvas || !maskCanvas || !overlayCanvas) return;

      const width = img.naturalWidth || img.width || 800;
      const height = img.naturalHeight || img.height || 600;

      imgCanvas.width = width;
      imgCanvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;
      overlayCanvas.width = width;
      overlayCanvas.height = height;

      const ctx = imgCanvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }

      redrawMaskAndOverlay(spots, width, height);
    };
    img.src = sourceImageSrc;
  }, [sourceImageSrc, spots]);

  // Redraw mask and subtle spot indicators on overlay canvas
  const redrawMaskAndOverlay = (currentSpots: SpotMarker[], width?: number, height?: number) => {
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!maskCanvas || !overlayCanvas) return;

    const w = width || maskCanvas.width;
    const h = height || maskCanvas.height;

    const maskCtx = maskCanvas.getContext("2d");
    const overCtx = overlayCanvas.getContext("2d");
    if (!maskCtx || !overCtx) return;

    maskCtx.clearRect(0, 0, w, h);
    overCtx.clearRect(0, 0, w, h);

    currentSpots.forEach((spot) => {
      if (spot.type === "spot") {
        const rad = spot.radius || spotRadius;

        // 1. Draw solid on mask canvas for backend inpainting engine
        maskCtx.fillStyle = "rgba(239, 68, 68, 0.95)";
        maskCtx.beginPath();
        maskCtx.arc(spot.x, spot.y, rad, 0, Math.PI * 2);
        maskCtx.fill();

        // 2. Draw subtle clean highlight on visual overlay
        overCtx.strokeStyle = "rgba(29, 185, 84, 0.9)";
        overCtx.lineWidth = 1.5;
        overCtx.fillStyle = "rgba(29, 185, 84, 0.2)";
        overCtx.beginPath();
        overCtx.arc(spot.x, spot.y, rad, 0, Math.PI * 2);
        overCtx.fill();
        overCtx.stroke();

        // Subtle center crosshair
        overCtx.beginPath();
        overCtx.arc(spot.x, spot.y, 2.5, 0, Math.PI * 2);
        overCtx.fillStyle = "#1DB954";
        overCtx.fill();
      } else if (spot.type === "box" && spot.width && spot.height) {
        // Box mask
        maskCtx.fillStyle = "rgba(239, 68, 68, 0.95)";
        maskCtx.fillRect(spot.x, spot.y, spot.width, spot.height);

        // Box overlay
        overCtx.strokeStyle = "rgba(29, 185, 84, 0.9)";
        overCtx.lineWidth = 1.5;
        overCtx.setLineDash([4, 4]);
        overCtx.fillStyle = "rgba(29, 185, 84, 0.18)";
        overCtx.fillRect(spot.x, spot.y, spot.width, spot.height);
        overCtx.strokeRect(spot.x, spot.y, spot.width, spot.height);
        overCtx.setLineDash([]);
      }
    });
  };

  // Canvas Mouse Coordinates Helper
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const rawX = (clientX - rect.left) * scaleX;
    const rawY = (clientY - rect.top) * scaleY;

    return {
      x: Math.min(Math.max(0, rawX), canvas.width),
      y: Math.min(Math.max(0, rawY), canvas.height),
    };
  }, []);

  // Handle Pointer Down
  const handlePointerDown = (clientX: number, clientY: number) => {
    if (!sourceImageSrc) return;
    const coords = getCanvasCoords(clientX, clientY);

    if (toolMode === "spot") {
      soundEffects.playClick();
      const newSpot: SpotMarker = {
        id: `spot-${Date.now()}-${Math.random()}`,
        type: "spot",
        x: coords.x,
        y: coords.y,
        radius: spotRadius,
      };
      setSpots((prev) => [...prev, newSpot]);
    } else if (toolMode === "box") {
      setIsDraggingBox(true);
      setDragStart(coords);
    }
  };

  // Handle Pointer Move (for Box Drag Preview)
  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDraggingBox || !dragStart || toolMode !== "box") return;
    const coords = getCanvasCoords(clientX, clientY);

    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const overCtx = overlayCanvas.getContext("2d");
    if (!overCtx) return;

    redrawMaskAndOverlay(spots);

    const left = Math.min(dragStart.x, coords.x);
    const top = Math.min(dragStart.y, coords.y);
    const width = Math.abs(coords.x - dragStart.x);
    const height = Math.abs(coords.y - dragStart.y);

    overCtx.strokeStyle = "#1DB954";
    overCtx.lineWidth = 1.5;
    overCtx.setLineDash([4, 4]);
    overCtx.fillStyle = "rgba(29, 185, 84, 0.2)";
    overCtx.fillRect(left, top, width, height);
    overCtx.strokeRect(left, top, width, height);
    overCtx.setLineDash([]);
  };

  // Handle Pointer Up (Commit Box)
  const handlePointerUp = (clientX?: number, clientY?: number) => {
    if (!isDraggingBox || !dragStart) return;
    setIsDraggingBox(false);

    if (clientX !== undefined && clientY !== undefined) {
      const coords = getCanvasCoords(clientX, clientY);
      const left = Math.min(dragStart.x, coords.x);
      const top = Math.min(dragStart.y, coords.y);
      const width = Math.abs(coords.x - dragStart.x);
      const height = Math.abs(coords.y - dragStart.y);

      if (width > 4 && height > 4) {
        soundEffects.playClick();
        const newBox: SpotMarker = {
          id: `box-${Date.now()}-${Math.random()}`,
          type: "box",
          x: left,
          y: top,
          width,
          height,
        };
        setSpots((prev) => [...prev, newBox]);
      }
    }
    setDragStart(null);
  };

  // Undo Last Spot
  const handleUndo = () => {
    soundEffects.playClick();
    setSpots((prev) => prev.slice(0, -1));
  };

  // Clear All Spots
  const handleClearAll = () => {
    soundEffects.playClick();
    setSpots([]);
  };

  // Handle Direct File Upload (PDF or Image)
  const handleDirectFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    soundEffects.playClick();

    if (file.name.toLowerCase().endsWith(".pdf") || file.type.includes("pdf")) {
      if (onUploadFile) {
        onUploadFile(files);
      }
      return;
    }

    if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setSourceImageSrc(e.target.result as string);
          setSourceFileName(file.name.replace(/\.[^/.]+$/, ""));
          setCleanedImageSrc(null);
          setCleanedPdfBytes(null);
          setSpots([]);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    setErrorMessage("Please select a PDF or Image file.");
  };

  // Process Watermark Removal
  const handleProcessInpaint = async () => {
    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas || spots.length === 0 || !sourceImageSrc) {
      setErrorMessage("Please click on or drag over the watermark area first.");
      return;
    }

    soundEffects.playClick();
    setIsProcessing(true);
    setErrorMessage(null);

    await new Promise((r) => setTimeout(r, 30));

    try {
      const maskDataUrl = maskCanvas.toDataURL("image/png");

      let resultUrl: string | null = null;

      try {
        resultUrl = await apiInpaintImage(sourceImageSrc, maskDataUrl, "smart", 5, 3);
      } catch (backendErr) {
        console.warn("Inpainting fallback:", backendErr);
      }

      if (!resultUrl) {
        const imgCtx = imgCanvas.getContext("2d");
        const maskCtx = maskCanvas.getContext("2d");
        if (!imgCtx || !maskCtx) throw new Error("Canvas context error");

        const w = imgCanvas.width;
        const h = imgCanvas.height;
        const imgData = imgCtx.getImageData(0, 0, w, h);
        const maskData = maskCtx.getImageData(0, 0, w, h);
        const pixels = imgData.data;
        const maskPixels = maskData.data;

        // 1. Identify all masked pixels (dilated slightly by 2px for smooth anti-aliasing)
        const isRawMasked = new Uint8Array(w * h);
        let minX = w, maxX = 0, minY = h, maxY = 0;
        let totalMasked = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (maskPixels[idx * 4 + 3] > 15 && (maskPixels[idx * 4] > 15 || maskPixels[idx * 4 + 1] > 15 || maskPixels[idx * 4 + 2] > 15)) {
              isRawMasked[idx] = 1;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              totalMasked++;
            }
          }
        }

        if (totalMasked === 0) {
          setIsProcessing(false);
          return;
        }

        // Dilate mask by 2-3px so edges don't leave faint ghost borders
        const isMasked = new Uint8Array(w * h);
        const dilateR = 2;
        for (let y = Math.max(0, minY - dilateR); y <= Math.min(h - 1, maxY + dilateR); y++) {
          for (let x = Math.max(0, minX - dilateR); x <= Math.min(w - 1, maxX + dilateR); x++) {
            let found = false;
            for (let dy = -dilateR; dy <= dilateR && !found; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= h) continue;
              for (let dx = -dilateR; dx <= dilateR; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= w) continue;
                if (isRawMasked[ny * w + nx]) {
                  found = true;
                  break;
                }
              }
            }
            if (found) isMasked[y * w + x] = 1;
          }
        }

        // 2. Extract clean unmasked border pixels (1-6px band around mask)
        const borderPixels: { x: number; y: number; r: number; g: number; b: number; lum: number }[] = [];
        const bandMin = Math.max(0, minY - 8);
        const bandMax = Math.min(h - 1, maxY + 8);
        const bandMinX = Math.max(0, minX - 8);
        const bandMaxX = Math.min(w - 1, maxX + 8);

        for (let y = bandMin; y <= bandMax; y++) {
          for (let x = bandMinX; x <= bandMaxX; x++) {
            const idx = y * w + x;
            if (isMasked[idx]) continue;

            // Check if adjacent to mask
            let isAdjacent = false;
            for (let dy = -3; dy <= 3 && !isAdjacent; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= h) continue;
              for (let dx = -3; dx <= 3; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= w) continue;
                if (isMasked[ny * w + nx]) {
                  isAdjacent = true;
                  break;
                }
              }
            }

            if (isAdjacent) {
              const pIdx = idx * 4;
              const r = pixels[pIdx];
              const g = pixels[pIdx + 1];
              const b = pixels[pIdx + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              borderPixels.push({ x, y, r, g, b, lum });
            }
          }
        }

        // Calculate median background color and filter out dark text strokes at the edge
        let cleanBorder = borderPixels;
        if (borderPixels.length > 10) {
          const sortedLums = [...borderPixels].map((p) => p.lum).sort((a, b) => a - b);
          const medianLum = sortedLums[Math.floor(sortedLums.length * 0.75)]; // Bias towards lighter paper/background
          // Exclude border pixels that are very dark (e.g. text edges)
          const filtered = borderPixels.filter((p) => Math.abs(p.lum - medianLum) < 40 || p.lum >= medianLum - 20);
          if (filtered.length > 5) {
            cleanBorder = filtered;
          }
        }

        const outputData = imgCtx.createImageData(w, h);
        outputData.data.set(pixels);
        const outPixels = outputData.data;

        // Compute median fallback color
        let medR = 255, medG = 255, medB = 255;
        if (cleanBorder.length > 0) {
          const sum = cleanBorder.reduce((acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }), { r: 0, g: 0, b: 0 });
          medR = Math.round(sum.r / cleanBorder.length);
          medG = Math.round(sum.g / cleanBorder.length);
          medB = Math.round(sum.b / cleanBorder.length);
        }

        // 3. Multi-Ray Directional Boundary Interpolation (Zero Blurring / Crisp Document Restoration)
        const rayAngles: { cos: number; sin: number }[] = [];
        const numRays = 16;
        for (let i = 0; i < numRays; i++) {
          const theta = (i * 2 * Math.PI) / numRays;
          rayAngles.push({ cos: Math.cos(theta), sin: Math.sin(theta) });
        }

        for (let y = Math.max(0, minY - dilateR); y <= Math.min(h - 1, maxY + dilateR); y++) {
          for (let x = Math.max(0, minX - dilateR); x <= Math.min(w - 1, maxX + dilateR); x++) {
            const idx = y * w + x;
            if (!isMasked[idx]) continue;

            let totalWeight = 0;
            let sumR = 0, sumG = 0, sumB = 0;

            // Cast 16 rays to find nearest clean border in all directions
            for (let r = 0; r < numRays; r++) {
              const { cos, sin } = rayAngles[r];
              let foundBorder = false;

              for (let step = 1; step <= 250; step++) {
                const rx = Math.round(x + cos * step);
                const ry = Math.round(y + sin * step);

                if (rx < 0 || rx >= w || ry < 0 || ry >= h) break;

                const rIdx = ry * w + rx;
                if (!isMasked[rIdx]) {
                  const pIdx = rIdx * 4;
                  const pr = pixels[pIdx];
                  const pg = pixels[pIdx + 1];
                  const pb = pixels[pIdx + 2];
                  const plum = 0.299 * pr + 0.587 * pg + 0.114 * pb;

                  // Skip dark letter strokes if paper is bright
                  if (cleanBorder.length > 10 && (plum < (medR * 0.299 + medG * 0.587 + medB * 0.114) - 45)) {
                    continue;
                  }

                  const dist = Math.sqrt((rx - x) * (rx - x) + (ry - y) * (ry - y));
                  const weight = 1.0 / (dist * dist + 0.05);

                  sumR += pr * weight;
                  sumG += pg * weight;
                  sumB += pb * weight;
                  totalWeight += weight;
                  foundBorder = true;
                  break;
                }
              }
            }

            const targetIdx = idx * 4;
            if (totalWeight > 0) {
              outPixels[targetIdx] = Math.round(sumR / totalWeight);
              outPixels[targetIdx + 1] = Math.round(sumG / totalWeight);
              outPixels[targetIdx + 2] = Math.round(sumB / totalWeight);
            } else {
              outPixels[targetIdx] = medR;
              outPixels[targetIdx + 1] = medG;
              outPixels[targetIdx + 2] = medB;
            }
          }
        }

        const resCanvas = document.createElement("canvas");
        resCanvas.width = w;
        resCanvas.height = h;
        const resCtx = resCanvas.getContext("2d");
        if (resCtx) {
          resCtx.putImageData(outputData, 0, 0);
          resultUrl = resCanvas.toDataURL("image/png");
        }
      }

      if (resultUrl) {
        setCleanedImageSrc(resultUrl);
        const nextModifiedPages = { ...modifiedPages, [selectedPageIndex]: resultUrl };
        setModifiedPages(nextModifiedPages);

        try {
          const pdfBytes = await replaceMultiplePdfPagesWithImages(
            activeFile?.file || null,
            nextModifiedPages
          );
          setCleanedPdfBytes(pdfBytes);
          if (onProcessedOutput) {
            onProcessedOutput(pdfBytes, `${sourceFileName}_cleaned.pdf`);
          }
        } catch (pdfErr) {
          console.warn("Could not replace PDF page:", pdfErr);
        }

        soundEffects.playSuccess();
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage("Error removing watermark: " + (e.message || e));
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Output PNG
  const handleDownloadImage = () => {
    if (!cleanedImageSrc) return;
    soundEffects.playClick();
    const a = document.createElement("a");
    a.href = cleanedImageSrc;
    a.download = `${sourceFileName}_page_${selectedPageIndex + 1}_cleaned.png`;
    a.click();
  };

  // Export Output PDF (Preserves all pages of the multi-page PDF)
  const handleExportAsPdf = async () => {
    if (!cleanedImageSrc && Object.keys(modifiedPages).length === 0) return;
    soundEffects.playClick();
    try {
      if (activeFile && activeFile.file) {
        const pdfBytes = await replaceMultiplePdfPagesWithImages(
          activeFile.file,
          modifiedPages
        );
        downloadPdfBytes(pdfBytes, `${sourceFileName}_cleaned.pdf`);
      } else if (cleanedPdfBytes) {
        downloadPdfBytes(cleanedPdfBytes, `${sourceFileName}_cleaned.pdf`);
      } else if (cleanedImageSrc) {
        const res = await fetch(cleanedImageSrc);
        const blob = await res.blob();
        const file = new File([blob], `${sourceFileName}_cleaned.png`, { type: "image/png" });
        const pdfBytes = await imagesToPDF([file]);
        downloadPdfBytes(pdfBytes, `${sourceFileName}_cleaned.pdf`);
      }
      soundEffects.playSuccess();
    } catch (e: any) {
      console.error("Export error:", e);
      alert("Failed to export PDF: " + (e?.message || "Export error."));
    }
  };

  const totalPages = activeFile?.pagesCount || 1;

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto p-2 font-sans text-white">
      {/* Sleek Minimal Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#18181b] px-4 py-3 rounded-xl border border-zinc-800/80 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1DB954] text-black flex items-center justify-center font-bold shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100 leading-none">Remove Watermark</h2>
            <p className="text-[11px] text-zinc-400 mt-1">Select watermark areas to erase</p>
          </div>
        </div>

        {/* Rename Option */}
        <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-700/60 focus-within:border-[#1DB954] transition-colors">
          <Pencil className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />
          <input
            type="text"
            value={sourceFileName}
            onChange={(e) => setSourceFileName(e.target.value)}
            placeholder="File name..."
            className="bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none w-32 sm:w-48 placeholder:text-zinc-500"
            title="Click to rename output file"
          />
        </div>

        {/* Page Switcher & File Upload */}
        <div className="flex items-center gap-2">
          {activeFile && totalPages > 1 && (
            <div className="flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 text-xs">
              <button
                onClick={() => setSelectedPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={selectedPageIndex === 0 || isLoadingPage}
                className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold text-zinc-300 text-xs px-1 flex items-center gap-1">
                <span>{selectedPageIndex + 1} / {totalPages}</span>
                {modifiedPages[selectedPageIndex] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] inline-block" title="Page edited" />
                )}
              </span>
              <button
                onClick={() => setSelectedPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={selectedPageIndex >= totalPages - 1 || isLoadingPage}
                className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{sourceImageSrc ? "Change File" : "Upload File"}</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept="application/pdf,.pdf,image/png,image/jpeg,image/jpg,image/webp"
            onChange={(e) => {
              handleDirectFileUpload(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </div>
      </div>

      {/* Main Workspace Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT: Clean Canvas Stage */}
        <div className="bg-[#181818] p-4 rounded-xl border border-zinc-800/90 flex flex-col gap-3 shadow-lg">
          {/* Tool Control Bar */}
          <div className="flex items-center justify-between gap-2 bg-[#202020] p-2 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundEffects.playClick();
                  setToolMode("spot");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  toolMode === "spot" ? "bg-[#1DB954] text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Click Spot</span>
              </button>

              <button
                onClick={() => {
                  soundEffects.playClick();
                  setToolMode("box");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  toolMode === "box" ? "bg-[#1DB954] text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                <span>Drag Box</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {toolMode === "spot" && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span>Size:</span>
                  <input
                    type="range"
                    min="15"
                    max="65"
                    value={spotRadius}
                    onChange={(e) => setSpotRadius(Number(e.target.value))}
                    className="w-16 accent-[#1DB954] cursor-pointer"
                  />
                </div>
              )}

              <button
                onClick={handleUndo}
                disabled={spots.length === 0}
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 text-xs transition-colors cursor-pointer"
                title="Undo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleClearAll}
                disabled={spots.length === 0}
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-rose-400 text-xs transition-colors cursor-pointer"
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Stacked Canvas Area with Drag & Drop */}
          <div
            ref={containerRef}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleDirectFileUpload(e.dataTransfer.files);
              }
            }}
            className="relative w-full min-h-[380px] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center p-2"
          >
            {isLoadingPage ? (
              <div className="text-center py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                <RefreshCw className="w-6 h-6 text-[#1DB954] animate-spin" />
                <p className="text-xs">Loading page...</p>
              </div>
            ) : !sourceImageSrc ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="text-center py-12 flex flex-col items-center justify-center gap-2.5 text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors w-full h-full border-2 border-dashed border-zinc-800 rounded-lg p-6 bg-zinc-900/30"
              >
                <Upload className="w-7 h-7 text-[#1DB954]" />
                <p className="text-xs font-semibold text-zinc-200">Click or Drag & Drop PDF / Image here</p>
              </div>
            ) : (
              <div className="relative inline-block max-w-full max-h-[460px] cursor-crosshair select-none">
                <canvas
                  ref={imageCanvasRef}
                  className="block max-w-full max-h-[440px] w-auto h-auto object-contain rounded shadow"
                />
                <canvas ref={maskCanvasRef} className="hidden" />
                <canvas
                  ref={overlayCanvasRef}
                  onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
                  onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
                  onMouseUp={(e) => handlePointerUp(e.clientX, e.clientY)}
                  onMouseLeave={() => handlePointerUp()}
                  onTouchStart={(e) => {
                    if (e.touches[0]) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  onTouchMove={(e) => {
                    if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  onTouchEnd={() => handlePointerUp()}
                  className="absolute inset-0 max-w-full max-h-[440px] w-full h-full object-contain pointer-events-auto touch-none"
                />
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={handleProcessInpaint}
            disabled={isProcessing || !sourceImageSrc || spots.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs py-3 rounded-lg transition-colors disabled:opacity-40 cursor-pointer shadow-md"
          >
            <Sparkles className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
            <span>
              {isProcessing
                ? "Removing Watermark..."
                : spots.length === 0
                ? "Select Watermark Spots"
                : `Remove ${spots.length} Selected ${spots.length === 1 ? "Spot" : "Spots"}`}
            </span>
          </button>
        </div>

        {/* RIGHT: Clean Output Stage */}
        <div className="bg-[#181818] p-4 rounded-xl border border-zinc-800/90 flex flex-col justify-between shadow-lg">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-300">Cleaned Result</span>
              {cleanedImageSrc && (
                <span className="text-[11px] text-[#1DB954] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready</span>
                </span>
              )}
            </div>

            {!cleanedImageSrc ? (
              <div className="w-full aspect-[4/3] min-h-[340px] bg-zinc-950 rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center p-6 text-zinc-500 my-auto">
                <ImageIcon className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-xs font-medium text-zinc-400">Result will appear here</p>
              </div>
            ) : (
              <div className="w-full aspect-[4/3] max-h-[420px] bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center p-2 overflow-hidden">
                <img src={cleanedImageSrc} alt="Cleaned Result" className="max-w-full max-h-full object-contain rounded" />
              </div>
            )}
          </div>

          {/* Export Actions */}
          {cleanedImageSrc && (
            <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2.5">
              <button
                onClick={handleDownloadImage}
                className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs py-2.5 rounded-lg transition-colors border border-zinc-700 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Save Image</span>
              </button>

              <button
                onClick={handleExportAsPdf}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs py-2.5 rounded-lg transition-colors cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save as PDF {totalPages > 1 ? `(${totalPages} Pages)` : ""}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
