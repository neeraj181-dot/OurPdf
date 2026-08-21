import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FileSignature,
  Plus,
  Trash2,
  Copy,
  Undo2,
  Redo2,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  Sparkles,
  Move,
  X,
  Layers,
  ZoomIn,
  ZoomOut,
  FolderOpen,
  Eye,
  Check,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { apiSignPdf, apiRecordDownload, UserProfile } from "../../lib/api";
import { downloadPdfBytes, fileToArrayBuffer } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface SignWorkspaceProps {
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onDownloadRecorded?: () => void;
}

export interface PlacedSignature {
  id: string;
  pageIndex: number; // 0-indexed
  dataUrl: string;
  x: number; // PDF points (relative to original page dimensions)
  y: number; // PDF points
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  size: number;
}

interface PageMeta {
  pageIndex: number;
  width: number;
  height: number;
  thumbnailUrl?: string;
}

interface DraggingState {
  sigId: string;
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  offsetX: number; // mouse offset from signature top-left (px)
  offsetY: number;
  width: number; // signature width in px
  height: number; // signature height in px
  dataUrl: string;
}

// -------------------------------------------------------------
// Subcomponent: Individual Vertically Rendered PDF Page Card
// -------------------------------------------------------------
const PdfPageCard: React.FC<{
  pageIndex: number;
  totalPages: number;
  pdfDoc: any;
  zoomScale: number;
  signatures: PlacedSignature[];
  selectedSigId: string | null;
  draggingSigId: string | null;
  hoveredDropPage: number | null;
  onSelectSig: (id: string) => void;
  onUpdateSig: (sig: PlacedSignature) => void;
  onDeleteSig: (id: string) => void;
  onDuplicateSig: (id: string) => void;
  onStartDragSig: (sig: PlacedSignature, e: React.PointerEvent) => void;
}> = ({
  pageIndex,
  totalPages,
  pdfDoc,
  zoomScale,
  signatures,
  selectedSigId,
  draggingSigId,
  hoveredDropPage,
  onSelectSig,
  onUpdateSig,
  onDeleteSig,
  onDuplicateSig,
  onStartDragSig,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageDim, setPageDim] = useState<{ origW: number; origH: number; scale: number }>({
    origW: 595.28,
    origH: 841.89,
    scale: 1.0,
  });

  useEffect(() => {
    let isCancelled = false;
    const renderPageCanvas = async () => {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        if (isCancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const origW = unscaledViewport.width || 595.28;
        const origH = unscaledViewport.height || 841.89;

        // Base container width responsive to viewport
        const baseWidth = Math.min(window.innerWidth - 140, 620);
        const scale = (baseWidth / origW) * zoomScale;
        const viewport = page.getViewport({ scale });

        setPageDim({ origW, origH, scale });

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport } as any).promise;
          }
        }
      } catch (err) {
        console.warn(`Error rendering page ${pageIndex + 1}:`, err);
      }
    };

    renderPageCanvas();
    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageIndex, zoomScale]);

  const pageSignatures = signatures.filter((s) => s.pageIndex === pageIndex);
  const isDropTarget = hoveredDropPage === pageIndex;

  return (
    <div
      id={`pdf-page-${pageIndex}`}
      ref={containerRef}
      data-page-index={pageIndex}
      className="flex flex-col items-center gap-2 relative transition-all"
    >
      {/* Page Canvas Container with Attached Signatures */}
      <div
        id={`pdf-page-canvas-${pageIndex}`}
        style={{
          width: `${pageDim.origW * pageDim.scale}px`,
          height: `${pageDim.origH * pageDim.scale}px`,
        }}
        className={`relative bg-white shadow-2xl rounded border select-none transition-colors ${
          isDropTarget
            ? "border-[#1DB954] ring-4 ring-[#1DB954]/30"
            : "border-zinc-700/60"
        }`}
      >
        <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />

        {/* Overlaid Signatures for this specific page */}
        {pageSignatures.map((sig) => {
          const scaledX = sig.x * pageDim.scale;
          const scaledY = sig.y * pageDim.scale;
          const scaledW = sig.width * pageDim.scale;
          const scaledH = sig.height * pageDim.scale;
          const isSelected = selectedSigId === sig.id;
          const isBeingDragged = draggingSigId === sig.id;

          return (
            <div
              key={sig.id}
              style={{
                left: `${scaledX}px`,
                top: `${scaledY}px`,
                width: `${scaledW}px`,
                height: `${scaledH}px`,
                opacity: isBeingDragged ? 0.3 : 1,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSig(sig.id);
              }}
              className={`absolute cursor-move group select-none transition-shadow ${
                isSelected
                  ? "border-2 border-[#1DB954] bg-[#1DB954]/10 rounded shadow-lg ring-2 ring-[#1DB954]/40 z-20"
                  : "border border-dashed border-zinc-400 hover:border-[#1DB954] hover:bg-[#1DB954]/5 rounded z-10"
              }`}
              onPointerDown={(e) => {
                e.stopPropagation();
                onStartDragSig(sig, e);
              }}
            >
              <img
                src={sig.dataUrl}
                alt="Signature"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />

              {/* Floating Action Controls (Duplicate & Delete) */}
              <div className="absolute -top-3.5 -right-3.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateSig(sig.id);
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-[#1DB954] hover:text-white rounded-full p-1 shadow-md border border-zinc-700 cursor-pointer"
                  title="Duplicate Signature (Ctrl+D)"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEffects.playClick();
                    onDeleteSig(sig.id);
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1 shadow-md cursor-pointer"
                  title="Delete Signature"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Corner Resize Handle */}
              {isSelected && (
                <div
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#1DB954] border-2 border-black rounded-full cursor-nwse-resize shadow flex items-center justify-center z-30"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const startClientX = e.clientX;
                    const origWidth = sig.width;
                    const origHeight = sig.height;
                    const aspectRatio = origWidth / origHeight || 2.5;

                    const onResizeMove = (moveEv: PointerEvent) => {
                      const dx = (moveEv.clientX - startClientX) / pageDim.scale;
                      const newW = Math.max(50, Math.min(pageDim.origW - sig.x, origWidth + dx));
                      const newH = newW / aspectRatio;
                      onUpdateSig({
                        ...sig,
                        width: newW,
                        height: newH,
                      });
                    };

                    const onResizeUp = () => {
                      window.removeEventListener("pointermove", onResizeMove);
                      window.removeEventListener("pointerup", onResizeUp);
                    };

                    window.addEventListener("pointermove", onResizeMove);
                    window.addEventListener("pointerup", onResizeUp);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Page Separator & Bottom Label */}
      <div className="flex items-center gap-2 my-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
        <span className="w-8 h-[1px] bg-zinc-800" />
        <span>
          Page {pageIndex + 1} of {totalPages}
        </span>
        <span className="w-8 h-[1px] bg-zinc-800" />
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Main SignWorkspace Component
// -------------------------------------------------------------
export const SignWorkspace: React.FC<SignWorkspaceProps> = ({
  activeFile,
  user,
  onOpenFilePicker,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  // Modal & Drawing state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [penColor, setPenColor] = useState<string>("#000000");
  const [penSize, setPenSize] = useState<number>(2.5);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoHistory, setRedoHistory] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Full PDF Document State
  const [pdfJsDoc, setPdfJsDoc] = useState<any>(null);
  const [pagesMeta, setPagesMeta] = useState<PageMeta[]>([]);
  const [visiblePageIndex, setVisiblePageIndex] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Signatures on any page
  const [placedSignatures, setPlacedSignatures] = useState<PlacedSignature[]>([]);
  const [selectedSigId, setSelectedSigId] = useState<string | null>(null);

  // Cross-Page Drag & Drop State
  const [draggingState, setDraggingState] = useState<DraggingState | null>(null);
  const [hoveredDropPage, setHoveredDropPage] = useState<number | null>(null);

  // Processing & Output
  const [isSigning, setIsSigning] = useState(false);
  const [signedPdfBytes, setSignedPdfBytes] = useState<Uint8Array | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavedToCloudState, setIsSavedToCloudState] = useState(false);

  // DOM Refs
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  const autoScrollTimerRef = useRef<number | null>(null);

  // 1. Load Entire PDF with pdfjs-dist and generate thumbnails for all pages
  useEffect(() => {
    let isCancelled = false;
    const loadFullPdf = async () => {
      if (!activeFile) return;
      try {
        const buffer = await fileToArrayBuffer(activeFile.file);
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const loadedDoc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfJsDoc(loadedDoc);
        const numPages = loadedDoc.numPages;
        setTotalPages(numPages);

        const metas: PageMeta[] = [];
        for (let i = 1; i <= numPages; i++) {
          const page = await loadedDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.25 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          let thumbUrl = undefined;
          if (ctx) {
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport } as any).promise;
            thumbUrl = canvas.toDataURL("image/jpeg", 0.7);
          }

          metas.push({
            pageIndex: i - 1,
            width: page.view[2] || 595.28,
            height: page.view[3] || 841.89,
            thumbnailUrl: thumbUrl,
          });
        }

        if (!isCancelled) {
          setPagesMeta(metas);
          setVisiblePageIndex(0);
        }
      } catch (err) {
        console.error("Failed to load full PDF in SignWorkspace:", err);
      }
    };

    loadFullPdf();
    return () => {
      isCancelled = true;
    };
  }, [activeFile]);

  // 2. Track Current Visible Page on Scroll via IntersectionObserver
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || pagesMeta.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pIndex = parseInt(entry.target.getAttribute("data-page-index") || "0", 10);
            setVisiblePageIndex(pIndex);
          }
        }
      },
      {
        root: container,
        threshold: 0.4,
      }
    );

    pagesMeta.forEach((p) => {
      const el = document.getElementById(`pdf-page-${p.pageIndex}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pagesMeta, zoomScale]);

  // Smooth Scroll to Specific Page
  const scrollToPage = (pageIdx: number) => {
    soundEffects.playClick();
    const clamped = Math.max(0, Math.min(totalPages - 1, pageIdx));
    setVisiblePageIndex(clamped);
    const targetEl = document.getElementById(`pdf-page-${clamped}`);
    if (targetEl && scrollContainerRef.current) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // -------------------------------------------------------------
  // CROSS-PAGE DRAG & DROP ENGINE WITH AUTO-SCROLL
  // -------------------------------------------------------------
  const handleStartDragSig = (sig: PlacedSignature, e: React.PointerEvent) => {
    setSelectedSigId(sig.id);

    const sigEl = e.currentTarget as HTMLElement;
    const sigRect = sigEl.getBoundingClientRect();
    const offsetX = e.clientX - sigRect.left;
    const offsetY = e.clientY - sigRect.top;

    setDraggingState({
      sigId: sig.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      currentClientX: e.clientX,
      currentClientY: e.clientY,
      offsetX,
      offsetY,
      width: sigRect.width,
      height: sigRect.height,
      dataUrl: sig.dataUrl,
    });
  };

  useEffect(() => {
    if (!draggingState) return;

    const onPointerMove = (moveEv: PointerEvent) => {
      setDraggingState((prev) => (prev ? { ...prev, currentClientX: moveEv.clientX, currentClientY: moveEv.clientY } : null));

      // 1. Auto-scroll container when dragging near top/bottom edges
      const container = scrollContainerRef.current;
      if (container) {
        const cRect = container.getBoundingClientRect();
        const topEdgeThreshold = cRect.top + 75;
        const bottomEdgeThreshold = cRect.bottom - 75;

        if (autoScrollTimerRef.current) {
          window.clearInterval(autoScrollTimerRef.current);
          autoScrollTimerRef.current = null;
        }

        if (moveEv.clientY < topEdgeThreshold) {
          const speed = Math.max(5, Math.min(22, (topEdgeThreshold - moveEv.clientY) / 2));
          autoScrollTimerRef.current = window.setInterval(() => {
            container.scrollTop -= speed;
          }, 16);
        } else if (moveEv.clientY > bottomEdgeThreshold) {
          const speed = Math.max(5, Math.min(22, (moveEv.clientY - bottomEdgeThreshold) / 2));
          autoScrollTimerRef.current = window.setInterval(() => {
            container.scrollTop += speed;
          }, 16);
        }
      }

      // 2. Detect which page is underneath the center of the dragged signature
      const centerX = moveEv.clientX - draggingState.offsetX + draggingState.width / 2;
      const centerY = moveEv.clientY - draggingState.offsetY + draggingState.height / 2;

      const elementsUnder = document.elementsFromPoint(centerX, centerY);
      let detectedPage: number | null = null;

      for (const el of elementsUnder) {
        const pageCard = el.closest("[data-page-index]");
        if (pageCard) {
          detectedPage = parseInt(pageCard.getAttribute("data-page-index") || "0", 10);
          break;
        }
      }

      setHoveredDropPage(detectedPage);
    };

    const onPointerUp = (upEv: PointerEvent) => {
      if (autoScrollTimerRef.current) {
        window.clearInterval(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }

      const sigId = draggingState.sigId;
      const activeSig = placedSignatures.find((s) => s.id === sigId);

      if (activeSig) {
        // Center point of signature upon drop
        const centerX = upEv.clientX - draggingState.offsetX + draggingState.width / 2;
        const centerY = upEv.clientY - draggingState.offsetY + draggingState.height / 2;

        let targetPageIndex = activeSig.pageIndex;
        const elementsUnder = document.elementsFromPoint(centerX, centerY);

        for (const el of elementsUnder) {
          const pageCard = el.closest("[data-page-index]");
          if (pageCard) {
            targetPageIndex = parseInt(pageCard.getAttribute("data-page-index") || "0", 10);
            break;
          }
        }

        // If dropped outside, find closest page vertically
        if (targetPageIndex < 0 || targetPageIndex >= totalPages) {
          targetPageIndex = visiblePageIndex;
        }

        const targetPageCanvas = document.getElementById(`pdf-page-canvas-${targetPageIndex}`);
        const targetMeta = pagesMeta[targetPageIndex] || { width: 595.28, height: 841.89 };

        if (targetPageCanvas) {
          const canvasRect = targetPageCanvas.getBoundingClientRect();
          const scale = canvasRect.width / targetMeta.width;

          // Calculate new (x, y) coordinates relative to target PDF page
          const sigTopLeftClientX = upEv.clientX - draggingState.offsetX;
          const sigTopLeftClientY = upEv.clientY - draggingState.offsetY;

          const rawX = (sigTopLeftClientX - canvasRect.left) / scale;
          const rawY = (sigTopLeftClientY - canvasRect.top) / scale;

          const clampedX = Math.max(0, Math.min(targetMeta.width - activeSig.width, rawX));
          const clampedY = Math.max(0, Math.min(targetMeta.height - activeSig.height, rawY));

          setPlacedSignatures((prev) =>
            prev.map((s) =>
              s.id === sigId
                ? {
                    ...s,
                    pageIndex: targetPageIndex,
                    x: clampedX,
                    y: clampedY,
                  }
                : s
            )
          );

          soundEffects.playClick();
        }
      }

      setDraggingState(null);
      setHoveredDropPage(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (autoScrollTimerRef.current) {
        window.clearInterval(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
    };
  }, [draggingState, placedSignatures, totalPages, pagesMeta, visiblePageIndex]);

  // Duplicate Signature Action Handler
  const handleDuplicateSig = useCallback(
    (sigId: string) => {
      const orig = placedSignatures.find((s) => s.id === sigId);
      if (!orig) return;
      soundEffects.playClick();

      const targetPageMeta = pagesMeta[orig.pageIndex] || { width: 595.28, height: 841.89 };
      const duplicate: PlacedSignature = {
        ...orig,
        id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        x: Math.min(targetPageMeta.width - orig.width, orig.x + 20),
        y: Math.min(targetPageMeta.height - orig.height, orig.y + 20),
      };

      setPlacedSignatures((prev) => [...prev, duplicate]);
      setSelectedSigId(duplicate.id);
    },
    [placedSignatures, pagesMeta]
  );

  // Keyboard shortcut Ctrl+D / Cmd+D for duplicating selected signature
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedSigId) {
        e.preventDefault();
        handleDuplicateSig(selectedSigId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSigId, handleDuplicateSig]);

  // 3. Signature Canvas Drawing Logic
  const redrawSignCanvas = useCallback(() => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allStrokes = [...strokes];
    if (isDrawing && currentStrokeRef.current.length > 0) {
      allStrokes.push({
        points: currentStrokeRef.current,
        color: penColor,
        size: penSize,
      });
    }

    const dpr = window.devicePixelRatio || 1;

    for (const stroke of allStrokes) {
      const pts = stroke.points;
      if (pts.length === 0) continue;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (pts.length === 1) {
        ctx.arc(pts[0].x * dpr, pts[0].y * dpr, (stroke.size * dpr) / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      } else {
        ctx.moveTo(pts[0].x * dpr, pts[0].y * dpr);
        for (let i = 1; i < pts.length; i++) {
          const midX = (pts[i - 1].x + pts[i].x) / 2;
          const midY = (pts[i - 1].y + pts[i].y) / 2;
          ctx.quadraticCurveTo(pts[i - 1].x * dpr, pts[i - 1].y * dpr, midX * dpr, midY * dpr);
        }
        ctx.lineTo(pts[pts.length - 1].x * dpr, pts[pts.length - 1].y * dpr);
        ctx.stroke();
      }
    }
  }, [strokes, isDrawing, penColor, penSize]);

  useEffect(() => {
    if (!isModalOpen) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || 560;
    const cssHeight = rect.height || 240;

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    redrawSignCanvas();
  }, [isModalOpen, redrawSignCanvas]);

  useEffect(() => {
    redrawSignCanvas();
  }, [redrawSignCanvas]);

  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = signCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const pt = getCanvasCoordinates(e);
    currentStrokeRef.current = [pt];
    redrawSignCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pt = getCanvasCoordinates(e);
    currentStrokeRef.current.push(pt);
    redrawSignCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (currentStrokeRef.current.length > 0) {
      const finishedStroke: Stroke = {
        points: [...currentStrokeRef.current],
        color: penColor,
        size: penSize,
      };
      setStrokes((prev) => [...prev, finishedStroke]);
      setRedoHistory([]);
    }

    currentStrokeRef.current = [];
    setIsDrawing(false);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    soundEffects.playClick();
    const lastStroke = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setRedoHistory((prev) => [...prev, lastStroke]);
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    soundEffects.playClick();
    const strokeToRestore = redoHistory[redoHistory.length - 1];
    setRedoHistory((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, strokeToRestore]);
  };

  const handleClearSignature = () => {
    soundEffects.playClick();
    setStrokes([]);
    setRedoHistory([]);
    currentStrokeRef.current = [];
  };

  // 4. Use Signature: Auto-crops transparent bounds and places on the CURRENT VISIBLE PAGE
  const handleUseSignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas || strokes.length === 0) return;
    soundEffects.playSuccess();

    const ctx = canvas.getContext("2d");
    let croppedDataUrl = canvas.toDataURL("image/png");

    if (ctx) {
      const w = canvas.width;
      const h = canvas.height;
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      let minX = w,
        minY = h,
        maxX = 0,
        maxY = 0;
      let hasInk = false;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const alpha = data[(y * w + x) * 4 + 3];
          if (alpha > 15) {
            hasInk = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (hasInk) {
        const padding = 16;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropW = Math.min(w - cropX, maxX - minX + padding * 2);
        const cropH = Math.min(h - cropY, maxY - minY + padding * 2);

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext("2d");
        if (cropCtx) {
          cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          croppedDataUrl = cropCanvas.toDataURL("image/png");
        }
      }
    }

    // Determine target page dimensions
    const targetPageMeta = pagesMeta[visiblePageIndex] || { width: 595.28, height: 841.89 };
    const newPlaced: PlacedSignature = {
      id: `sig-${Date.now()}`,
      pageIndex: visiblePageIndex, // Attached to current visible page!
      dataUrl: croppedDataUrl,
      x: targetPageMeta.width * 0.35,
      y: targetPageMeta.height * 0.72,
      width: 150,
      height: 60,
    };

    setPlacedSignatures((prev) => [...prev, newPlaced]);
    setSelectedSigId(newPlaced.id);
    setIsModalOpen(false);
  };

  // 5. Apply Signatures to ENTIRE Multi-Page PDF via Backend
  const handleApplySignatures = async () => {
    if (!activeFile) return;
    if (placedSignatures.length === 0) {
      setErrorMsg("Please place at least one signature on the document before saving.");
      return;
    }

    soundEffects.playClick();
    setIsSigning(true);
    setErrorMsg(null);
    setSignedPdfBytes(null);

    try {
      // Map signatures with exact page_index
      const sigPayload = placedSignatures.map((s) => ({
        page_index: s.pageIndex,
        image_data_url: s.dataUrl,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
      }));

      const outputBytes = await apiSignPdf(activeFile.file, sigPayload);

      // 1. Verify that output bytes exist and are not empty
      if (!outputBytes || outputBytes.byteLength === 0) {
        throw new Error("Backend generated an empty PDF file. Please try again.");
      }

      // 2. Validate standard %PDF- header
      const headerStr = String.fromCharCode(...outputBytes.slice(0, 5));
      if (!headerStr.startsWith("%PDF")) {
        throw new Error("Generated file is not a valid standard PDF document.");
      }

      // 3. Clone buffer copy for pdfjsLib validation so the main ArrayBuffer is not detached by worker transfer
      const bytesForCheck = new Uint8Array(outputBytes.buffer.slice(0));
      const checkDoc = await pdfjsLib.getDocument({ data: bytesForCheck }).promise;
      if (checkDoc.numPages !== totalPages) {
        throw new Error(
          `Page count mismatch: Original had ${totalPages} pages, but exported PDF has ${checkDoc.numPages} pages.`
        );
      }

      // 4. Save independent fresh copy of valid signed bytes in state
      const freshSignedBytes = new Uint8Array(outputBytes.buffer.slice(0));
      setSignedPdfBytes(freshSignedBytes);
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Sign error:", err);
      setErrorMsg(err?.message || "Failed to embed signatures into PDF.");
      setSignedPdfBytes(null);
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadSigned = () => {
    if (!signedPdfBytes || signedPdfBytes.byteLength === 0 || !activeFile) {
      setErrorMsg("No signed PDF data available to download. Please click Embed & Save first.");
      return;
    }
    soundEffects.playClick();
    const outName = `${activeFile.name.replace(/\.[^/.]+$/, "")}_signed.pdf`;
    downloadPdfBytes(signedPdfBytes, outName);

    if (user) {
      apiRecordDownload(outName, "pdf", signedPdfBytes.byteLength, "Sign PDF")
        .then(() => onDownloadRecorded?.())
        .catch((e) => console.warn(e));
    } else {
      recordDownloadedDoc(outName, signedPdfBytes.byteLength, "Sign PDF");
      onDownloadRecorded?.();
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto p-2 font-sans text-white select-none">
      {/* 1. Header Bar */}
      <div className="bg-[#121215] px-5 py-3.5 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1DB954] text-black flex items-center justify-center font-bold shrink-0 shadow-lg shadow-emerald-950/40">
            <FileSignature className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white">Sign PDF Document</h1>
              <span className="bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40 px-2 py-0.5 rounded text-[10px] font-bold">
                MULTI-PAGE
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {activeFile ? (
                <>
                  Document: <span className="text-zinc-200 font-semibold">{activeFile.name}</span> ({totalPages}{" "}
                  {totalPages === 1 ? "page" : "pages"})
                </>
              ) : (
                "Upload a PDF to sign with your natural handwriting"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!activeFile ? (
            <button
              onClick={onOpenFilePicker}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-all cursor-pointer shadow-md"
            >
              <FolderOpen className="w-4 h-4 stroke-[2.5]" />
              <span>SELECT PDF FILE</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  soundEffects.playClick();
                  handleClearSignature();
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-4 py-2.5 rounded-full transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>ADD SIGNATURE</span>
              </button>

              <button
                onClick={handleApplySignatures}
                disabled={isSigning || placedSignatures.length === 0}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs px-4 py-2.5 rounded-full border border-zinc-700 transition-all cursor-pointer disabled:opacity-40"
              >
                {isSigning ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-[#1DB954]" />
                    <span>EMBEDDING...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />
                    <span>EMBED & SAVE ({placedSignatures.length})</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Main Multi-Page Stage Layout */}
      {activeFile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Panel: Page Thumbnails & Placed Signatures (3.5 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Page Thumbnails List */}
            <div className="bg-[#181818] p-3.5 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl max-h-[380px]">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#1DB954]" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Document Pages ({totalPages})
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400">Click to jump</span>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                {pagesMeta.map((p) => {
                  const isActive = visiblePageIndex === p.pageIndex;
                  const sigCount = placedSignatures.filter((s) => s.pageIndex === p.pageIndex).length;

                  return (
                    <div
                      key={p.pageIndex}
                      onClick={() => scrollToPage(p.pageIndex)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                        isActive
                          ? "bg-zinc-800/90 border-[#1DB954] shadow-[0_0_12px_rgba(29,185,84,0.15)] ring-1 ring-[#1DB954]"
                          : "bg-zinc-900/90 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700"
                      }`}
                    >
                      <div className="w-10 h-14 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0 relative shadow">
                        {p.thumbnailUrl ? (
                          <img src={p.thumbnailUrl} alt={`Page ${p.pageIndex + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <FileSignature className="w-4 h-4 text-zinc-600" />
                        )}
                        <span className="absolute bottom-0.5 right-0.5 text-[8px] font-extrabold bg-black/80 text-zinc-300 px-1 rounded">
                          {p.pageIndex + 1}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-200">Page {p.pageIndex + 1}</span>
                          {isActive && <span className="w-2 h-2 rounded-full bg-[#1DB954] shadow-[0_0_6px_#1DB954]" />}
                        </div>
                        {sigCount > 0 ? (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-600/30 inline-block mt-1">
                            {sigCount} {sigCount === 1 ? "Signature" : "Signatures"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 mt-1 block">No signatures</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Placed Signatures List */}
            <div className="bg-[#181818] p-3.5 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4 text-[#1DB954]" />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Signatures Placed ({placedSignatures.length})
                  </span>
                </div>
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    handleClearSignature();
                    setIsModalOpen(true);
                  }}
                  className="text-[11px] font-bold text-[#1DB954] hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </div>

              {placedSignatures.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-4 text-center text-zinc-500 gap-2 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
                  <span className="text-xs font-semibold text-zinc-400">No signatures placed yet</span>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Click <strong>Add Signature</strong> to write your signature and place it on Page {visiblePageIndex + 1}.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar">
                  {placedSignatures.map((sig, idx) => {
                    const isSelected = selectedSigId === sig.id;

                    return (
                      <div
                        key={sig.id}
                        onClick={() => {
                          setSelectedSigId(sig.id);
                          scrollToPage(sig.pageIndex);
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-zinc-800 border-[#1DB954] shadow-[0_0_10px_rgba(29,185,84,0.15)]"
                            : "bg-zinc-900 border-zinc-800 hover:bg-zinc-850"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-12 h-7 bg-white rounded border border-zinc-300 flex items-center justify-center p-0.5 overflow-hidden shrink-0">
                            <img src={sig.dataUrl} alt="Signature" className="max-h-full object-contain" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-zinc-200 block truncate">
                              Signature {idx + 1}
                            </span>
                            <span className="text-[10px] text-zinc-400">Attached to Page {sig.pageIndex + 1}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateSig(sig.id);
                            }}
                            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-[#1DB954] transition-colors cursor-pointer"
                            title="Duplicate Signature (Ctrl+D)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              soundEffects.playClick();
                              setPlacedSignatures((prev) => prev.filter((s) => s.id !== sig.id));
                              if (selectedSigId === sig.id) setSelectedSigId(null);
                            }}
                            className="p-1 rounded-lg hover:bg-rose-950 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Signature"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Right Panel: Continuous Vertically Scrollable Full PDF Document (8.5 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="bg-[#18181b] p-4 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl">
              {/* Sticky Top Document Navigation & Zoom Toolbar */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1DB954]" />
                  <span className="font-bold text-zinc-200">Full Document Preview</span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Jump Page Selector */}
                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => scrollToPage(visiblePageIndex - 1)}
                      disabled={visiblePageIndex === 0}
                      className="p-1 rounded hover:bg-zinc-800 text-white disabled:opacity-30 cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-mono text-zinc-200 px-1 font-bold">
                      {visiblePageIndex + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => scrollToPage(visiblePageIndex + 1)}
                      disabled={visiblePageIndex >= totalPages - 1}
                      className="p-1 rounded hover:bg-zinc-800 text-white disabled:opacity-30 cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.15))}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold text-zinc-300 px-1.5">
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      onClick={() => setZoomScale((z) => Math.min(1.6, z + 0.15))}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Vertically Scrollable Multi-Page Container */}
              <div
                ref={scrollContainerRef}
                className="bg-zinc-950 p-6 rounded-xl border border-zinc-800/80 overflow-y-auto max-h-[640px] flex flex-col items-center gap-6 custom-scrollbar scroll-smooth relative"
              >
                {pagesMeta.map((p) => (
                  <PdfPageCard
                    key={p.pageIndex}
                    pageIndex={p.pageIndex}
                    totalPages={totalPages}
                    pdfDoc={pdfJsDoc}
                    zoomScale={zoomScale}
                    signatures={placedSignatures}
                    selectedSigId={selectedSigId}
                    draggingSigId={draggingState?.sigId || null}
                    hoveredDropPage={hoveredDropPage}
                    onSelectSig={(id) => setSelectedSigId(id)}
                    onUpdateSig={(updated) =>
                      setPlacedSignatures((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
                    }
                    onDeleteSig={(id) => {
                      setPlacedSignatures((prev) => prev.filter((s) => s.id !== id));
                      if (selectedSigId === id) setSelectedSigId(null);
                    }}
                    onDuplicateSig={handleDuplicateSig}
                    onStartDragSig={handleStartDragSig}
                  />
                ))}

                {/* Floating Active Dragged Signature Proxy */}
                {draggingState && (
                  <div
                    style={{
                      position: "fixed",
                      left: `${draggingState.currentClientX - draggingState.offsetX}px`,
                      top: `${draggingState.currentClientY - draggingState.offsetY}px`,
                      width: `${draggingState.width}px`,
                      height: `${draggingState.height}px`,
                      pointerEvents: "none",
                      zIndex: 9999,
                    }}
                    className="border-2 border-[#1DB954] bg-[#1DB954]/20 rounded shadow-2xl ring-4 ring-[#1DB954]/50 cursor-grabbing backdrop-blur-sm"
                  >
                    <img
                      src={draggingState.dataUrl}
                      alt="Dragging Signature"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Success Download Banner */}
            {signedPdfBytes && (
              <div className="bg-emerald-950/70 border border-emerald-500/40 p-4 rounded-xl flex items-center justify-between animate-fadeIn shadow-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1DB954]" />
                  <div>
                    <span className="text-xs font-bold text-white block">Document Signed Successfully!</span>
                    <span className="text-[11px] text-zinc-300">
                      All {totalPages} original pages preserved with embedded signatures.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onSaveToCloud && (
                    <button
                      onClick={() => {
                        onSaveToCloud(
                          signedPdfBytes,
                          `${activeFile.name.replace(/\.[^/.]+$/, "")}_signed.pdf`,
                          "sign-pdf"
                        );
                        setIsSavedToCloudState(true);
                      }}
                      disabled={isSavedToCloudState}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-3 py-2 rounded-lg border border-zinc-700 cursor-pointer"
                    >
                      {isSavedToCloudState ? "Saved" : "Save to Cloud"}
                    </button>
                  )}

                  <button
                    onClick={handleDownloadSigned}
                    className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Download Complete Signed PDF</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Single Handwriting Canvas Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#18181b] border border-zinc-800 rounded-2xl w-full max-w-[620px] p-5 shadow-2xl flex flex-col gap-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-[#1DB954]" />
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  Add Signature to Page {visiblePageIndex + 1}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Signature Drawing Box */}
            <div className="relative bg-white rounded-xl border border-zinc-300 shadow-inner overflow-hidden select-none">
              <canvas
                ref={signCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-[240px] block cursor-crosshair touch-none"
                style={{ touchAction: "none" }}
              />

              {strokes.length === 0 && !isDrawing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <span className="text-zinc-400/60 font-serif italic text-2xl tracking-wide">Sign here</span>
                </div>
              )}

              <div className="absolute bottom-10 inset-x-8 border-b border-zinc-300/60 pointer-events-none select-none" />
            </div>

            {/* Controls Bar: Pen Size, Ink Color, Undo, Redo, Clear */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-zinc-300">
                  <span className="text-[11px] text-zinc-400 font-medium">Pen size</span>
                  <input
                    type="range"
                    min={1.2}
                    max={5.0}
                    step={0.2}
                    value={penSize}
                    onChange={(e) => setPenSize(parseFloat(e.target.value))}
                    className="w-20 accent-[#1DB954] cursor-pointer"
                    title={`Thickness: ${penSize}px`}
                  />
                </div>

                <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
                  <button
                    onClick={() => setPenColor("#000000")}
                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                      penColor === "#000000" ? "scale-125 border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: "#000000" }}
                    title="Black Ink"
                  />
                  <button
                    onClick={() => setPenColor("#1e3a8a")}
                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                      penColor === "#1e3a8a" ? "scale-125 border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: "#1e3a8a" }}
                    title="Dark Blue Ink"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleUndo}
                  disabled={strokes.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                  title="Undo Stroke"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Undo</span>
                </button>

                <button
                  onClick={handleRedo}
                  disabled={redoHistory.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                  title="Redo Stroke"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Redo</span>
                </button>

                <button
                  onClick={handleClearSignature}
                  disabled={strokes.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-400 disabled:opacity-30 transition-colors cursor-pointer"
                  title="Clear Canvas"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Clear</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleUseSignature}
                disabled={strokes.length === 0}
                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-full transition-all shadow-md shadow-emerald-950/40 disabled:opacity-40 cursor-pointer"
              >
                <span>Use Signature</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
