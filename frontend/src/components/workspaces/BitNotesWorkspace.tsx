import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StickyNote,
  Upload,
  Plus,
  Trash2,
  RotateCw,
  Sparkles,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Layers,
  Settings2,
  Grid,
  Check,
  FileText,
  AlertCircle,
  HelpCircle,
  FileCheck,
  Cloud,
  CheckCircle2,
  HardDrive,
  ZoomIn,
  ZoomOut,
  GripVertical,
  Scissors,
  Square,
  LayoutGrid,
} from "lucide-react";
import {
  BitNoteItem,
  BitNotesLayoutOptions,
  PaperSize,
  Orientation,
  CutLineStyle,
  NoteBorderStyle,
  PresetLayout,
  PDFFileItem,
} from "../../types";
import {
  calculatePageLayout,
  calculateNoteFitInCell,
  parseFilesToBitNotes,
  generateBitNotesPDF,
  printBitNotesPdf,
  recommendSmartLayout,
  getPaperDimensions,
} from "../../lib/bitNotesEngine";
import { soundEffects } from "../../lib/audio";
import { downloadPdfBytes } from "../../lib/pdfEngine";
import { UserProfile, apiRecordDownload } from "../../lib/api";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface BitNotesWorkspaceProps {
  activeFile?: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker?: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array, filename: string, op: string) => Promise<void>;
  onSaveToGoogleDrive?: (bytes: Uint8Array, name: string) => Promise<void>;
  onDownloadRecorded?: () => void;
}

export const BitNotesWorkspace: React.FC<BitNotesWorkspaceProps> = ({
  activeFile,
  user,
  onSaveToCloud,
  onSaveToGoogleDrive,
  onDownloadRecorded,
}) => {
  // Uploaded bit notes
  const [notes, setNotes] = useState<BitNoteItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number; msg: string } | null>(null);

  // Layout Configuration
  const [options, setOptions] = useState<BitNotesLayoutOptions>({
    paperSize: "A4",
    customWidthMm: 210,
    customHeightMm: 297,
    orientation: "portrait",
    preset: "8-per-page",
    columns: 2,
    rows: 4,
    outerMarginMm: 10,
    gapMm: 5,
    autoFit: true,
    autoRotate: true,
    cutLines: "dashed",
    borders: "thin",
  });

  // Current page in preview
  const [currentPage, setCurrentPage] = useState<number>(0); // 0-based
  const [zoomLevel, setZoomLevel] = useState<number>(100); // percentage

  // Drag-and-drop state for reordering
  const [draggedNoteIndex, setDraggedNoteIndex] = useState<number | null>(null);
  const [dragOverNoteIndex, setDragOverNoteIndex] = useState<number | null>(null);

  // PDF Export & Generation State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [generatedPdfBytes, setGeneratedPdfBytes] = useState<Uint8Array | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSavedCloud, setIsSavedCloud] = useState(false);
  const [isSavedDrive, setIsSavedDrive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Auto-ingest activeFile if available on initial mount and notes list is empty
  useEffect(() => {
    if (activeFile && notes.length === 0) {
      parseFilesToBitNotes([activeFile.file]).then((parsed) => {
        if (parsed.length > 0) {
          setNotes(parsed);
        }
      });
    }
  }, [activeFile]);

  // Compute Layout Information
  const layout = useMemo(() => {
    return calculatePageLayout(options, notes.length);
  }, [options, notes.length]);

  // Ensure currentPage stays in range when notes count or layout changes
  useEffect(() => {
    if (currentPage >= layout.totalPages) {
      setCurrentPage(Math.max(0, layout.totalPages - 1));
    }
  }, [layout.totalPages, currentPage]);

  // Handle file ingestion
  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    soundEffects.playClick();
    setIsLoadingFiles(true);
    setLoadingProgress({ current: 0, total: fileList.length, msg: "Preparing files..." });

    try {
      const parsedNotes = await parseFilesToBitNotes(fileList, (curr, tot, msg) => {
        setLoadingProgress({ current: curr, total: tot, msg });
      });

      if (parsedNotes.length > 0) {
        setNotes((prev) => [...prev, ...parsedNotes]);
        soundEffects.playSuccess();
      }
    } catch (err: any) {
      console.error("Failed to parse notes:", err);
      alert(`Could not process notes: ${err?.message || "Invalid files"}`);
    } finally {
      setIsLoadingFiles(false);
      setLoadingProgress(null);
    }
  };

  // Remove a single note
  const handleRemoveNote = (id: string) => {
    soundEffects.playClick();
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Rotate a single note by 90 degrees
  const handleRotateNote = (id: string) => {
    soundEffects.playClick();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, rotation: ((n.rotation || 0) + 90) % 360 } : n
      )
    );
  };

  // Reorder notes via Drag and Drop
  const handleDragStart = (idx: number) => {
    setDraggedNoteIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverNoteIndex(idx);
  };

  const handleDropNote = (dropIdx: number) => {
    if (draggedNoteIndex === null || draggedNoteIndex === dropIdx) {
      setDraggedNoteIndex(null);
      setDragOverNoteIndex(null);
      return;
    }

    soundEffects.playClick();
    const updated = [...notes];
    const [draggedItem] = updated.splice(draggedNoteIndex, 1);
    updated.splice(dropIdx, 0, draggedItem);
    setNotes(updated);
    setDraggedNoteIndex(null);
    setDragOverNoteIndex(null);
  };

  // Smart Auto-Arrange layout recommendation
  const handleAutoArrange = () => {
    if (notes.length === 0) return;
    soundEffects.playClick();
    const recommendation = recommendSmartLayout(notes, options.paperSize);
    setOptions((prev) => ({
      ...prev,
      orientation: recommendation.recommendedOrientation,
      preset: recommendation.recommendedPreset,
      autoFit: true,
      autoRotate: true,
    }));
    soundEffects.playSuccess();
  };

  // Generate & Export PDF
  const handleExportPDF = async () => {
    if (notes.length === 0) {
      alert("Please upload some notes first.");
      return;
    }

    soundEffects.playClick();
    setIsExporting(true);
    setExportProgress({ current: 1, total: layout.totalPages });

    try {
      const pdfBytes = await generateBitNotesPDF(notes, options, (page, total) => {
        setExportProgress({ current: page, total });
      });

      setGeneratedPdfBytes(pdfBytes);
      const filename = "bit-notes.pdf";
      downloadPdfBytes(pdfBytes, filename);
      soundEffects.playSuccess();

      // Record download
      if (user) {
        apiRecordDownload(pdfBytes, filename, "Bit Notes Maker")
          .then(() => onDownloadRecorded?.())
          .catch((err) => console.warn(err));
      } else {
        await recordDownloadedDoc(
          filename,
          pdfBytes.length,
          layout.totalPages,
          "Bit Notes Maker",
          new Blob([pdfBytes], { type: "application/pdf" })
        );
        onDownloadRecorded?.();
      }
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      alert(`Export failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // Handle direct print
  const handleDirectPrint = async () => {
    if (notes.length === 0) return;
    soundEffects.playClick();
    try {
      const bytes = generatedPdfBytes || (await generateBitNotesPDF(notes, options));
      printBitNotesPdf(bytes);
    } catch (err) {
      console.error(err);
      alert("Failed to initiate print.");
    }
  };

  // Notes on current preview page
  const pageStartIndex = currentPage * layout.notesPerPage;
  const currentPageNotes = notes.slice(
    pageStartIndex,
    pageStartIndex + layout.notesPerPage
  );

  // Estimated physical note size string (mm)
  const estimatedSizeStr = `${Math.round(layout.cellWidthMm)} × ${Math.round(layout.cellHeightMm)} mm`;

  return (
    <div className="flex flex-col gap-5 text-zinc-100 max-w-7xl mx-auto w-full pb-16">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleUploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={addMoreInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleUploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Header Banner */}
      <div className="bg-[#18181b] p-6 rounded-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-[#1DB954] shrink-0 shadow-inner">
            <StickyNote className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#1DB954] uppercase tracking-wider bg-[#1DB954]/10 px-2 py-0.5 rounded border border-[#1DB954]/20">
                Exam & Study Prep
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">100% Client Vector PDF</span>
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 mt-1 tracking-tight">
              Bit Notes Maker
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Arrange your small notes into compact printable sheets with cut lines.
            </p>
          </div>
        </div>

        {/* Dynamic Summary Badges & Quick Action */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 px-3 py-2 rounded-lg text-xs">
            <span className="text-zinc-400 font-medium">Notes:</span>
            <span className="text-zinc-100 font-bold font-mono">{notes.length}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 font-medium">Pages:</span>
            <span className="text-[#1DB954] font-bold font-mono">{layout.totalPages}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 font-medium">Size:</span>
            <span className="text-zinc-200 font-mono">{estimatedSizeStr}</span>
          </div>

          <button
            onClick={handleAutoArrange}
            disabled={notes.length === 0}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700/80 disabled:opacity-50 text-zinc-200 text-xs font-semibold px-3.5 py-2.5 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer"
            title="Automatically arrange and rotate to minimize wasted paper"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#1DB954]" />
            <span>Auto Arrange</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            disabled={notes.length === 0}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700/80 disabled:opacity-50 text-zinc-200 text-xs font-semibold px-3.5 py-2.5 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-300" />
            <span>Print Preview</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={notes.length === 0 || isExporting}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>{isExporting ? "Exporting PDF..." : "EXPORT BIT NOTES PDF"}</span>
          </button>
        </div>
      </div>

      {/* Loading Progress State */}
      {isLoadingFiles && (
        <div className="bg-zinc-900/90 border border-[#1DB954]/30 rounded-xl p-4 flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-xs font-semibold text-zinc-200">{loadingProgress?.msg || "Processing files..."}</p>
              <p className="text-[11px] text-zinc-400">
                Parsing images and decomposing PDF pages into individual bit notes...
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-[#1DB954]">
            {loadingProgress ? `${loadingProgress.current} / ${loadingProgress.total}` : ""}
          </span>
        </div>
      )}

      {/* Main Workspace 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Uploads & Control Settings (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Section 1: Upload & Notes Management */}
          <div className="bg-[#18181b] rounded-xl border border-zinc-800 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#1DB954]" />
                <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                  Uploaded Notes ({notes.length})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {notes.length > 0 && (
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setNotes([]);
                    }}
                    className="text-[11px] text-zinc-400 hover:text-rose-400 transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => addMoreInputRef.current?.click()}
                  className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-[#1DB954] text-xs font-semibold px-2.5 py-1 rounded-md border border-zinc-700/60 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Notes</span>
                </button>
              </div>
            </div>

            {/* Drop Zone / Empty State */}
            {notes.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files) handleUploadFiles(e.dataTransfer.files);
                }}
                className="border-2 border-dashed border-zinc-700 hover:border-[#1DB954] bg-zinc-900/50 hover:bg-zinc-900/80 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-[#1DB954] group-hover:scale-105 transition-all">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-bold text-zinc-200 mt-1">Drop small notes here</h3>
                <p className="text-[11px] text-zinc-400 max-w-xs">
                  Supports JPG, PNG, WEBP, and multi-page PDFs (automatically converted to individual notes).
                </p>
                <button className="mt-2 bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold px-4 py-2 rounded-lg transition-colors pointer-events-none">
                  + Add Notes
                </button>
              </div>
            ) : (
              /* Grid of Uploaded Note Cards with Reordering */
              <div className="flex flex-col gap-2">
                <div className="max-h-[320px] overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                  {notes.map((note, idx) => {
                    const isDragging = draggedNoteIndex === idx;
                    const isDragOver = dragOverNoteIndex === idx;

                    return (
                      <div
                        key={note.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={() => handleDropNote(idx)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                          isDragOver
                            ? "border-[#1DB954] bg-[#1DB954]/10"
                            : isDragging
                            ? "opacity-40 border-zinc-600 bg-zinc-800"
                            : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700"
                        }`}
                      >
                        {/* Drag Handle & Note Number */}
                        <div className="flex items-center gap-1.5 text-zinc-500 cursor-grab active:cursor-grabbing shrink-0">
                          <GripVertical className="w-4 h-4" />
                          <span className="text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                        </div>

                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded bg-zinc-950 border border-zinc-700/60 overflow-hidden shrink-0 relative flex items-center justify-center">
                          <img
                            src={note.dataUrl}
                            alt={note.title}
                            className="w-full h-full object-contain"
                            style={{
                              transform: `rotate(${note.rotation || 0}deg)`,
                              transition: "transform 0.2s",
                            }}
                          />
                        </div>

                        {/* Metadata */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-zinc-200 truncate">
                            {note.title}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-2 font-mono">
                            <span>{note.sourceType === "pdf_page" ? `PDF Page ${note.pageIndex}` : "Image"}</span>
                            <span>•</span>
                            <span>{note.width} × {note.height}px</span>
                            {note.rotation ? (
                              <span className="text-[#1DB954]">({note.rotation}°)</span>
                            ) : null}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleRotateNote(note.id)}
                            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                            title="Rotate 90°"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveNote(note.id)}
                            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                            title="Remove note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Drag hint */}
                <p className="text-[10px] text-zinc-400 text-center mt-1">
                  Drag items to reorder notes. Changes update sheet preview immediately.
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Paper & Grid Configuration */}
          <div className="bg-[#18181b] rounded-xl border border-zinc-800 p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-1 border-b border-zinc-800/80">
              <Settings2 className="w-4 h-4 text-[#1DB954]" />
              <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                Paper & Layout Setup
              </h2>
            </div>

            {/* Paper Size & Orientation */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                  Paper Size
                </label>
                <select
                  value={options.paperSize}
                  onChange={(e) => {
                    soundEffects.playClick();
                    setOptions({ ...options, paperSize: e.target.value as PaperSize });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-medium focus:outline-none focus:border-[#1DB954]"
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="A3">A3 (297 × 420 mm)</option>
                  <option value="Letter">Letter (8.5 × 11 in)</option>
                  <option value="Custom">Custom Size (mm)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                  Orientation
                </label>
                <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-700/80">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setOptions({ ...options, orientation: "portrait" });
                    }}
                    className={`py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                      options.orientation === "portrait"
                        ? "bg-zinc-800 text-[#1DB954] shadow"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setOptions({ ...options, orientation: "landscape" });
                    }}
                    className={`py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                      options.orientation === "landscape"
                        ? "bg-zinc-800 text-[#1DB954] shadow"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>
            </div>

            {/* Custom mm inputs if Custom selected */}
            {options.paperSize === "Custom" && (
              <div className="grid grid-cols-2 gap-3 p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-700/50">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Width (mm)</label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    value={options.customWidthMm || 210}
                    onChange={(e) =>
                      setOptions({ ...options, customWidthMm: Math.max(50, Number(e.target.value)) })
                    }
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Height (mm)</label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    value={options.customHeightMm || 297}
                    onChange={(e) =>
                      setOptions({ ...options, customHeightMm: Math.max(50, Number(e.target.value)) })
                    }
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
            )}

            {/* Notes Per Page Preset */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                Notes Per Page
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "12-per-page", label: "12 / page", desc: "Small" },
                  { id: "8-per-page", label: "8 / page", desc: "Medium" },
                  { id: "6-per-page", label: "6 / page", desc: "Large" },
                  { id: "4-per-page", label: "4 / page", desc: "XL" },
                  { id: "custom", label: "Custom Grid", desc: `${options.columns}×${options.rows}` },
                ].map((item) => {
                  const isSelected = options.preset === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        soundEffects.playClick();
                        setOptions({ ...options, preset: item.id as PresetLayout });
                      }}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-[#1DB954]/10 border-[#1DB954] text-zinc-100"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <span className={`text-xs font-bold ${isSelected ? "text-[#1DB954]" : ""}`}>
                        {item.label}
                      </span>
                      <span className="text-[10px] text-zinc-400">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Grid Rows/Cols Controls */}
            {options.preset === "custom" && (
              <div className="grid grid-cols-2 gap-3 p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-700/50">
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Columns</span>
                    <span className="font-mono text-zinc-200">{options.columns}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={options.columns}
                    onChange={(e) => setOptions({ ...options, columns: Number(e.target.value) })}
                    className="w-full accent-[#1DB954] cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Rows</span>
                    <span className="font-mono text-zinc-200">{options.rows}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={options.rows}
                    onChange={(e) => setOptions({ ...options, rows: Number(e.target.value) })}
                    className="w-full accent-[#1DB954] cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Margins and Gaps */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-zinc-300 mb-1">
                  <span>Outer Margin</span>
                  <span className="font-mono text-[#1DB954] text-xs">{options.outerMarginMm} mm</span>
                </div>
                <div className="flex gap-1">
                  {[5, 10, 15, 20].map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        soundEffects.playClick();
                        setOptions({ ...options, outerMarginMm: m });
                      }}
                      className={`flex-1 py-1 rounded text-[11px] font-mono font-medium border transition-colors ${
                        options.outerMarginMm === m
                          ? "bg-zinc-800 text-[#1DB954] border-[#1DB954]/50"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-zinc-300 mb-1">
                  <span>Gap Between Notes</span>
                  <span className="font-mono text-[#1DB954] text-xs">{options.gapMm} mm</span>
                </div>
                <div className="flex gap-1">
                  {[0, 2, 5, 10].map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        soundEffects.playClick();
                        setOptions({ ...options, gapMm: g });
                      }}
                      className={`flex-1 py-1 rounded text-[11px] font-mono font-medium border transition-colors ${
                        options.gapMm === g
                          ? "bg-zinc-800 text-[#1DB954] border-[#1DB954]/50"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cut Lines and Note Borders */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-800/80">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Cut Lines</span>
                </label>
                <select
                  value={options.cutLines}
                  onChange={(e) => {
                    soundEffects.playClick();
                    setOptions({ ...options, cutLines: e.target.value as CutLineStyle });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-medium focus:outline-none focus:border-[#1DB954]"
                >
                  <option value="dashed">Dashed Lines (Default)</option>
                  <option value="light">Light Solid Lines</option>
                  <option value="crop-marks">Corner Crop Marks</option>
                  <option value="none">None (No lines)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                  <Square className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Note Border</span>
                </label>
                <select
                  value={options.borders}
                  onChange={(e) => {
                    soundEffects.playClick();
                    setOptions({ ...options, borders: e.target.value as NoteBorderStyle });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-medium focus:outline-none focus:border-[#1DB954]"
                >
                  <option value="thin">Thin Border (Default)</option>
                  <option value="medium">Medium Border</option>
                  <option value="none">No Border</option>
                </select>
              </div>
            </div>

            {/* Toggles: Auto Fit & Auto Rotate */}
            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={options.autoFit}
                  onChange={(e) => setOptions({ ...options, autoFit: e.target.checked })}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-[#1DB954] accent-[#1DB954] cursor-pointer"
                />
                <span>Auto Fit (Preserve Aspect Ratio without Stretching)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={options.autoRotate}
                  onChange={(e) => setOptions({ ...options, autoRotate: e.target.checked })}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-[#1DB954] accent-[#1DB954] cursor-pointer"
                />
                <span>Auto Rotate (Rotate individual notes to maximize size)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Live Realistic A4 Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#18181b] rounded-xl border border-zinc-800 p-4 flex flex-col gap-3 shadow-xl">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1DB954]" />
                <span className="text-xs font-bold text-zinc-200">
                  Printable Sheet Preview
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  ({options.paperSize} {options.orientation.toUpperCase()})
                </span>
              </div>

              {/* Page Controls & Zoom */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 text-xs">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setCurrentPage((p) => Math.max(0, p - 1));
                    }}
                    disabled={currentPage === 0}
                    className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-300"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-zinc-200 px-1 font-semibold">
                    {currentPage + 1} / {layout.totalPages}
                  </span>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setCurrentPage((p) => Math.min(layout.totalPages - 1, p + 1));
                    }}
                    disabled={currentPage >= layout.totalPages - 1}
                    className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-300"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-zinc-900 px-1.5 py-1 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                    className="p-1 text-zinc-400 hover:text-zinc-200"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-zinc-400 w-9 text-center">
                    {zoomLevel}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
                    className="p-1 text-zinc-400 hover:text-zinc-200"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Realistic Sheet Canvas Area */}
            <div className="bg-[#0f0f12] rounded-xl p-4 sm:p-6 flex items-center justify-center overflow-auto min-h-[520px] max-h-[640px] border border-zinc-900 relative">
              {notes.length === 0 ? (
                <div className="text-center flex flex-col items-center gap-2 text-zinc-500 py-16">
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <StickyNote className="w-6 h-6 text-zinc-600" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-400">No notes uploaded yet</p>
                  <p className="text-[11px] text-zinc-500 max-w-xs">
                    Upload images or PDFs to see realistic printable sheet layout here.
                  </p>
                </div>
              ) : (
                /* True Proportion Sheet */
                <div
                  style={{
                    width: `${(layout.paper.widthMm / 210) * 440 * (zoomLevel / 100)}px`,
                    height: `${(layout.paper.heightMm / 210) * 440 * (zoomLevel / 100)}px`,
                    aspectRatio: `${layout.paper.widthMm} / ${layout.paper.heightMm}`,
                  }}
                  className="bg-white text-zinc-900 shadow-2xl rounded-sm relative overflow-hidden shrink-0 select-none transition-all duration-150"
                >
                  {/* Subtle Sheet Margin Guide */}
                  <div
                    style={{
                      position: "absolute",
                      top: `${(options.outerMarginMm / layout.paper.heightMm) * 100}%`,
                      bottom: `${(options.outerMarginMm / layout.paper.heightMm) * 100}%`,
                      left: `${(options.outerMarginMm / layout.paper.widthMm) * 100}%`,
                      right: `${(options.outerMarginMm / layout.paper.widthMm) * 100}%`,
                      pointerEvents: "none",
                      border: "1px dashed rgba(0,0,0,0.08)",
                    }}
                  />

                  {/* Cut Lines Rendering (Dashed or Solid) */}
                  {(options.cutLines === "dashed" || options.cutLines === "light") && (
                    <>
                      {/* Vertical Cut Lines */}
                      {Array.from({ length: layout.columns - 1 }).map((_, c) => {
                        const prevCell = layout.cells[c];
                        const currCell = layout.cells[c + 1];
                        const midXPercent =
                          (((prevCell.xMm + prevCell.widthMm + currCell.xMm) / 2) /
                            layout.paper.widthMm) *
                          100;
                        return (
                          <div
                            key={`v-cut-${c}`}
                            style={{
                              position: "absolute",
                              left: `${midXPercent}%`,
                              top: `${(options.outerMarginMm / layout.paper.heightMm) * 100}%`,
                              bottom: `${(options.outerMarginMm / layout.paper.heightMm) * 100}%`,
                              width: "1px",
                              borderLeft: `1px ${
                                options.cutLines === "dashed" ? "dashed" : "solid"
                              } rgba(120, 120, 130, 0.4)`,
                              pointerEvents: "none",
                              zIndex: 5,
                            }}
                          />
                        );
                      })}

                      {/* Horizontal Cut Lines */}
                      {Array.from({ length: layout.rows - 1 }).map((_, r) => {
                        const topCell = layout.cells[r * layout.columns];
                        const bottomCell = layout.cells[(r + 1) * layout.columns];
                        const midYPercent =
                          (((topCell.yMm + topCell.heightMm + bottomCell.yMm) / 2) /
                            layout.paper.heightMm) *
                          100;
                        return (
                          <div
                            key={`h-cut-${r}`}
                            style={{
                              position: "absolute",
                              top: `${midYPercent}%`,
                              left: `${(options.outerMarginMm / layout.paper.widthMm) * 100}%`,
                              right: `${(options.outerMarginMm / layout.paper.widthMm) * 100}%`,
                              height: "1px",
                              borderTop: `1px ${
                                options.cutLines === "dashed" ? "dashed" : "solid"
                              } rgba(120, 120, 130, 0.4)`,
                              pointerEvents: "none",
                              zIndex: 5,
                            }}
                          />
                        );
                      })}
                    </>
                  )}

                  {/* Grid Cells & Rendered Notes */}
                  {layout.cells.map((cell, cIdx) => {
                    const note = currentPageNotes[cIdx];
                    const globalIdx = pageStartIndex + cIdx;

                    const leftPercent = (cell.xMm / layout.paper.widthMm) * 100;
                    const topPercent = (cell.yMm / layout.paper.heightMm) * 100;
                    const widthPercent = (cell.widthMm / layout.paper.widthMm) * 100;
                    const heightPercent = (cell.heightMm / layout.paper.heightMm) * 100;

                    if (!note) {
                      // Empty cell placeholder
                      return (
                        <div
                          key={`empty-cell-${cIdx}`}
                          style={{
                            position: "absolute",
                            left: `${leftPercent}%`,
                            top: `${topPercent}%`,
                            width: `${widthPercent}%`,
                            height: `${heightPercent}%`,
                          }}
                          className="border border-dashed border-zinc-200/80 rounded-[2px] flex items-center justify-center opacity-40 bg-zinc-50/50"
                        >
                          <span className="text-[9px] font-mono text-zinc-400">
                            Slot {globalIdx + 1}
                          </span>
                        </div>
                      );
                    }

                    const fit = calculateNoteFitInCell(
                      note,
                      cell,
                      options.autoFit,
                      options.autoRotate
                    );

                    const noteWidthPercent = (fit.renderWidthMm / cell.widthMm) * 100;
                    const noteHeightPercent = (fit.renderHeightMm / cell.heightMm) * 100;

                    return (
                      <div
                        key={note.id}
                        style={{
                          position: "absolute",
                          left: `${leftPercent}%`,
                          top: `${topPercent}%`,
                          width: `${widthPercent}%`,
                          height: `${heightPercent}%`,
                        }}
                        className="flex items-center justify-center relative group/cell"
                      >
                        {/* Cut corner ticks if crop-marks enabled */}
                        {options.cutLines === "crop-marks" && (
                          <>
                            <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-zinc-400" />
                            <div className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-zinc-400" />
                            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b border-l border-zinc-400" />
                            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-zinc-400" />
                          </>
                        )}

                        {/* Note Box */}
                        <div
                          style={{
                            width: `${noteWidthPercent}%`,
                            height: `${noteHeightPercent}%`,
                            border:
                              options.borders === "medium"
                                ? "1.5px solid #666"
                                : options.borders === "thin"
                                ? "1px solid #aaa"
                                : "none",
                          }}
                          className="relative flex items-center justify-center bg-white shadow-xs overflow-hidden rounded-[1px]"
                        >
                          <img
                            src={note.dataUrl}
                            alt={note.title}
                            className="w-full h-full object-contain pointer-events-none"
                            style={{
                              transform: `rotate(${fit.effectiveRotation}deg)`,
                            }}
                          />

                          {/* Hover Tooltip & Quick Rotate on Preview */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                            <span className="text-[9px] text-white font-mono font-bold bg-black/80 px-1 py-0.5 rounded">
                              #{globalIdx + 1}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRotateNote(note.id);
                              }}
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded cursor-pointer"
                              title="Rotate 90°"
                            >
                              <RotateCw className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Sheet Metadata & Guidance */}
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954]" />
                  <span>Physical Note Size: <b className="text-zinc-200 font-mono">{estimatedSizeStr}</b></span>
                </span>
                <span>•</span>
                <span>Margin: <b className="text-zinc-200">{options.outerMarginMm}mm</b></span>
                <span>•</span>
                <span>Gap: <b className="text-zinc-200">{options.gapMm}mm</b></span>
              </div>

              <span className="text-[11px] text-zinc-400 italic">
                Print at 100% / Actual Size for accurate cut dimensions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Print Preview & Guidance Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 text-[#1DB954] flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Print Preparation</h3>
                  <p className="text-[11px] text-zinc-400">Physical dimension & print guide</p>
                </div>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-zinc-400 hover:text-zinc-100 text-xs p-1"
              >
                ✕
              </button>
            </div>

            {/* Important Print Instruction Notice */}
            <div className="bg-[#1DB954]/10 border border-[#1DB954]/30 rounded-xl p-3.5 flex items-start gap-3 text-zinc-200 text-xs leading-relaxed">
              <AlertCircle className="w-5 h-5 text-[#1DB954] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#1DB954]">Recommended: Print at 100% / Actual Size</p>
                <p className="text-[11px] text-zinc-300 mt-1">
                  When opening the print dialog, ensure "Fit to Printable Area" or "Shrink to Fit" is <b>DISABLED</b> so each bit note matches the exact {estimatedSizeStr} physical dimensions.
                </p>
              </div>
            </div>

            {/* Summary Details */}
            <div className="bg-zinc-900/90 rounded-xl p-3.5 border border-zinc-800/80 flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Total Notes:</span>
                <span className="font-bold text-zinc-200">{notes.length}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Total Printable Pages:</span>
                <span className="font-bold text-[#1DB954]">{layout.totalPages} Page{layout.totalPages > 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Paper Specification:</span>
                <span className="font-mono text-zinc-200">{options.paperSize} ({options.orientation})</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Cut Line Style:</span>
                <span className="capitalize text-zinc-200">{options.cutLines}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
              >
                Close
              </button>

              <button
                onClick={() => {
                  setShowPrintModal(false);
                  handleDirectPrint();
                }}
                className="flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Direct</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
