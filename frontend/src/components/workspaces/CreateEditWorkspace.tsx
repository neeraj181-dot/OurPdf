import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText,
  FolderOpen,
  Download,
  Plus,
  Trash2,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Edit2,
  Check,
  X,
  ListTree,
  UploadCloud,
  RefreshCw,
  CornerDownLeft,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { downloadPdfBytes, fileToArrayBuffer } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import {
  apiDetectPdfHeadings,
  apiExportOrganizedPdf,
  DetectedHeadingItem,
  UserProfile,
  apiRecordDownload,
} from "../../lib/api";
import { recordDownloadedDoc } from "../../lib/docStorage";

export interface DocumentPage {
  id: string;
  pageNumber: number;
  originalIndex: number;
  thumbnailUrl?: string | null;
  width: number;
  height: number;
}

interface CreateEditWorkspaceProps {
  activeFile: PDFFileItem | null;
  onUploadClick: () => void;
  onOpenFilePicker: () => void;
  onSelectTool: (toolId: string) => void;
  user?: UserProfile | null;
  onSaveToCloud?: (file: File, name: string) => Promise<void>;
  onDownloadRecorded?: () => void;
}

export const CreateEditWorkspace: React.FC<CreateEditWorkspaceProps> = ({
  activeFile,
  onUploadClick,
  onOpenFilePicker,
  onSelectTool,
  user,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  // Document State
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState<string>("Document.pdf");
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>("");

  // Pages State
  const [pages, setPages] = useState<DocumentPage[]>([
    {
      id: "p-1",
      pageNumber: 1,
      originalIndex: 0,
      width: 595.28,
      height: 841.89,
    },
  ]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isImportedPdfMode, setIsImportedPdfMode] = useState<boolean>(false);

  // Extracted Text Elements & Headings
  const [textElements, setTextElements] = useState<DetectedHeadingItem[]>([]);
  const [headings, setHeadings] = useState<DetectedHeadingItem[]>([]);
  const [selectedElement, setSelectedElement] = useState<DetectedHeadingItem | null>(null);
  const [editDraftText, setEditDraftText] = useState<string>("");
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  // PDF Preview & Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [pdfJsDoc, setPdfJsDoc] = useState<any>(null);
  const [pdfPageViewport, setPdfPageViewport] = useState<{ width: number; height: number; scale: number }>({
    width: 595,
    height: 842,
    scale: 1.0,
  });

  // Processing & Loading States
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // DOM Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const currentPage = pages[activePageIndex] || pages[0];

  // Load activeFile prop if passed
  useEffect(() => {
    if (activeFile && activeFile.file) {
      handleLoadPdfFile(activeFile.file);
    }
  }, [activeFile]);

  // Focus edit input automatically when selecting text block
  useEffect(() => {
    if (selectedElement && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [selectedElement]);

  // 1. PDF Loading & Full Text Element Extraction Pipeline
  const handleLoadPdfFile = async (file: File) => {
    if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
      alert("Please select a valid PDF file.");
      return;
    }

    try {
      setIsLoadingPdf(true);
      setStatusMessage("Reading PDF and extracting text blocks...");
      soundEffects.playClick();
      setCurrentFile(file);

      const cleanFileName = file.name;
      setDocTitle(cleanFileName);
      setTitleDraft(cleanFileName);

      // Load PDF with pdfjs-dist
      const buffer = await fileToArrayBuffer(file);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const loadedDoc = await loadingTask.promise;
      setPdfJsDoc(loadedDoc);
      const numPages = loadedDoc.numPages;

      // Generate Page Thumbnails
      const importedPages: DocumentPage[] = [];
      for (let i = 1; i <= numPages; i++) {
        const page = await loadedDoc.getPage(i);
        const viewport = page.getViewport({ scale: 0.25 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let thumbUrl = null;
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          thumbUrl = canvas.toDataURL("image/jpeg", 0.7);
        }

        importedPages.push({
          id: `page-${i}-${Date.now()}`,
          pageNumber: i,
          originalIndex: i - 1,
          thumbnailUrl: thumbUrl,
          width: page.view[2] || 595.28,
          height: page.view[3] || 841.89,
        });
      }

      setPages(importedPages);
      setActivePageIndex(0);
      setIsImportedPdfMode(true);

      // Extract all text elements & headings via Backend
      setIsDetecting(true);
      setStatusMessage("Extracting all text elements and document headings...");

      try {
        const detected = await apiDetectPdfHeadings(file);
        if (detected.title && detected.title !== "Untitled Document" && detected.title !== "Document.pdf") {
          setDocTitle(detected.title);
          setTitleDraft(detected.title);
        }

        const allElements = detected.textElements && detected.textElements.length > 0
          ? detected.textElements
          : detected.headings || [];

        setTextElements(allElements);
        setHeadings(detected.headings || allElements.filter((el) => ["Title", "H1", "H2", "H3"].includes(el.level)));

        setStatusMessage(
          `Extracted ${allElements.length} text elements across document. Click any text block to edit.`
        );
      } catch (detectErr) {
        console.warn("Backend text detection fallback:", detectErr);
        const fallbackEl: DetectedHeadingItem = {
          id: "txt-auto-1",
          originalText: cleanFileName.replace(/\.pdf$/i, ""),
          text: cleanFileName.replace(/\.pdf$/i, ""),
          level: "Title",
          page: 1,
          position: 1,
          bbox: [50, 60, 450, 90],
          fontSize: 22,
          isBold: true,
        };
        setTextElements([fallbackEl]);
        setHeadings([fallbackEl]);
        setStatusMessage("PDF loaded. Click any text block to edit.");
      }

      soundEffects.playSuccess();
      setIsSaved(true);
    } catch (err: any) {
      console.error("Failed to load PDF:", err);
      alert(`Error loading PDF: ${err?.message || "Invalid or password-protected PDF."}`);
    } finally {
      setIsLoadingPdf(false);
      setIsDetecting(false);
    }
  };

  // 2. Render Active Page onto PDF Preview Canvas
  const renderCurrentPdfPage = useCallback(async () => {
    if (!pdfJsDoc || !pdfCanvasRef.current) return;
    try {
      const pageNumberInPdf = (currentPage?.originalIndex ?? activePageIndex) + 1;
      const page = await pdfJsDoc.getPage(Math.max(1, Math.min(pageNumberInPdf, pdfJsDoc.numPages)));

      const canvas = pdfCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const baseScale = 1.35;
      const scale = baseScale * zoomLevel;
      const viewport = page.getViewport({ scale });

      setPdfPageViewport({ width: viewport.width, height: viewport.height, scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      await page.render(renderContext as any).promise;
    } catch (err) {
      console.error("Error rendering PDF page:", err);
    }
  }, [pdfJsDoc, activePageIndex, currentPage, zoomLevel]);

  useEffect(() => {
    if (isImportedPdfMode && pdfJsDoc) {
      renderCurrentPdfPage();
    }
  }, [isImportedPdfMode, pdfJsDoc, activePageIndex, zoomLevel, renderCurrentPdfPage]);

  // 3. Selection & Edit Box Handlers
  const handleSelectTextBlock = (el: DetectedHeadingItem) => {
    soundEffects.playClick();
    setSelectedElement(el);
    setEditDraftText(el.text);
  };

  const handleApplyTextEdit = () => {
    if (!selectedElement) return;
    soundEffects.playSuccess();
    const newText = editDraftText.trim();

    // Update in all text elements state
    setTextElements((prev) =>
      prev.map((item) =>
        item.id === selectedElement.id ? { ...item, text: newText, isEdited: true } : item
      )
    );

    // Sync with headings / outline tree if it's a heading
    setHeadings((prev) =>
      prev.map((h) =>
        h.id === selectedElement.id ? { ...h, text: newText, isEdited: true } : h
      )
    );

    // If it's the title, update the top title bar
    if (selectedElement.level === "Title") {
      setDocTitle(newText);
      setTitleDraft(newText);
    }

    setIsSaved(false);
    setSelectedElement(null);
  };

  const handleCancelEdit = () => {
    soundEffects.playClick();
    setSelectedElement(null);
  };

  const handleJumpToHeading = (heading: DetectedHeadingItem) => {
    soundEffects.playClick();
    const targetIdx = heading.page - 1;
    if (targetIdx >= 0 && targetIdx < pages.length && targetIdx !== activePageIndex) {
      setActivePageIndex(targetIdx);
    }
    const matchingEl = textElements.find((el) => el.id === heading.id) || heading;
    handleSelectTextBlock(matchingEl);
  };

  // 4. Export Organized PDF Engine
  const handleExportOrganizedPdf = async () => {
    soundEffects.playClick();
    setIsExporting(true);
    setStatusMessage("Applying text edits and generating standard PDF...");

    try {
      if (currentFile && isImportedPdfMode) {
        const pageOrder = pages.map((p) => p.originalIndex);

        const exportedBytes = await apiExportOrganizedPdf(currentFile, {
          title: docTitle,
          headings,
          text_elements: textElements,
          show_page_numbers: false,
          page_order: pageOrder,
        });

        // Verify valid PDF bytes
        if (!exportedBytes || exportedBytes.byteLength === 0) {
          throw new Error("Exported PDF data is empty.");
        }

        const exportName = docTitle.toLowerCase().endsWith(".pdf")
          ? `${docTitle.slice(0, -4)}-edited.pdf`
          : `${docTitle}-edited.pdf`;

        // Clone buffer to avoid any detachment
        const safeBytes = new Uint8Array(exportedBytes.buffer.slice(0));
        downloadPdfBytes(safeBytes, exportName);

        recordDownloadedDoc(exportName, safeBytes.length, "PDF Document Editor");
        if (user) {
          apiRecordDownload(exportName, "pdf", safeBytes.length, "PDF Document Editor");
          if (onSaveToCloud) {
            const blob = new Blob([safeBytes], { type: "application/pdf" });
            const savedFile = new File([blob], exportName, { type: "application/pdf" });
            await onSaveToCloud(savedFile, exportName).catch(() => {});
          }
        }
        if (onDownloadRecorded) onDownloadRecorded();

        setStatusMessage("Export complete! Downloaded valid edited PDF.");
      }

      soundEffects.playSuccess();
      setIsSaved(true);
    } catch (err: any) {
      console.error("Export Failed:", err);
      alert(`Export Failed: ${err?.message || "Failed to generate edited PDF."}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleLoadPdfFile(e.dataTransfer.files[0]);
    }
  };

  // Filter text elements for current visible page
  const currentPageTextElements = textElements.filter((el) => el.page === currentPage.pageNumber);
  const scale = pdfPageViewport.scale || 1.35;

  return (
    <div
      className="flex flex-col gap-3 max-w-7xl mx-auto p-2 font-sans text-white select-none"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* 1. TOP HEADER & TITLE BAR */}
      <div className="bg-[#121215] px-4 py-3 rounded-xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[#1DB954] text-black flex items-center justify-center font-bold shrink-0 shadow-lg shadow-emerald-950/40">
            <Edit2 className="w-5 h-5 stroke-[2.5]" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setDocTitle(titleDraft.trim() || docTitle);
                        setIsEditingTitle(false);
                        setIsSaved(false);
                      }
                      if (e.key === "Escape") {
                        setTitleDraft(docTitle);
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                    placeholder="Document Title..."
                    className="bg-zinc-900 text-sm font-bold text-white px-2.5 py-1 rounded border border-[#1DB954] focus:outline-none min-w-[200px]"
                  />
                  <button
                    onClick={() => {
                      setDocTitle(titleDraft.trim() || docTitle);
                      setIsEditingTitle(false);
                      setIsSaved(false);
                    }}
                    className="p-1 rounded bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <button
                    onClick={() => {
                      setTitleDraft(docTitle);
                      setIsEditingTitle(false);
                    }}
                    className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 group cursor-pointer"
                  onClick={() => {
                    setTitleDraft(docTitle);
                    setIsEditingTitle(true);
                  }}
                >
                  <h1 className="text-base font-extrabold text-white truncate hover:text-[#1DB954] transition-colors max-w-[320px] sm:max-w-md">
                    {docTitle}
                  </h1>
                  <button
                    className="opacity-60 group-hover:opacity-100 p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                    title="Edit Document Title"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  isSaved
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-950 text-amber-400 border border-amber-500/30"
                }`}
              >
                {isSaved ? "Saved" : "Unsaved edits"}
              </span>

              {currentFile && (
                <span className="text-[11px] font-medium text-zinc-400 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                  {pages.length} {pages.length === 1 ? "Page" : "Pages"}
                </span>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 mt-0.5">
              Click any text block on the PDF &rarr; Edit in popup box &rarr; Apply &rarr; Export PDF
            </p>
          </div>
        </div>

        {/* Top Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoadingPdf}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700/90 text-zinc-200 text-xs font-bold px-3.5 py-2 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            <FolderOpen className="w-4 h-4 text-[#1DB954]" />
            <span>{currentFile ? "Replace PDF" : "Upload File"}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => e.target.files && e.target.files[0] && handleLoadPdfFile(e.target.files[0])}
            className="hidden"
          />

          {currentFile && (
            <button
              onClick={() => handleLoadPdfFile(currentFile)}
              disabled={isDetecting || isLoadingPdf}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700/90 text-zinc-200 text-xs font-bold px-3 py-2 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer disabled:opacity-50"
              title="Re-scan all PDF text"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isDetecting ? "animate-spin" : ""}`} />
              <span>{isDetecting ? "Scanning..." : "Re-Scan"}</span>
            </button>
          )}

          <button
            onClick={handleExportOrganizedPdf}
            disabled={isExporting || isLoadingPdf || !currentFile}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2 rounded-full transition-all shadow-[0_0_15px_rgba(29,185,84,0.3)] disabled:opacity-50 cursor-pointer"
          >
            <Download className={`w-4 h-4 stroke-[2.5] ${isExporting ? "animate-spin" : ""}`} />
            <span>{isExporting ? "EXPORTING PDF..." : "EXPORT PDF"}</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div className="bg-[#18181b] border border-zinc-800/90 rounded-lg px-3.5 py-2 flex items-center justify-between text-xs text-zinc-300 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1DB954] shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE 3-COLUMN STAGE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-[720px]">
        {/* LEFT PANEL: PAGES NAVIGATION (3 Cols) */}
        <div className="lg:col-span-3 bg-[#181818] p-3.5 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl h-[720px]">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#1DB954]" />
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Pages ({pages.length})
              </span>
            </div>
          </div>

          {/* Page Cards List */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
            {pages.map((p, idx) => {
              const isActive = activePageIndex === idx;
              const pageTexts = textElements.filter((el) => el.page === p.pageNumber);
              const pageHdgs = headings.filter((h) => h.page === p.pageNumber);

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    soundEffects.playClick();
                    setActivePageIndex(idx);
                    setSelectedElement(null);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 relative ${
                    isActive
                      ? "bg-zinc-800/90 border-[#1DB954] shadow-[0_0_12px_rgba(29,185,84,0.15)] ring-1 ring-[#1DB954]"
                      : "bg-zinc-900/90 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700"
                  }`}
                >
                  <div className="w-12 h-16 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0 relative shadow">
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={`Page ${p.pageNumber}`} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-5 h-5 text-zinc-600" />
                    )}
                    <span className="absolute bottom-0.5 right-0.5 text-[9px] font-extrabold bg-black/80 text-zinc-300 px-1 rounded">
                      {p.pageNumber}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-200">Page {p.pageNumber}</span>
                      {isActive && <span className="w-2 h-2 rounded-full bg-[#1DB954] shadow-[0_0_6px_#1DB954]" />}
                    </div>

                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-600/30">
                        {pageTexts.length} text {pageTexts.length === 1 ? "block" : "blocks"}
                      </span>
                      {pageHdgs.length > 0 && (
                        <span className="text-[10px] text-zinc-400 truncate max-w-[90px]">
                          {pageHdgs[0].text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER PANEL: PDF PREVIEW + SIMPLE CLICK-TO-SELECT OVERLAY (6 Cols) */}
        <div className="lg:col-span-6 flex flex-col items-center justify-between bg-[#09090b] rounded-2xl border border-zinc-900/80 shadow-2xl h-[720px] p-4 relative overflow-hidden">
          {/* Top Page Navigator Bar & Zoom */}
          <div className="w-full flex items-center justify-between bg-zinc-900/90 backdrop-blur px-4 py-2 rounded-xl border border-zinc-800/80 text-xs z-10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActivePageIndex((p) => Math.max(0, p - 1));
                  setSelectedElement(null);
                }}
                disabled={activePageIndex === 0}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 cursor-pointer"
              >
                &larr; Prev
              </button>
              <span className="font-bold text-zinc-200">
                Page {activePageIndex + 1} of {pages.length}
              </span>
              <button
                onClick={() => {
                  setActivePageIndex((p) => Math.min(pages.length - 1, p + 1));
                  setSelectedElement(null);
                }}
                disabled={activePageIndex === pages.length - 1}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 cursor-pointer"
              >
                Next &rarr;
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-zinc-300 px-2 min-w-[40px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* PDF Page Canvas & Simple Selection Layer */}
          <div
            className="flex-1 w-full overflow-auto flex items-center justify-center p-2 custom-scrollbar relative"
            onClick={(e) => {
              // Click outside closes edit box
              if (e.target === e.currentTarget) {
                setSelectedElement(null);
              }
            }}
          >
            {isLoadingPdf ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-bold text-zinc-300">Loading Document Preview...</span>
              </div>
            ) : isImportedPdfMode ? (
              <div className="relative shadow-[0_15px_50px_rgba(0,0,0,0.7)] border border-zinc-700/50 rounded bg-white">
                {/* 1. Underlying Crisp PDF Canvas */}
                <canvas ref={pdfCanvasRef} className="block max-w-full h-auto pointer-events-none" />

                {/* 2. Structured Transparent Click-Target Overlays */}
                {currentPageTextElements.map((el) => {
                  const isSelected = selectedElement?.id === el.id;
                  const isEdited = Boolean(el.isEdited && el.text !== el.originalText);
                  const isHovered = hoveredElementId === el.id;

                  const b = el.bbox || [50, 100, 400, 130];
                  const left = b[0] * scale;
                  const top = b[1] * scale;
                  const width = Math.max(40, (b[2] - b[0]) * scale);
                  const height = Math.max(16, (b[3] - b[1]) * scale);
                  const renderedFontSize = Math.max(10, el.fontSize * scale);

                  return (
                    <div
                      key={el.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTextBlock(el);
                      }}
                      onMouseEnter={() => setHoveredElementId(el.id)}
                      onMouseLeave={() => setHoveredElementId(null)}
                      style={{
                        position: "absolute",
                        left: `${left}px`,
                        top: `${top}px`,
                        minWidth: `${width}px`,
                        minHeight: `${height}px`,
                        maxWidth: `${Math.max(width, pdfPageViewport.width - left - 15)}px`,
                        fontSize: `${renderedFontSize}px`,
                        fontWeight: el.isBold || el.level === "Title" || el.level === "H1" ? "bold" : "normal",
                        lineHeight: 1.25,
                        // If modified, solid white cover with updated text; if unmodified, 100% transparent click target
                        backgroundColor: isEdited ? "#ffffff" : isSelected ? "rgba(29, 185, 84, 0.12)" : "transparent",
                        color: isEdited ? (el.color || "#111827") : "transparent",
                        outline: isSelected
                          ? "2px solid #1DB954"
                          : isHovered
                          ? "1.5px dashed rgba(29, 185, 84, 0.8)"
                          : "none",
                        boxShadow: isSelected ? "0 0 10px rgba(29,185,84,0.3)" : "none",
                        borderRadius: "2px",
                        padding: "1px 2px",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        cursor: "pointer",
                        zIndex: isSelected ? 30 : isEdited ? 20 : 10,
                      }}
                      title="Click to edit this text"
                    >
                      {isEdited ? el.text : null}
                    </div>
                  );
                })}

                {/* 3. Sleek Floating Edit Box Popover (Small, Fast, Reliable) */}
                {selectedElement && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      left: `${Math.max(10, Math.min(pdfPageViewport.width - 340, (selectedElement.bbox?.[0] || 50) * scale))}px`,
                      top: `${Math.min(pdfPageViewport.height - 170, Math.max(10, (selectedElement.bbox?.[3] || 100) * scale + 8))}px`,
                      zIndex: 100,
                    }}
                    className="w-80 bg-[#18181b] border-2 border-[#1DB954] rounded-xl p-3 shadow-2xl flex flex-col gap-2.5 animate-scaleUp text-white select-text"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Edit2 className="w-3.5 h-3.5 text-[#1DB954]" />
                        <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                          Edit {selectedElement.level !== "body" ? selectedElement.level : "Text"}
                        </span>
                      </div>
                      <button
                        onClick={handleCancelEdit}
                        className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="Cancel (Esc)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Pre-filled Text Input */}
                    {editDraftText.length > 60 || editDraftText.includes("\n") ? (
                      <textarea
                        ref={editInputRef as any}
                        value={editDraftText}
                        onChange={(e) => setEditDraftText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            handleApplyTextEdit();
                          }
                          if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                        rows={3}
                        className="w-full bg-zinc-900 text-xs font-medium text-zinc-100 p-2 rounded-lg border border-zinc-700 focus:border-[#1DB954] focus:outline-none resize-none leading-relaxed"
                        placeholder="Type replacement text..."
                      />
                    ) : (
                      <input
                        ref={editInputRef as any}
                        type="text"
                        value={editDraftText}
                        onChange={(e) => setEditDraftText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleApplyTextEdit();
                          }
                          if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                        className="w-full bg-zinc-900 text-xs font-medium text-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:border-[#1DB954] focus:outline-none"
                        placeholder="Type replacement text..."
                      />
                    )}

                    {/* Popover Action Buttons */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-zinc-400">
                        {editDraftText.includes("\n") ? "Ctrl+Enter to Apply" : "Enter to Apply"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleCancelEdit}
                          className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleApplyTextEdit}
                          className="flex items-center gap-1 px-3 py-1 rounded-md bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-extrabold transition-all cursor-pointer shadow-sm"
                        >
                          <span>Apply</span>
                          <CornerDownLeft className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Bottom Upload helper if no file loaded */}
          {!currentFile && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-full p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                isDragOver ? "border-[#1DB954] bg-[#1DB954]/10" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
              }`}
            >
              <UploadCloud className="w-6 h-6 text-[#1DB954]" />
              <div className="text-center">
                <span className="text-xs font-bold text-zinc-200">Click to select or Drag & Drop any PDF</span>
                <p className="text-[11px] text-zinc-500">Click any text block on the PDF &rarr; Edit in popup box &rarr; Apply</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: REAL-TIME OUTLINE TREE (Headings Only) (3 Cols) */}
        <div className="lg:col-span-3 bg-[#181818] p-3.5 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl h-[720px]">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-1.5">
              <ListTree className="w-4 h-4 text-[#1DB954]" />
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Document Outline ({headings.length})
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 custom-scrollbar">
            {headings.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-500 gap-2">
                <ListTree className="w-8 h-8 stroke-1 text-zinc-600" />
                <span className="text-xs font-semibold">No outline bookmarks</span>
                <p className="text-[11px] text-zinc-600">Headings detected in the PDF will appear here.</p>
              </div>
            ) : (
              headings.map((h) => {
                const isSelected = selectedElement?.id === h.id || hoveredElementId === h.id;

                const indentClass =
                  h.level === "Title"
                    ? "pl-2"
                    : h.level === "H1"
                    ? "pl-2 font-bold"
                    : h.level === "H2"
                    ? "pl-5 font-semibold text-zinc-300"
                    : "pl-8 text-zinc-400";

                const badgeColor =
                  h.level === "Title"
                    ? "bg-amber-950 text-amber-400 border-amber-600/30"
                    : h.level === "H1"
                    ? "bg-emerald-950 text-emerald-400 border-emerald-600/30"
                    : h.level === "H2"
                    ? "bg-blue-950 text-blue-400 border-blue-600/30"
                    : "bg-purple-950 text-purple-400 border-purple-600/30";

                return (
                  <div
                    key={h.id}
                    onClick={() => handleJumpToHeading(h)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${indentClass} ${
                      isSelected
                        ? "bg-zinc-800/90 border-[#1DB954] shadow"
                        : "bg-zinc-900/80 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${badgeColor}`}>
                        {h.level}
                      </span>
                      <span className="text-xs truncate text-zinc-100">{h.text}</span>
                    </div>

                    <span className="text-[10px] font-medium text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 shrink-0">
                      p. {h.page}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
