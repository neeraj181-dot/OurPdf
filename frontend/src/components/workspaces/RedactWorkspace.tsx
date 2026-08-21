import React, { useState, useRef, useEffect } from "react";
import {
  ShieldAlert,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  FileText,
  Plus,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { apiRedactPdf, apiRecordDownload, UserProfile } from "../../lib/api";
import { downloadPdfBytes, fileToArrayBuffer } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface RedactWorkspaceProps {
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onDownloadRecorded?: () => void;
}

interface RedactionBox {
  id: string;
  page: number;
  x: number; // in PDF points
  y: number; // in PDF points
  width: number;
  height: number;
}

export const RedactWorkspace: React.FC<RedactWorkspaceProps> = ({
  activeFile,
  user,
  onOpenFilePicker,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(activeFile?.pagesCount || 1);
  const [pageViewport, setPageViewport] = useState<{ width: number; height: number; scale: number }>({
    width: 595,
    height: 842,
    scale: 1,
  });

  // Redaction boxes drawn on document
  const [redactions, setRedactions] = useState<RedactionBox[]>([]);
  const [isDrawingRedact, setIsDrawingRedact] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawRect, setCurrentDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Keyword search redactions
  const [keywordInput, setKeywordInput] = useState("");
  const [keywordsList, setKeywordsList] = useState<string[]>([]);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // State
  const [isRedacting, setIsRedacting] = useState(false);
  const [redactedPdfBytes, setRedactedPdfBytes] = useState<Uint8Array | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavedToCloudState, setIsSavedToCloudState] = useState(false);

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Page to Canvas
  useEffect(() => {
    let isCancelled = false;
    const renderPage = async () => {
      if (!activeFile) return;
      try {
        const buffer = await fileToArrayBuffer(activeFile.file);
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        setTotalPages(pdfDoc.numPages);
        const page = await pdfDoc.getPage(currentPageIndex + 1);
        if (isCancelled) return;

        const containerWidth = Math.min(window.innerWidth - 80, 580);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        setPageViewport({ width: unscaledViewport.width, height: unscaledViewport.height, scale });

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

  // Handle Box Drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pageViewport.scale;
    const y = (e.clientY - rect.top) / pageViewport.scale;
    setIsDrawingRedact(true);
    setDrawStart({ x, y });
    setCurrentDrawRect({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingRedact || !drawStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const curX = (e.clientX - rect.left) / pageViewport.scale;
    const curY = (e.clientY - rect.top) / pageViewport.scale;

    const x0 = Math.min(drawStart.x, curX);
    const y0 = Math.min(drawStart.y, curY);
    const w = Math.abs(curX - drawStart.x);
    const h = Math.abs(curY - drawStart.y);

    setCurrentDrawRect({ x: x0, y: y0, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawingRedact || !currentDrawRect) return;
    setIsDrawingRedact(false);

    if (currentDrawRect.w > 10 && currentDrawRect.h > 10) {
      soundEffects.playClick();
      const newBox: RedactionBox = {
        id: `redact-${Date.now()}`,
        page: currentPageIndex,
        x: currentDrawRect.x,
        y: currentDrawRect.y,
        width: currentDrawRect.w,
        height: currentDrawRect.h,
      };
      setRedactions((prev) => [...prev, newBox]);
    }
    setDrawStart(null);
    setCurrentDrawRect(null);
  };

  // Add keyword
  const handleAddKeyword = () => {
    if (!keywordInput.trim()) return;
    soundEffects.playClick();
    setKeywordsList((prev) => [...prev, keywordInput.trim()]);
    setKeywordInput("");
  };

  // Execute Permanent Redactions
  const handleExecuteRedactions = async () => {
    if (!activeFile) return;
    setShowConfirmModal(false);
    soundEffects.playClick();
    setIsRedacting(true);
    setErrorMsg(null);
    setRedactedPdfBytes(null);

    try {
      const outputBytes = await apiRedactPdf(activeFile.file, redactions, keywordsList);
      setRedactedPdfBytes(outputBytes);
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Redact error:", err);
      setErrorMsg(err?.message || "Failed to permanently redact PDF document.");
    } finally {
      setIsRedacting(false);
    }
  };

  const handleDownload = () => {
    if (!redactedPdfBytes || !activeFile) return;
    soundEffects.playClick();
    const outName = `${activeFile.name.replace(/\.[^/.]+$/, "")}_redacted.pdf`;
    downloadPdfBytes(redactedPdfBytes, outName);

    if (user) {
      apiRecordDownload(redactedPdfBytes, outName, "Redact PDF")
        .then(() => onDownloadRecorded?.())
        .catch((e) => console.warn(e));
    } else {
      recordDownloadedDoc(outName, redactedPdfBytes.byteLength, totalPages, "Redact PDF", redactedPdfBytes);
      onDownloadRecorded?.();
    }
  };

  const totalRedactionsCount = redactions.length + keywordsList.length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 font-sans text-white">
      {/* Header */}
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>PERMANENT PDF REDACTION ENGINE</span>
            <span className="bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40 px-2 py-0.5 rounded text-[10px] font-bold ml-1">
              NEW
            </span>
          </div>
          <h2 className="text-xl font-bold mt-0.5">Permanently Blackout & Purge Sensitive Data</h2>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: REDACTION TOOLS (5 COLS) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
              {/* Tool 1: Visual Draw to Redact */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  1. Visual Draw Redaction
                </span>
                <p className="text-[11px] text-zinc-400">
                  Click and drag over text or images on the right preview to mark blackout areas.
                </p>
              </div>

              {/* Tool 2: Keyword Search Redaction */}
              <div className="flex flex-col gap-2 pt-3 border-t border-zinc-800">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-[#1DB954]" />
                  <span>2. Redact by Keyword / Search</span>
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                    placeholder="e.g. email@domain.com, SSN, secret"
                    className="flex-1 bg-zinc-900 border border-zinc-700 text-white text-xs p-2.5 rounded-xl focus:outline-none focus:border-[#1DB954]"
                  />
                  <button
                    onClick={handleAddKeyword}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-3 py-2 rounded-xl border border-zinc-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {keywordsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {keywordsList.map((kw, i) => (
                      <span
                        key={i}
                        className="bg-zinc-900 border border-zinc-700 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5"
                      >
                        <span className="text-zinc-200">{kw}</span>
                        <button
                          onClick={() => setKeywordsList((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Marked Areas List */}
              <div className="flex flex-col gap-2 pt-3 border-t border-zinc-800">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-300">Marked Redaction Items:</span>
                  <span className="text-[#1DB954]">{totalRedactionsCount}</span>
                </div>

                {redactions.length > 0 && (
                  <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                    {redactions.map((box, idx) => (
                      <div key={box.id} className="flex items-center justify-between bg-zinc-900 p-2 rounded-lg text-xs">
                        <span className="text-zinc-300 font-mono">Box #{idx + 1} (Page {box.page + 1})</span>
                        <button
                          onClick={() => setRedactions((prev) => prev.filter((b) => b.id !== box.id))}
                          className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Redact Action Button */}
              <button
                onClick={() => {
                  if (totalRedactionsCount === 0) {
                    setErrorMsg("Please mark at least one area or keyword to redact.");
                    return;
                  }
                  setShowConfirmModal(true);
                }}
                disabled={isRedacting || totalRedactionsCount === 0}
                className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs py-4 rounded-full transition-all shadow-xl shadow-rose-900/30 cursor-pointer disabled:opacity-50"
              >
                {isRedacting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-white" />
                    <span>PERMANENTLY PURGING SENSITIVE DATA...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>APPLY IRREVERSIBLE REDACTIONS</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT: INTERACTIVE DRAW-TO-REDACT CANVAS (7 COLS) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-[#18181b] p-4 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl">
              {/* Pagination controls */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <Layers className="w-4 h-4 text-[#1DB954]" />
                  <span>Visual Redaction Canvas</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                    disabled={currentPageIndex === 0}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-zinc-300">
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

              {/* Interactive Page Container */}
              <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800 flex items-center justify-center overflow-auto cursor-crosshair select-none"
              >
                <div className="relative bg-white shadow-2xl rounded overflow-hidden">
                  <canvas ref={bgCanvasRef} className="block pointer-events-none" />

                  {/* Render placed redaction boxes on current page */}
                  {redactions
                    .filter((b) => b.page === currentPageIndex)
                    .map((box) => (
                      <div
                        key={box.id}
                        style={{
                          left: `${box.x * pageViewport.scale}px`,
                          top: `${box.y * pageViewport.scale}px`,
                          width: `${box.width * pageViewport.scale}px`,
                          height: `${box.height * pageViewport.scale}px`,
                        }}
                        className="absolute bg-black/90 border-2 border-rose-500 flex items-center justify-center group"
                      >
                        <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest pointer-events-none">
                          REDACT
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRedactions((prev) => prev.filter((b) => b.id !== box.id));
                          }}
                          className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1 shadow cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                  {/* Active drawing rect */}
                  {currentDrawRect && isDrawingRedact && (
                    <div
                      style={{
                        left: `${currentDrawRect.x * pageViewport.scale}px`,
                        top: `${currentDrawRect.y * pageViewport.scale}px`,
                        width: `${currentDrawRect.w * pageViewport.scale}px`,
                        height: `${currentDrawRect.h * pageViewport.scale}px`,
                      }}
                      className="absolute bg-rose-500/30 border-2 border-dashed border-rose-500 pointer-events-none"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Success Download Banner */}
            {redactedPdfBytes && (
              <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-xl flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1DB954]" />
                  <div>
                    <span className="text-xs font-bold text-white block">Document Redacted & Sanitized!</span>
                    <span className="text-[11px] text-zinc-300">
                      Underlying text and vector streams have been permanently expunged.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onSaveToCloud && (
                    <button
                      onClick={() => {
                        onSaveToCloud(redactedPdfBytes, `${activeFile.name.replace(/\.[^/.]+$/, "")}_redacted.pdf`, "redact-pdf");
                        setIsSavedToCloudState(true);
                      }}
                      disabled={isSavedToCloudState}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-3 py-2 rounded-lg border border-zinc-700 cursor-pointer"
                    >
                      {isSavedToCloudState ? "Saved" : "Save to Cloud"}
                    </button>
                  )}

                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Download Redacted PDF</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-rose-500/40 p-6 rounded-2xl max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Permanent Redaction Warning</h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Redaction permanently removes underlying text characters, image pixels, and vector graphics from the PDF streams.
              <strong className="text-white block mt-2">
                This operation is irreversible and the redacted content cannot be recovered, searched, or copied.
              </strong>
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRedactions}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-lg shadow-lg cursor-pointer"
              >
                Confirm & Redact Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
