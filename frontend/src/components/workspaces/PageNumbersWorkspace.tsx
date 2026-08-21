import React, { useState, useRef, useEffect } from "react";
import {
  Hash,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Type,
  Palette,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { apiAddPageNumbers, apiRecordDownload, UserProfile } from "../../lib/api";
import { downloadPdfBytes, fileToArrayBuffer } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface PageNumbersWorkspaceProps {
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onDownloadRecorded?: () => void;
}

export const PageNumbersWorkspace: React.FC<PageNumbersWorkspaceProps> = ({
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

  // Settings
  const [position, setPosition] = useState<"top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right">("bottom-center");
  const [formatType, setFormatType] = useState<"1" | "Page 1" | "1 / 10" | "Page 1 of 10">("Page 1 of 10");
  const [startNumber, setStartNumber] = useState<number>(1);
  const [fontSize, setFontSize] = useState<number>(10);
  const [margin, setMargin] = useState<number>(30);
  const [color, setColor] = useState<string>("#4b5563");
  const [pagesScope, setPagesScope] = useState<"all" | "range">("all");
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(activeFile?.pagesCount || 1);

  // State
  const [isApplying, setIsApplying] = useState(false);
  const [numberedPdfBytes, setNumberedPdfBytes] = useState<Uint8Array | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavedToCloudState, setIsSavedToCloudState] = useState(false);

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render PDF Page to canvas
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
        setEndPage(pdfDoc.numPages);
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

  // Compute text preview string
  const getPreviewText = (pageIdx: number) => {
    const num = (pageIdx + 1 - startPage) + startNumber;
    if (formatType === "Page 1") return `Page ${num}`;
    if (formatType === "1 / 10") return `${num} / ${totalPages}`;
    if (formatType === "Page 1 of 10") return `Page ${num} of ${totalPages}`;
    return `${num}`;
  };

  // Run Apply Page Numbers
  const handleApplyNumbers = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsApplying(true);
    setErrorMsg(null);
    setNumberedPdfBytes(null);

    try {
      const options = {
        position,
        format_type: formatType,
        start_number: startNumber,
        font_size: fontSize,
        margin,
        color,
        pages_scope: pagesScope,
        start_page: startPage,
        end_page: endPage,
      };

      const outputBytes = await apiAddPageNumbers(activeFile.file, options);
      setNumberedPdfBytes(outputBytes);
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Page numbers error:", err);
      setErrorMsg(err?.message || "Failed to embed page numbers onto PDF.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleDownload = () => {
    if (!numberedPdfBytes || !activeFile) return;
    soundEffects.playClick();
    const outName = `${activeFile.name.replace(/\.[^/.]+$/, "")}_numbered.pdf`;
    downloadPdfBytes(numberedPdfBytes, outName);

    if (user) {
      apiRecordDownload(numberedPdfBytes, outName, "Page Numbers")
        .then(() => onDownloadRecorded?.())
        .catch((e) => console.warn(e));
    } else {
      recordDownloadedDoc(outName, numberedPdfBytes.byteLength, totalPages, "Page Numbers", numberedPdfBytes);
      onDownloadRecorded?.();
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 font-sans text-white">
      {/* Header */}
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <Hash className="w-4 h-4" />
            <span>PAGE NUMBERS</span>
          </div>
          <h2 className="text-xl font-bold mt-0.5">Add Customizable Page Numbers to PDF</h2>
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
          {/* LEFT: NUMBERING CONFIGURATION (5 COLS) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
              {/* Position Grid (6 positions) */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  1. Select Position
                </span>
                <div className="grid grid-cols-3 gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                  {[
                    { id: "top-left", label: "Top Left" },
                    { id: "top-center", label: "Top Center" },
                    { id: "top-right", label: "Top Right" },
                    { id: "bottom-left", label: "Bottom Left" },
                    { id: "bottom-center", label: "Bottom Center" },
                    { id: "bottom-right", label: "Bottom Right" },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => {
                        soundEffects.playClick();
                        setPosition(pos.id as any);
                      }}
                      className={`p-2.5 rounded-lg text-xs font-medium text-center transition-all cursor-pointer border ${
                        position === pos.id
                          ? "bg-[#1DB954] text-black border-[#1DB954] font-bold"
                          : "bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:text-white"
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format Options */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  2. Select Format
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "1", label: "1, 2, 3..." },
                    { id: "Page 1", label: "Page 1" },
                    { id: "1 / 10", label: "1 / 10" },
                    { id: "Page 1 of 10", label: "Page 1 of 10" },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => {
                        soundEffects.playClick();
                        setFormatType(fmt.id as any);
                      }}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        formatType === fmt.id
                          ? "bg-zinc-800 border-[#1DB954] shadow-md text-white font-bold"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <span className="text-xs">{fmt.label}</span>
                      {formatType === fmt.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography & Color */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-400">Font Size ({fontSize} pt)</span>
                  <input
                    type="range"
                    min="8"
                    max="18"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="accent-[#1DB954] cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-400">Margin Distance ({margin} pt)</span>
                  <input
                    type="range"
                    min="15"
                    max="60"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="accent-[#1DB954] cursor-pointer"
                  />
                </div>
              </div>

              {/* Color Picker */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-xs text-zinc-400">Color:</span>
                <div className="flex items-center gap-2">
                  {["#000000", "#4b5563", "#1e3a8a", "#047857", "#dc2626"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        color === c ? "scale-125 border-white" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleApplyNumbers}
                disabled={isApplying}
                className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-4 rounded-full transition-all shadow-xl shadow-[#1DB954]/20 cursor-pointer disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-black" />
                    <span>EMBEDDING PAGE NUMBERS...</span>
                  </>
                ) : (
                  <>
                    <Hash className="w-4 h-4" />
                    <span>ADD PAGE NUMBERS & DOWNLOAD</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT: LIVE PREVIEW CANVAS (7 COLS) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-[#18181b] p-4 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl">
              {/* Pagination controls */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <Layers className="w-4 h-4 text-[#1DB954]" />
                  <span>Live Page Number Preview</span>
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
              <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800 flex items-center justify-center overflow-auto">
                <div className="relative bg-white shadow-2xl rounded overflow-hidden">
                  <canvas ref={bgCanvasRef} className="block" />

                  {/* Simulated Position Indicator Tag */}
                  <div
                    style={{
                      color: color,
                      fontSize: `${fontSize * pageViewport.scale}px`,
                      top: position.startsWith("top") ? `${margin * pageViewport.scale}px` : undefined,
                      bottom: position.startsWith("bottom") ? `${margin * pageViewport.scale}px` : undefined,
                      left: position.endsWith("left")
                        ? `${margin * pageViewport.scale}px`
                        : position.endsWith("center")
                        ? "50%"
                        : undefined,
                      right: position.endsWith("right") ? `${margin * pageViewport.scale}px` : undefined,
                      transform: position.endsWith("center") ? "translateX(-50%)" : undefined,
                    }}
                    className="absolute font-sans font-medium px-2 py-0.5 rounded bg-black/10 border border-[#1DB954] pointer-events-none shadow"
                  >
                    {getPreviewText(currentPageIndex)}
                  </div>
                </div>
              </div>
            </div>

            {/* Success Download Banner */}
            {numberedPdfBytes && (
              <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-xl flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1DB954]" />
                  <div>
                    <span className="text-xs font-bold text-white block">Page Numbers Applied!</span>
                    <span className="text-[11px] text-zinc-300">
                      Document compiled with formatted page numbering.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onSaveToCloud && (
                    <button
                      onClick={() => {
                        onSaveToCloud(numberedPdfBytes, `${activeFile.name.replace(/\.[^/.]+$/, "")}_numbered.pdf`, "page-numbers");
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
                    <span>Download Numbered PDF</span>
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
