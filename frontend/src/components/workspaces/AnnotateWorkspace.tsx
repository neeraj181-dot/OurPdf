import React, { useState, useRef, useEffect } from "react";
import {
  PenTool,
  Highlighter,
  Square,
  Type,
  FileSignature,
  ShieldAlert,
  Hash,
  Download,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Lock,
} from "lucide-react";
import { PDFFileItem, PageNumberOptions } from "../../types";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { downloadPdfBytes, fileToArrayBuffer, addPageNumbers } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";

interface AnnotateWorkspaceProps {
  mode: "annotate" | "drawing" | "sign" | "redact" | "page-numbers" | "lock";
  activeFile: PDFFileItem;
  onPageNumbersRun: (options: PageNumberOptions) => void;
  onLockRun: (password: string) => void;
  onCompressRun?: (quality: number) => void;
  isProcessing: boolean;
}

interface AnnotationItem {
  id: string;
  pageIndex: number;
  type: "pen" | "highlight" | "rect" | "redact" | "text" | "sign";
  color: string;
  size: number;
  points?: { x: number; y: number }[];
  rect?: { x: number; y: number; width: number; height: number };
  text?: string;
  textPos?: { x: number; y: number };
}

export const AnnotateWorkspace: React.FC<AnnotateWorkspaceProps> = ({
  mode,
  activeFile,
  onPageNumbersRun,
  onLockRun,
  isProcessing: isProcessingGlobal,
}) => {
  // Current Page & Navigation
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(activeFile.pagesCount || 1);

  // Active Tool Selection in Canvas
  const [activeTool, setActiveTool] = useState<"pen" | "highlight" | "rect" | "redact" | "text" | "sign">(
    mode === "drawing" ? "pen" : mode === "sign" ? "sign" : mode === "redact" ? "redact" : "pen"
  );

  // Styling options
  const [toolColor, setToolColor] = useState<string>(mode === "redact" ? "#000000" : "#ef4444");
  const [toolSize, setToolSize] = useState<number>(4);
  const [textValue, setTextValue] = useState<string>("Approved");

  // Page Numbers State
  const [numFormat, setNumFormat] = useState<"Page {n}" | "{n} of {total}" | "- {n} -">("Page {n}");
  const [numPos, setNumPos] = useState<"bottom-center" | "bottom-right" | "top-right" | "bottom-left">("bottom-center");
  const [numFontSize, setNumFontSize] = useState(11);

  // Password Lock State
  const [password, setPassword] = useState("");

  // Canvas Drawing & State
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Canvas Refs
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load PDF Page onto bgCanvas
  useEffect(() => {
    let isCancelled = false;

    const renderPdfPage = async () => {
      if (!activeFile) return;
      try {
        const buffer = await fileToArrayBuffer(activeFile.file);
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        setTotalPages(pdfDoc.numPages);
        const page = await pdfDoc.getPage(currentPageIndex + 1);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const bgCanvas = bgCanvasRef.current;
        const drawCanvas = drawCanvasRef.current;

        if (bgCanvas && drawCanvas) {
          bgCanvas.width = viewport.width;
          bgCanvas.height = viewport.height;
          drawCanvas.width = viewport.width;
          drawCanvas.height = viewport.height;

          const ctx = bgCanvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport } as any).promise;
          }
          redrawAnnotations();
        }
      } catch (err) {
        console.warn("Could not render page canvas:", err);
      }
    };

    renderPdfPage();

    return () => {
      isCancelled = true;
    };
  }, [activeFile, currentPageIndex]);

  // Redraw annotations for current page
  const redrawAnnotations = () => {
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;
    const ctx = drawCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    const pageAnns = annotations.filter((a) => a.pageIndex === currentPageIndex);

    for (const ann of pageAnns) {
      if (ann.type === "pen" || ann.type === "highlight") {
        if (!ann.points || ann.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (ann.type === "highlight") {
          ctx.globalAlpha = 0.4;
        }
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (ann.type === "rect" || ann.type === "redact") {
        if (!ann.rect) continue;
        ctx.save();
        if (ann.type === "redact") {
          ctx.fillStyle = "#000000";
          ctx.fillRect(ann.rect.x, ann.rect.y, ann.rect.width, ann.rect.height);
        } else {
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = ann.size;
          ctx.strokeRect(ann.rect.x, ann.rect.y, ann.rect.width, ann.rect.height);
        }
        ctx.restore();
      } else if (ann.type === "text" && ann.text && ann.textPos) {
        ctx.save();
        ctx.fillStyle = ann.color;
        ctx.font = `bold ${ann.size * 3}px sans-serif`;
        ctx.fillText(ann.text, ann.textPos.x, ann.textPos.y);
        ctx.restore();
      } else if (ann.type === "sign" && ann.points && ann.points.length > 1) {
        ctx.save();
        ctx.strokeStyle = "#1e3a8a"; // Dark blue ink
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  useEffect(() => {
    redrawAnnotations();
  }, [annotations, currentPageIndex]);

  // Canvas Mouse Coordinates Helper
  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoords(e);
    setIsDrawing(true);

    if (activeTool === "pen" || activeTool === "highlight" || activeTool === "sign") {
      setCurrentPoints([coords]);
    } else if (activeTool === "rect" || activeTool === "redact") {
      setDragStart(coords);
    } else if (activeTool === "text") {
      const newAnn: AnnotationItem = {
        id: `ann-${Date.now()}`,
        pageIndex: currentPageIndex,
        type: "text",
        color: toolColor,
        size: toolSize,
        text: textValue,
        textPos: coords,
      };
      setAnnotations((prev) => [...prev, newAnn]);
      soundEffects.playClick();
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCoords(e);

    if (activeTool === "pen" || activeTool === "highlight" || activeTool === "sign") {
      setCurrentPoints((prev) => [...prev, coords]);

      // Realtime preview stroke
      const drawCanvas = drawCanvasRef.current;
      if (!drawCanvas) return;
      const ctx = drawCanvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = activeTool === "sign" ? "#1e3a8a" : toolColor;
      ctx.lineWidth = activeTool === "sign" ? 3 : toolSize;
      ctx.lineCap = "round";
      if (activeTool === "highlight") ctx.globalAlpha = 0.4;
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const coords = getCoords(e);

    if ((activeTool === "pen" || activeTool === "highlight" || activeTool === "sign") && currentPoints.length > 0) {
      const newAnn: AnnotationItem = {
        id: `ann-${Date.now()}`,
        pageIndex: currentPageIndex,
        type: activeTool,
        color: activeTool === "sign" ? "#1e3a8a" : toolColor,
        size: activeTool === "sign" ? 3 : toolSize,
        points: [...currentPoints, coords],
      };
      setAnnotations((prev) => [...prev, newAnn]);
      setCurrentPoints([]);
    } else if ((activeTool === "rect" || activeTool === "redact") && dragStart) {
      const left = Math.min(dragStart.x, coords.x);
      const top = Math.min(dragStart.y, coords.y);
      const width = Math.abs(coords.x - dragStart.x);
      const height = Math.abs(coords.y - dragStart.y);

      if (width > 4 && height > 4) {
        const newAnn: AnnotationItem = {
          id: `ann-${Date.now()}`,
          pageIndex: currentPageIndex,
          type: activeTool,
          color: activeTool === "redact" ? "#000000" : toolColor,
          size: toolSize,
          rect: { x: left, y: top, width, height },
        };
        setAnnotations((prev) => [...prev, newAnn]);
      }
      setDragStart(null);
    }
    soundEffects.playClick();
  };

  const handleUndoLast = () => {
    soundEffects.playClick();
    setAnnotations((prev) => {
      const copy = [...prev];
      const lastIndex = copy.map((a) => a.pageIndex).lastIndexOf(currentPageIndex);
      if (lastIndex >= 0) {
        copy.splice(lastIndex, 1);
      }
      return copy;
    });
  };

  const handleClearPage = () => {
    soundEffects.playClick();
    setAnnotations((prev) => prev.filter((a) => a.pageIndex !== currentPageIndex));
  };

  // Export PDF with burned annotations
  const handleExportAnnotatedPdf = async () => {
    soundEffects.playClick();
    setIsExporting(true);

    try {
      const buffer = await fileToArrayBuffer(activeFile.file);
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();

      // Render each page with its annotations onto a canvas and embed into the PDF
      for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        const pageAnns = annotations.filter((a) => a.pageIndex === pIdx);
        if (pageAnns.length === 0) continue;

        const page = pages[pIdx];
        const { width, height } = page.getSize();

        // Render page + annotations onto a high-res offscreen canvas
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const srcDoc = await loadingTask.promise;
        const pdfPage = await srcDoc.getPage(pIdx + 1);

        const viewport = pdfPage.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          await pdfPage.render({ canvasContext: ctx, viewport } as any).promise;

          // Scale annotations to 2.0 scale (from 1.5 scale)
          const scaleFactor = 2.0 / 1.5;

          for (const ann of pageAnns) {
            if (ann.type === "pen" || ann.type === "highlight") {
              if (!ann.points || ann.points.length < 2) continue;
              ctx.save();
              ctx.strokeStyle = ann.color;
              ctx.lineWidth = ann.size * scaleFactor;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              if (ann.type === "highlight") ctx.globalAlpha = 0.4;
              ctx.beginPath();
              ctx.moveTo(ann.points[0].x * scaleFactor, ann.points[0].y * scaleFactor);
              for (let i = 1; i < ann.points.length; i++) {
                ctx.lineTo(ann.points[i].x * scaleFactor, ann.points[i].y * scaleFactor);
              }
              ctx.stroke();
              ctx.restore();
            } else if (ann.type === "rect" || ann.type === "redact") {
              if (!ann.rect) continue;
              ctx.save();
              if (ann.type === "redact") {
                ctx.fillStyle = "#000000";
                ctx.fillRect(
                  ann.rect.x * scaleFactor,
                  ann.rect.y * scaleFactor,
                  ann.rect.width * scaleFactor,
                  ann.rect.height * scaleFactor
                );
              } else {
                ctx.strokeStyle = ann.color;
                ctx.lineWidth = ann.size * scaleFactor;
                ctx.strokeRect(
                  ann.rect.x * scaleFactor,
                  ann.rect.y * scaleFactor,
                  ann.rect.width * scaleFactor,
                  ann.rect.height * scaleFactor
                );
              }
              ctx.restore();
            } else if (ann.type === "text" && ann.text && ann.textPos) {
              ctx.save();
              ctx.fillStyle = ann.color;
              ctx.font = `bold ${ann.size * 3 * scaleFactor}px sans-serif`;
              ctx.fillText(ann.text, ann.textPos.x * scaleFactor, ann.textPos.y * scaleFactor);
              ctx.restore();
            } else if (ann.type === "sign" && ann.points && ann.points.length > 1) {
              ctx.save();
              ctx.strokeStyle = "#1e3a8a";
              ctx.lineWidth = 3 * scaleFactor;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(ann.points[0].x * scaleFactor, ann.points[0].y * scaleFactor);
              for (let i = 1; i < ann.points.length; i++) {
                ctx.lineTo(ann.points[i].x * scaleFactor, ann.points[i].y * scaleFactor);
              }
              ctx.stroke();
              ctx.restore();
            }
          }

          const imgDataUrl = canvas.toDataURL("image/jpeg", 0.92);
          const base64 = imgDataUrl.split(",")[1];
          const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const embeddedImg = await pdfDoc.embedJpg(imgBytes);

          page.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width,
            height,
          });
        }
      }

      const outputBytes = await pdfDoc.save();
      soundEffects.playSuccess();
      downloadPdfBytes(outputBytes, `annotated_${activeFile.name}`);
    } catch (err: any) {
      console.error(err);
      alert(`Export failed: ${err.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 font-sans text-white">
      {/* HEADER BAR */}
      <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            {mode === "page-numbers" ? (
              <Hash className="w-4 h-4" />
            ) : mode === "sign" ? (
              <FileSignature className="w-4 h-4" />
            ) : mode === "redact" ? (
              <ShieldAlert className="w-4 h-4" />
            ) : (
              <PenTool className="w-4 h-4" />
            )}
            <span>
              {mode === "page-numbers"
                ? "PAGE NUMBERING"
                : mode === "sign"
                ? "SIGN PDF"
                : mode === "redact"
                ? "REDACT SENSITIVE DATA"
                : "PDF ANNOTATION & DRAWING"}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-0.5">
            {mode === "page-numbers"
              ? "Stamp Page Numbers on PDF"
              : mode === "sign"
              ? "Add Electronic Signature to PDF"
              : mode === "redact"
              ? "Permanently Redact PDF Content"
              : "Draw, Highlight & Annotate PDF"}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Active PDF: <span className="text-white font-semibold">{activeFile.name}</span>
          </p>
        </div>

        {mode !== "page-numbers" && mode !== "lock" && (
          <button
            onClick={handleExportAnnotatedPdf}
            disabled={isExporting}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-3 rounded-full transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>{isExporting ? "EXPORTING ANNOTATIONS..." : "EXPORT & DOWNLOAD PDF"}</span>
          </button>
        )}
      </div>

      {/* PAGE NUMBERS MODE ONLY */}
      {mode === "page-numbers" && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-5 shadow-xl max-w-xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300">Format</label>
              <select
                value={numFormat}
                onChange={(e) => setNumFormat(e.target.value as any)}
                className="bg-zinc-900 text-white text-xs font-bold p-3 rounded-lg border border-zinc-700"
              >
                <option value="Page {n}">Page 1, Page 2...</option>
                <option value="{n} of {total}">1 of 12, 2 of 12...</option>
                <option value="- {n} -">- 1 -, - 2 -...</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300">Position</label>
              <select
                value={numPos}
                onChange={(e) => setNumPos(e.target.value as any)}
                className="bg-zinc-900 text-white text-xs font-bold p-3 rounded-lg border border-zinc-700"
              >
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-bold text-zinc-300">
              <span>Font Size</span>
              <span className="text-[#1DB954] font-mono">{numFontSize}pt</span>
            </div>
            <input
              type="range"
              min="8"
              max="24"
              value={numFontSize}
              onChange={(e) => setNumFontSize(Number(e.target.value))}
              className="accent-[#1DB954] cursor-pointer"
            />
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              onPageNumbersRun({
                format: numFormat,
                position: numPos,
                fontSize: numFontSize,
                color: "#333333",
              });
            }}
            disabled={isProcessingGlobal}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3 rounded-full transition-all shadow-lg cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-black stroke-[3]" />
            <span>STAMP PAGE NUMBERS</span>
          </button>
        </div>
      )}

      {/* VISUAL ANNOTATION CANVAS STAGE */}
      {mode !== "page-numbers" && mode !== "lock" && (
        <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
          {/* TOOLBAR CONTROLS */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
            {/* Tool Selection Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setActiveTool("pen");
                  setToolSize(4);
                }}
                className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === "pen"
                    ? "bg-[#1DB954] text-black"
                    : "bg-zinc-800 text-zinc-300 hover:text-white"
                }`}
                title="Pen drawing"
              >
                <PenTool className="w-4 h-4" />
                <span>Pen</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool("highlight");
                  setToolSize(18);
                }}
                className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === "highlight"
                    ? "bg-[#1DB954] text-black"
                    : "bg-zinc-800 text-zinc-300 hover:text-white"
                }`}
                title="Highlighter"
              >
                <Highlighter className="w-4 h-4" />
                <span>Highlight</span>
              </button>

              <button
                onClick={() => setActiveTool("rect")}
                className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === "rect"
                    ? "bg-[#1DB954] text-black"
                    : "bg-zinc-800 text-zinc-300 hover:text-white"
                }`}
                title="Rectangle shape"
              >
                <Square className="w-4 h-4" />
                <span>Shape</span>
              </button>

              <button
                onClick={() => setActiveTool("sign")}
                className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === "sign"
                    ? "bg-[#1DB954] text-black"
                    : "bg-zinc-800 text-zinc-300 hover:text-white"
                }`}
                title="Draw signature"
              >
                <FileSignature className="w-4 h-4" />
                <span>Signature</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool("redact");
                  setToolColor("#000000");
                }}
                className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === "redact"
                    ? "bg-rose-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:text-rose-400"
                }`}
                title="Blackout Redaction"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Redact</span>
              </button>

              <button
                onClick={() => setActiveTool("text")}
                className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === "text"
                    ? "bg-[#1DB954] text-black"
                    : "bg-zinc-800 text-zinc-300 hover:text-white"
                }`}
                title="Stamp Text"
              >
                <Type className="w-4 h-4" />
                <span>Text Note</span>
              </button>
            </div>

            {/* Tool settings (Color & Size) */}
            <div className="flex items-center gap-3">
              {activeTool === "text" && (
                <input
                  type="text"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="Text to stamp..."
                  className="bg-zinc-950 text-white text-xs px-3 py-1.5 rounded-lg border border-zinc-700 w-32"
                />
              )}

              {activeTool !== "redact" && activeTool !== "sign" && (
                <div className="flex items-center gap-1">
                  {["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#000000"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setToolColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                        toolColor === c ? "border-white scale-110" : "border-transparent"
                      }`}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 border-l border-zinc-700 pl-3">
                <button
                  onClick={handleUndoLast}
                  className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-medium flex items-center gap-1 cursor-pointer"
                  title="Undo last mark on this page"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>

                <button
                  onClick={handleClearPage}
                  className="p-1.5 rounded bg-zinc-800 hover:bg-rose-950 text-xs font-medium text-rose-400 flex items-center gap-1 cursor-pointer"
                  title="Clear all marks on this page"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>

          {/* PAGE NAVIGATION BAR */}
          <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
            <button
              onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentPageIndex === 0}
              className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-800 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Page</span>
            </button>

            <span>
              Page {currentPageIndex + 1} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPageIndex >= totalPages - 1}
              className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-800 disabled:opacity-30 cursor-pointer"
            >
              <span>Next Page</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* CANVAS STACK */}
          <div className="relative w-full aspect-[3/4] max-h-[600px] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center p-2 select-none">
            <div className="relative max-w-full max-h-full inline-block cursor-crosshair">
              {/* Background PDF Page Canvas */}
              <canvas ref={bgCanvasRef} className="block max-w-full max-h-[580px] object-contain rounded shadow-2xl" />

              {/* Foreground Drawing / Annotation Canvas */}
              <canvas
                ref={drawCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="absolute inset-0 max-w-full max-h-[580px] object-contain pointer-events-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
