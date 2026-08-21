import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Crop,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sliders,
  RotateCcw,
  Cloud,
  Check,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { apiCropPdf, apiRecordDownload, UserProfile } from "../../lib/api";
import { downloadPdfBytes, fileToArrayBuffer } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface CropWorkspaceProps {
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onDownloadRecorded?: () => void;
}

// Normalized Crop Rect (0.0 to 1.0)
interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type HandleType = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se" | "move";

export const CropWorkspace: React.FC<CropWorkspaceProps> = ({
  activeFile,
  user,
  onOpenFilePicker,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(activeFile?.pagesCount || 1);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 595.28,
    height: 841.89,
  });

  // Normalized Crop Box: x, y, width, height (0.0 to 1.0 relative to page)
  const [normCrop, setNormCrop] = useState<NormalizedRect>({
    x: 0.08,
    y: 0.08,
    width: 0.84,
    height: 0.84,
  });

  // Settings
  const [cropPreset, setCropPreset] = useState<"custom" | "remove_margins" | "a4" | "letter">("custom");
  const [applyScope, setApplyScope] = useState<"all" | "current">("all");

  // Output & Processing
  const [isCropping, setIsCropping] = useState(false);
  const [croppedPdfBytes, setCroppedPdfBytes] = useState<Uint8Array | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavedCloud, setIsSavedCloud] = useState(false);

  // Drag interaction state
  const dragRef = useRef<{
    isDragging: boolean;
    handle: HandleType;
    startX: number;
    startY: number;
    startNorm: NormalizedRect;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Render PDF Page to Canvas
  useEffect(() => {
    let isCancelled = false;
    const renderPage = async () => {
      if (!activeFile || !activeFile.file) return;
      try {
        const buffer = await fileToArrayBuffer(activeFile.file);
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        setTotalPages(pdfDoc.numPages);
        const page = await pdfDoc.getPage(currentPageIndex + 1);
        if (isCancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });

        // Determine container preview scale
        const maxWidth = Math.min(window.innerWidth - 80, 560);
        const scale = maxWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = bgCanvasRef.current;
        if (canvas) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport } as any).promise;
          }
        }
      } catch (err) {
        console.warn("Could not render page canvas:", err);
      }
    };

    renderPage();
    return () => {
      isCancelled = true;
    };
  }, [activeFile, currentPageIndex]);

  // 2. Handle Preset Selection
  const handlePresetSelect = (preset: "custom" | "remove_margins" | "a4" | "letter") => {
    soundEffects.playClick();
    setCropPreset(preset);
    setCroppedPdfBytes(null);

    if (preset === "remove_margins") {
      setNormCrop({ x: 0.1, y: 0.08, width: 0.8, height: 0.84 });
    } else if (preset === "a4") {
      // Standard A4 aspect ratio 1 : 1.414
      const targetRatio = 595.28 / 841.89;
      const currentRatio = pageDimensions.width / pageDimensions.height;
      if (currentRatio > targetRatio) {
        const w = targetRatio / currentRatio;
        setNormCrop({ x: (1 - w) / 2, y: 0.04, width: w, height: 0.92 });
      } else {
        const h = currentRatio / targetRatio;
        setNormCrop({ x: 0.04, y: (1 - h) / 2, width: 0.92, height: h });
      }
    } else if (preset === "letter") {
      // US Letter aspect ratio 612 : 792
      const targetRatio = 612 / 792;
      const currentRatio = pageDimensions.width / pageDimensions.height;
      if (currentRatio > targetRatio) {
        const w = targetRatio / currentRatio;
        setNormCrop({ x: (1 - w) / 2, y: 0.04, width: w, height: 0.92 });
      } else {
        const h = currentRatio / targetRatio;
        setNormCrop({ x: 0.04, y: (1 - h) / 2, width: 0.92, height: h });
      }
    } else {
      setNormCrop({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
    }
  };

  const handleResetCrop = () => {
    soundEffects.playClick();
    setNormCrop({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
    setCropPreset("custom");
    setCroppedPdfBytes(null);
  };

  // 3. Pointer Drag Handlers (Resize and Move)
  const handlePointerDown = (e: React.PointerEvent, handle: HandleType) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    dragRef.current = {
      isDragging: true,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startNorm: { ...normCrop },
      containerWidth: rect.width,
      containerHeight: rect.height,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setCropPreset("custom");
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !dragRef.current.isDragging) return;
    e.preventDefault();

    const { handle, startX, startY, startNorm, containerWidth, containerHeight } = dragRef.current;
    const dx = (e.clientX - startX) / containerWidth;
    const dy = (e.clientY - startY) / containerHeight;

    const minSize = 0.05; // 5% minimum width/height

    let newX = startNorm.x;
    let newY = startNorm.y;
    let newW = startNorm.width;
    let newH = startNorm.height;

    if (handle === "move") {
      newX = Math.max(0, Math.min(1 - newW, startNorm.x + dx));
      newY = Math.max(0, Math.min(1 - newH, startNorm.y + dy));
    } else {
      // Horizontal handle logic
      if (handle.includes("w")) {
        const maxX = startNorm.x + startNorm.width - minSize;
        newX = Math.max(0, Math.min(maxX, startNorm.x + dx));
        newW = startNorm.width - (newX - startNorm.x);
      } else if (handle.includes("e")) {
        newW = Math.max(minSize, Math.min(1 - startNorm.x, startNorm.width + dx));
      }

      // Vertical handle logic
      if (handle.includes("n")) {
        const maxY = startNorm.y + startNorm.height - minSize;
        newY = Math.max(0, Math.min(maxY, startNorm.y + dy));
        newH = startNorm.height - (newY - startNorm.y);
      } else if (handle.includes("s")) {
        newH = Math.max(minSize, Math.min(1 - startNorm.y, startNorm.height + dy));
      }
    }

    setNormCrop({
      x: Math.max(0, Math.min(1, newX)),
      y: Math.max(0, Math.min(1, newY)),
      width: Math.max(minSize, Math.min(1, newW)),
      height: Math.max(minSize, Math.min(1, newH)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      dragRef.current = null;
    }
  };

  // 4. Calculate actual crop box in PDF points
  const pdfCropBox = {
    x: normCrop.x * pageDimensions.width,
    y: normCrop.y * pageDimensions.height,
    width: normCrop.width * pageDimensions.width,
    height: normCrop.height * pageDimensions.height,
  };

  // 5. Execute PDF Crop
  const handleRunCrop = async () => {
    if (!activeFile || !activeFile.file) return;
    soundEffects.playClick();
    setIsCropping(true);
    setErrorMsg(null);
    setCroppedPdfBytes(null);

    try {
      // 1. Try Backend API first
      const cropConfig = {
        apply_to: applyScope,
        selected_pages: [currentPageIndex],
        preset: cropPreset,
        crop_box: {
          x: pdfCropBox.x,
          y: pdfCropBox.y,
          width: pdfCropBox.width,
          height: pdfCropBox.height,
        },
      };

      let outputBytes: Uint8Array;
      try {
        outputBytes = await apiCropPdf(activeFile.file, cropConfig);
      } catch (backendErr) {
        console.warn("Backend crop endpoint unavailable, executing client-side crop:", backendErr);

        // 2. Client-side crop execution using pdf-lib
        const buffer = await fileToArrayBuffer(activeFile.file);
        const pdfDoc = await PDFDocument.load(buffer);
        const total = pdfDoc.getPageCount();

        for (let i = 0; i < total; i++) {
          if (applyScope === "current" && i !== currentPageIndex) {
            continue;
          }
          const page = pdfDoc.getPage(i);
          const { width: pW, height: pH } = page.getSize();

          // Convert coordinates (PDF y-axis goes up from bottom)
          const cropX = normCrop.x * pW;
          const cropW = normCrop.width * pW;
          const cropH = normCrop.height * pH;
          const cropY = pH - (normCrop.y + normCrop.height) * pH;

          page.setCropBox(cropX, cropY, cropW, cropH);
          page.setMediaBox(cropX, cropY, cropW, cropH);
        }

        outputBytes = await pdfDoc.save();
      }

      if (!outputBytes || outputBytes.length === 0) {
        throw new Error("Generated cropped PDF is empty.");
      }

      setCroppedPdfBytes(outputBytes);
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Crop error:", err);
      setErrorMsg(err?.message || "Failed to crop PDF document.");
    } finally {
      setIsCropping(false);
    }
  };

  // 6. Download Cropped PDF
  const handleDownloadCropped = () => {
    if (!croppedPdfBytes || croppedPdfBytes.length === 0 || !activeFile) {
      setErrorMsg("Unable to download because cropped PDF is empty.");
      return;
    }

    soundEffects.playSuccess();
    const outName = `${activeFile.name.replace(/\.[^/.]+$/, "")}_cropped.pdf`;
    downloadPdfBytes(croppedPdfBytes, outName);
    recordDownloadedDoc(outName, croppedPdfBytes.byteLength, totalPages, "Crop PDF", croppedPdfBytes);

    if (user) {
      apiRecordDownload(croppedPdfBytes, outName, croppedPdfBytes.byteLength, "Crop PDF")
        .then(() => onDownloadRecorded?.())
        .catch(() => {});
    } else {
      onDownloadRecorded?.();
    }
  };

  // 7. Cloud Save
  const handleSaveToCloudClick = () => {
    if (!croppedPdfBytes || !activeFile || !onSaveToCloud) return;
    soundEffects.playClick();
    const outName = `${activeFile.name.replace(/\.[^/.]+$/, "")}_cropped.pdf`;
    onSaveToCloud(croppedPdfBytes, outName, "crop-pdf");
    setIsSavedCloud(true);
    setTimeout(() => setIsSavedCloud(false), 3000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 font-sans text-white select-none">
      {/* Header */}
      <div className="bg-[#121215] p-5 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <Crop className="w-4 h-4" />
            <span>CROP PDF</span>
          </div>
          <h2 className="text-xl font-extrabold text-zinc-100 mt-1">Crop PDF Pages & Trim Margins</h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-medium">
            Document: <span className="text-zinc-100 font-semibold">{activeFile?.name || "None Selected"}</span> (
            {totalPages} Pages)
          </p>
        </div>

        {!activeFile && (
          <button
            onClick={onOpenFilePicker}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-full transition-all cursor-pointer shadow-md"
          >
            <span>SELECT PDF FILE</span>
          </button>
        )}
      </div>

      {/* SUCCESS BANNER IN MAIN CONTENT AREA */}
      {croppedPdfBytes && (
        <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-900 border border-emerald-500/50 flex items-center justify-center text-[#1DB954] shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">PDF Cropped Successfully!</h3>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                New dimensions: {Math.round(pdfCropBox.width)} × {Math.round(pdfCropBox.height)} pt (
                {applyScope === "all" ? "All pages" : `Page ${currentPageIndex + 1}`})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleDownloadCropped}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-full transition-all shadow-[0_0_15px_rgba(29,185,84,0.3)] cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download Cropped PDF</span>
            </button>

            {user && onSaveToCloud && (
              <button
                onClick={handleSaveToCloudClick}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-full border border-zinc-700 transition-colors cursor-pointer"
              >
                {isSavedCloud ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <Cloud className="w-3.5 h-3.5" />}
                <span>{isSavedCloud ? "Saved" : "Save to Cloud"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {activeFile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: CROP SETTINGS & SCOPE (5 COLS) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-[#121215] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#1DB954]" />
                  <span>Crop Presets</span>
                </span>
                <button
                  onClick={handleResetCrop}
                  className="text-zinc-400 hover:text-white text-xs flex items-center gap-1 cursor-pointer font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "custom", name: "Custom Box", desc: "Drag handles freely" },
                  { id: "remove_margins", name: "Trim Margins", desc: "Auto margins" },
                  { id: "a4", name: "Standard A4", desc: "595 × 842 pt" },
                  { id: "letter", name: "US Letter", desc: "612 × 792 pt" },
                ].map((p) => {
                  const isSelected = cropPreset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePresetSelect(p.id as any)}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-zinc-800 border-[#1DB954] shadow-md ring-1 ring-[#1DB954]/50"
                          : "bg-zinc-900/80 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{p.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954]" />}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-medium">{p.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Apply Scope */}
              <div className="flex flex-col gap-2 pt-3 border-t border-zinc-800">
                <span className="text-xs font-bold text-zinc-300">Apply Crop To:</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "all", name: "All Pages", desc: `Apply to all ${totalPages} pages` },
                    { id: "current", name: "Current Page Only", desc: `Page ${currentPageIndex + 1}` },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        soundEffects.playClick();
                        setApplyScope(s.id as any);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                        applyScope === s.id
                          ? "bg-[#1DB954] text-black border-[#1DB954] font-extrabold shadow-md"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <span className="text-xs font-bold">{s.name}</span>
                      <span className={`text-[10px] ${applyScope === s.id ? "text-black/80 font-medium" : "text-zinc-500"}`}>
                        {s.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Crop Coordinates Information */}
              <div className="bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800 flex flex-col gap-2 text-xs font-mono">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Crop Area:</span>
                  <span className="text-[#1DB954] font-bold">
                    {Math.round(pdfCropBox.width)} × {Math.round(pdfCropBox.height)} pt
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                  <span>Origin (X, Y):</span>
                  <span>
                    ({Math.round(pdfCropBox.x)}, {Math.round(pdfCropBox.y)}) pt
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                  <span>Page Size:</span>
                  <span>
                    {Math.round(pageDimensions.width)} × {Math.round(pageDimensions.height)} pt
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* PRIMARY ACTION BUTTON */}
              <button
                onClick={handleRunCrop}
                disabled={isCropping}
                className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-4 rounded-full transition-all shadow-[0_0_20px_rgba(29,185,84,0.3)] cursor-pointer disabled:opacity-50"
              >
                {isCropping ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-black" />
                    <span>CROPPING PDF PAGES...</span>
                  </>
                ) : (
                  <>
                    <Crop className="w-4 h-4 stroke-[2.5]" />
                    <span>APPLY CROP & DOWNLOAD</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT: INTERACTIVE CROP BOX CANVAS (7 COLS) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-[#121215] p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
              {/* Pagination controls */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <Layers className="w-4 h-4 text-[#1DB954]" />
                  <span>Document Page Crop View</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                    disabled={currentPageIndex === 0}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-zinc-300 font-bold">
                    Page {currentPageIndex + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPageIndex >= totalPages - 1}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* INTERACTIVE CROP AREA OVERLAY */}
              <div className="bg-zinc-950/90 p-4 rounded-xl border border-zinc-800/80 flex items-center justify-center overflow-auto">
                <div
                  ref={containerRef}
                  className="relative bg-white shadow-2xl rounded overflow-hidden select-none"
                  style={{ touchAction: "none" }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  {/* Layer 1: PDF Canvas */}
                  <canvas ref={bgCanvasRef} className="block pointer-events-none" />

                  {/* Layer 2: Dimmed Outside Overlays */}
                  {/* Top Dim */}
                  <div
                    className="absolute bg-black/60 pointer-events-none"
                    style={{
                      left: 0,
                      top: 0,
                      right: 0,
                      height: `${normCrop.y * 100}%`,
                    }}
                  />
                  {/* Bottom Dim */}
                  <div
                    className="absolute bg-black/60 pointer-events-none"
                    style={{
                      left: 0,
                      top: `${(normCrop.y + normCrop.height) * 100}%`,
                      right: 0,
                      bottom: 0,
                    }}
                  />
                  {/* Left Dim */}
                  <div
                    className="absolute bg-black/60 pointer-events-none"
                    style={{
                      left: 0,
                      top: `${normCrop.y * 100}%`,
                      width: `${normCrop.x * 100}%`,
                      height: `${normCrop.height * 100}%`,
                    }}
                  />
                  {/* Right Dim */}
                  <div
                    className="absolute bg-black/60 pointer-events-none"
                    style={{
                      left: `${(normCrop.x + normCrop.width) * 100}%`,
                      top: `${normCrop.y * 100}%`,
                      right: 0,
                      height: `${normCrop.height * 100}%`,
                    }}
                  />

                  {/* Layer 3: Interactive Clear Crop Box (Draggable Body) */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "move")}
                    style={{
                      left: `${normCrop.x * 100}%`,
                      top: `${normCrop.y * 100}%`,
                      width: `${normCrop.width * 100}%`,
                      height: `${normCrop.height * 100}%`,
                      touchAction: "none",
                    }}
                    className="absolute border-2 border-dashed border-[#1DB954] cursor-move shadow-2xl z-20 group"
                  >
                    {/* Live Crop Badge */}
                    <div className="absolute top-2 left-2 bg-black/85 backdrop-blur px-2.5 py-1 rounded-md text-[10px] text-white font-mono font-bold shadow-md pointer-events-none border border-zinc-700">
                      Crop Area: {Math.round(pdfCropBox.width)} × {Math.round(pdfCropBox.height)} pt
                    </div>

                    {/* Layer 4: 8 Resize Handles */}
                    {/* Corners */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "nw")}
                      className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full bg-[#1DB954] border-2 border-white cursor-nw-resize shadow-md hover:scale-125 transition-transform z-30"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "ne")}
                      className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-[#1DB954] border-2 border-white cursor-ne-resize shadow-md hover:scale-125 transition-transform z-30"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "sw")}
                      className="absolute -bottom-2.5 -left-2.5 w-5 h-5 rounded-full bg-[#1DB954] border-2 border-white cursor-sw-resize shadow-md hover:scale-125 transition-transform z-30"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "se")}
                      className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full bg-[#1DB954] border-2 border-white cursor-se-resize shadow-md hover:scale-125 transition-transform z-30"
                    />

                    {/* Edge Centers */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "n")}
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#1DB954] border-2 border-white cursor-n-resize shadow-md hover:scale-125 transition-transform z-30"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "s")}
                      className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#1DB954] border-2 border-white cursor-s-resize shadow-md hover:scale-125 transition-transform z-30"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "w")}
                      className="absolute top-1/2 -translate-y-1/2 -left-2.5 w-5 h-5 rounded-full bg-[#1DB954] border-2 border-white cursor-w-resize shadow-md hover:scale-125 transition-transform z-30"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, "e")}
                      className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-5 h-5 rounded-full bg-[#1DB954] border-2 border-white cursor-e-resize shadow-md hover:scale-125 transition-transform z-30"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
