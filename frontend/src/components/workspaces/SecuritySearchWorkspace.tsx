import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  FileText,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Download,
  UploadCloud,
  Layers,
  ArrowRight,
  Check,
  X,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Edit3,
  History,
  ListOrdered,
  Type,
  FolderDown,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { PDFFileItem } from "../../types";
import { downloadPdfBytes, fileToArrayBuffer, imagesToPDF } from "../../lib/pdfEngine";
import { apiProtectPdf, apiRecordDownload, UserProfile } from "../../lib/api";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface SecuritySearchWorkspaceProps {
  mode: "protect" | "search-pdf";
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onSaveToGoogleDrive?: (filename: string, bytes: Uint8Array) => Promise<void>;
  onDownloadRecorded?: () => void;
}

export interface SearchMatch {
  id: string;
  pageIndex: number;
  text: string;
  snippet: string;
  x: number; // in PDF points
  y: number; // in PDF points
  width: number;
  height: number;
  fontSize: number;
}

export interface EditAction {
  id: string;
  matchId: string;
  pageIndex: number;
  originalText: string;
  replacementText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  timestamp: number;
}

export const SecuritySearchWorkspace: React.FC<SecuritySearchWorkspaceProps> = ({
  mode,
  activeFile,
  user,
  onOpenFilePicker,
  onSaveToCloud,
  onSaveToGoogleDrive,
  onDownloadRecorded,
}) => {
  // Password State (Protect mode)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Edit State (Search mode)
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);
  const [sidebarTab, setSidebarTab] = useState<"results" | "history">("results");

  // Undo / Redo Queue
  const [editQueue, setEditQueue] = useState<EditAction[]>([]);
  const [redoQueue, setRedoQueue] = useState<EditAction[]>([]);

  // Page Viewer & Canvas State
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [pageViewport, setPageViewport] = useState<{ width: number; height: number; scale: number }>({
    width: 595,
    height: 842,
    scale: 1,
  });

  // Cached PDF buffer & pdfDoc
  const [pdfBytesBuffer, setPdfBytesBuffer] = useState<Uint8Array | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavedToCloudState, setIsSavedToCloudState] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // 1. Initialize PDF Buffer (handles PDF & Image conversions)
  useEffect(() => {
    let isCancelled = false;
    const loadDocument = async () => {
      if (!activeFile) {
        setPdfBytesBuffer(null);
        setMatches([]);
        setEditQueue([]);
        setRedoQueue([]);
        return;
      }

      try {
        let buffer: Uint8Array;
        const fileName = activeFile.name.toLowerCase();
        const isPdf = activeFile.file.type === "application/pdf" || fileName.endsWith(".pdf");

        if (isPdf) {
          const ab = await fileToArrayBuffer(activeFile.file);
          buffer = new Uint8Array(ab);
        } else {
          // Convert image file into PDF in memory
          const converted = await imagesToPDF([activeFile.file]);
          buffer = converted;
        }

        if (isCancelled) return;
        setPdfBytesBuffer(buffer);
        setEditQueue([]);
        setRedoQueue([]);
        setMatches([]);
        setCurrentMatchIndex(-1);
        setCurrentPageIndex(0);

        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdfDoc = await loadingTask.promise;
        if (!isCancelled) {
          setTotalPages(pdfDoc.numPages);
        }
      } catch (err: any) {
        console.error("Failed to load PDF document:", err);
      }
    };

    loadDocument();
    return () => {
      isCancelled = true;
    };
  }, [activeFile]);

  // 2. Perform Search across all pages
  const handleSearch = useCallback(async () => {
    if (!pdfBytesBuffer || !searchQuery.trim()) return;
    soundEffects.playClick();
    setIsSearching(true);
    setErrorMsg(null);

    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytesBuffer });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      setTotalPages(numPages);

      const foundMatches: SearchMatch[] = [];
      const query = matchCase ? searchQuery : searchQuery.toLowerCase();

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        for (let itemIdx = 0; itemIdx < textContent.items.length; itemIdx++) {
          const item: any = textContent.items[itemIdx];
          if (!item.str || typeof item.str !== "string") continue;

          const itemStr = matchCase ? item.str : item.str.toLowerCase();
          let searchIdx = 0;

          while (searchIdx < itemStr.length) {
            let foundIdx = itemStr.indexOf(query, searchIdx);
            if (foundIdx === -1) break;

            // Check whole word boundary if requested
            if (matchWholeWord) {
              const prevChar = foundIdx > 0 ? itemStr[foundIdx - 1] : " ";
              const nextChar = foundIdx + query.length < itemStr.length ? itemStr[foundIdx + query.length] : " ";
              const isWordBoundary = /\W/.test(prevChar) && /\W/.test(nextChar);
              if (!isWordBoundary) {
                searchIdx = foundIdx + 1;
                continue;
              }
            }

            // Extract position from transform [scaleX, skewY, skewX, scaleY, transX, transY]
            const transform = item.transform || [12, 0, 0, 12, 0, 0];
            const fontSize = Math.abs(transform[0]) || Math.abs(transform[3]) || 12;
            const transX = transform[4] || 0;
            const transY = transform[5] || 0;

            const totalItemWidth = item.width || (item.str.length * fontSize * 0.55);
            const totalItemHeight = item.height || fontSize;

            const fractionStart = foundIdx / Math.max(item.str.length, 1);
            const fractionLen = query.length / Math.max(item.str.length, 1);

            const matchX = transX + fractionStart * totalItemWidth;
            const matchY = transY;
            const matchWidth = Math.max(fractionLen * totalItemWidth, 6);
            const matchHeight = Math.max(totalItemHeight, fontSize);

            // Context Snippet
            const snipStart = Math.max(0, foundIdx - 25);
            const snipEnd = Math.min(item.str.length, foundIdx + query.length + 30);
            const snippet = (snipStart > 0 ? "..." : "") + item.str.substring(snipStart, snipEnd) + (snipEnd < item.str.length ? "..." : "");

            foundMatches.push({
              id: `match-p${pageNum}-i${itemIdx}-${foundIdx}`,
              pageIndex: pageNum - 1,
              text: item.str.substring(foundIdx, foundIdx + query.length),
              snippet,
              x: matchX,
              y: matchY,
              width: matchWidth,
              height: matchHeight,
              fontSize,
            });

            searchIdx = foundIdx + query.length;
          }
        }
      }

      setMatches(foundMatches);
      if (foundMatches.length > 0) {
        setCurrentMatchIndex(0);
        setCurrentPageIndex(foundMatches[0].pageIndex);
        soundEffects.playSuccess();
      } else {
        setCurrentMatchIndex(-1);
      }
    } catch (err: any) {
      console.error("Search failed:", err);
      setErrorMsg("Failed to search inside document.");
    } finally {
      setIsSearching(false);
    }
  }, [pdfBytesBuffer, searchQuery, matchCase, matchWholeWord]);

  // Navigate to specific match
  const handleJumpToMatch = (idx: number) => {
    if (idx < 0 || idx >= matches.length) return;
    soundEffects.playClick();
    setCurrentMatchIndex(idx);
    setCurrentPageIndex(matches[idx].pageIndex);
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const next = (currentMatchIndex + 1) % matches.length;
    handleJumpToMatch(next);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prev = (currentMatchIndex - 1 + matches.length) % matches.length;
    handleJumpToMatch(prev);
  };

  // 3. EDIT / REPLACE Functionality
  const handleReplaceCurrent = () => {
    if (currentMatchIndex < 0 || currentMatchIndex >= matches.length) return;
    const targetMatch = matches[currentMatchIndex];

    const action: EditAction = {
      id: `edit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      matchId: targetMatch.id,
      pageIndex: targetMatch.pageIndex,
      originalText: targetMatch.text,
      replacementText: replaceText,
      x: targetMatch.x,
      y: targetMatch.y,
      width: targetMatch.width,
      height: targetMatch.height,
      fontSize: targetMatch.fontSize,
      timestamp: Date.now(),
    };

    soundEffects.playSuccess();
    setEditQueue((prev) => [...prev, action]);
    setRedoQueue([]); // clear redo stack on new action

    // Remove the replaced match from active matches list
    const updatedMatches = matches.filter((_, i) => i !== currentMatchIndex);
    setMatches(updatedMatches);
    if (updatedMatches.length > 0) {
      const nextIdx = Math.min(currentMatchIndex, updatedMatches.length - 1);
      setCurrentMatchIndex(nextIdx);
      setCurrentPageIndex(updatedMatches[nextIdx].pageIndex);
    } else {
      setCurrentMatchIndex(-1);
    }
  };

  const handleReplaceAll = () => {
    if (matches.length === 0) return;

    soundEffects.playSuccess();
    const newActions: EditAction[] = matches.map((m) => ({
      id: `edit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      matchId: m.id,
      pageIndex: m.pageIndex,
      originalText: m.text,
      replacementText: replaceText,
      x: m.x,
      y: m.y,
      width: m.width,
      height: m.height,
      fontSize: m.fontSize,
      timestamp: Date.now(),
    }));

    setEditQueue((prev) => [...prev, ...newActions]);
    setRedoQueue([]);
    setMatches([]);
    setCurrentMatchIndex(-1);
  };

  // 4. UNDO / REDO in sequential Queue order
  const handleUndoLatest = () => {
    if (editQueue.length === 0) return;
    soundEffects.playClick();

    const lastAction = editQueue[editQueue.length - 1];
    setEditQueue((prev) => prev.slice(0, -1));
    setRedoQueue((prev) => [...prev, lastAction]);
    setCurrentPageIndex(lastAction.pageIndex);
  };

  const handleUndoSpecific = (actionId: string) => {
    const targetIdx = editQueue.findIndex((a) => a.id === actionId);
    if (targetIdx === -1) return;

    soundEffects.playClick();
    const action = editQueue[targetIdx];
    setEditQueue((prev) => prev.filter((a) => a.id !== actionId));
    setRedoQueue((prev) => [...prev, action]);
    setCurrentPageIndex(action.pageIndex);
  };

  const handleRedo = () => {
    if (redoQueue.length === 0) return;
    soundEffects.playClick();

    const lastRedo = redoQueue[redoQueue.length - 1];
    setRedoQueue((prev) => prev.slice(0, -1));
    setEditQueue((prev) => [...prev, lastRedo]);
    setCurrentPageIndex(lastRedo.pageIndex);
  };

  const handleUndoAll = () => {
    if (editQueue.length === 0) return;
    soundEffects.playClick();
    setRedoQueue((prev) => [...prev, ...[...editQueue].reverse()]);
    setEditQueue([]);
  };

  // 5. Render Page onto Canvas with edits & search highlights
  useEffect(() => {
    let isCancelled = false;

    const renderPdfCanvas = async () => {
      if (!pdfBytesBuffer) return;

      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytesBuffer });
        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        setTotalPages(pdfDoc.numPages);
        const page = await pdfDoc.getPage(currentPageIndex + 1);
        if (isCancelled) return;

        const baseWidth = Math.min(window.innerWidth - 420, 680);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = (baseWidth / unscaledViewport.width) * zoomScale;
        const viewport = page.getViewport({ scale });

        setPageViewport({ width: unscaledViewport.width, height: unscaledViewport.height, scale });

        const canvas = canvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!canvas || !overlayCanvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        overlayCanvas.width = viewport.width;
        overlayCanvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        const overlayCtx = overlayCanvas.getContext("2d");
        if (!ctx || !overlayCtx) return;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch { }
        }

        const renderContext: any = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        if (isCancelled) return;

        // Clear overlay
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        // A. Draw Edits on Current Page (Mask original text & draw replacement)
        const pageEdits = editQueue.filter((e) => e.pageIndex === currentPageIndex);
        for (const edit of pageEdits) {
          // Convert PDF points to canvas coordinates
          // PDF points: (0,0) at bottom-left, Canvas: (0,0) at top-left
          const canvasX = edit.x * scale;
          const canvasY = (unscaledViewport.height - edit.y - edit.height) * scale;
          const canvasW = Math.max(edit.width * scale, 12);
          const canvasH = Math.max(edit.height * scale, 14);

          // Draw whiteout background box
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(canvasX - 1, canvasY - 1, canvasW + 2, canvasH + 2);

          // Draw replacement text
          if (edit.replacementText) {
            ctx.fillStyle = "#000000";
            const fontPx = Math.max(Math.round(edit.fontSize * scale), 10);
            ctx.font = `${fontPx}px sans-serif`;
            ctx.textBaseline = "top";
            ctx.fillText(edit.replacementText, canvasX, canvasY);
          }

          // Subtle dashed outline indicating replaced zone
          overlayCtx.strokeStyle = "#1DB954";
          overlayCtx.lineWidth = 1.5;
          overlayCtx.setLineDash([3, 3]);
          overlayCtx.strokeRect(canvasX - 1, canvasY - 1, canvasW + 2, canvasH + 2);
          overlayCtx.setLineDash([]);
        }

        // B. Draw Search Highlight Overlays on Current Page
        const pageMatches = matches.filter((m) => m.pageIndex === currentPageIndex);
        for (let i = 0; i < pageMatches.length; i++) {
          const match = pageMatches[i];
          const isCurrentMatch = matches[currentMatchIndex]?.id === match.id;

          const canvasX = match.x * scale;
          const canvasY = (unscaledViewport.height - match.y - match.height) * scale;
          const canvasW = Math.max(match.width * scale, 8);
          const canvasH = Math.max(match.height * scale, 12);

          if (isCurrentMatch) {
            // Active current match: Vibrant glowing green
            overlayCtx.fillStyle = "rgba(29, 185, 84, 0.45)";
            overlayCtx.fillRect(canvasX - 2, canvasY - 2, canvasW + 4, canvasH + 4);
            overlayCtx.strokeStyle = "#1DB954";
            overlayCtx.lineWidth = 2;
            overlayCtx.strokeRect(canvasX - 2, canvasY - 2, canvasW + 4, canvasH + 4);
          } else {
            // Inactive match: Golden amber highlight
            overlayCtx.fillStyle = "rgba(234, 179, 8, 0.35)";
            overlayCtx.fillRect(canvasX, canvasY, canvasW, canvasH);
            overlayCtx.strokeStyle = "rgba(234, 179, 8, 0.8)";
            overlayCtx.lineWidth = 1;
            overlayCtx.strokeRect(canvasX, canvasY, canvasW, canvasH);
          }
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Canvas render error:", err);
        }
      }
    };

    renderPdfCanvas();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch { }
      }
    };
  }, [pdfBytesBuffer, currentPageIndex, zoomScale, matches, currentMatchIndex, editQueue]);

  // 6. Generate Modified PDF Bytes using pdf-lib
  const generateEditedPdfBytes = async (): Promise<Uint8Array> => {
    if (!pdfBytesBuffer) throw new Error("No PDF loaded.");

    const pdfDoc = await PDFDocument.load(pdfBytesBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const edit of editQueue) {
      if (edit.pageIndex >= 0 && edit.pageIndex < pages.length) {
        const page = pages[edit.pageIndex];

        // 1. Cover original text with white rectangle
        page.drawRectangle({
          x: edit.x - 1,
          y: edit.y - 1,
          width: Math.max(edit.width + 2, 8),
          height: Math.max(edit.height + 2, 10),
          color: rgb(1, 1, 1),
        });

        // 2. Draw replacement text
        if (edit.replacementText && edit.replacementText.trim()) {
          page.drawText(edit.replacementText, {
            x: edit.x,
            y: edit.y,
            size: Math.max(8, edit.fontSize || 11),
            font,
            color: rgb(0, 0, 0),
          });
        }
      }
    }

    return await pdfDoc.save();
  };

  // 7. EXPORT & DOWNLOAD
  const handleDownload = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsExporting(true);
    try {
      const outputBytes = await generateEditedPdfBytes();
      const filename = `Edited_${activeFile.name.replace(/\.[^/.]+$/, "")}.pdf`;
      downloadPdfBytes(outputBytes, filename);
      soundEffects.playSuccess();

      // Record download
      if (user) {
        apiRecordDownload(filename, outputBytes.byteLength);
      } else {
        recordDownloadedDoc(filename, outputBytes.byteLength, totalPages, "Search & Edit PDF");
      }
      onDownloadRecorded?.();
    } catch (err: any) {
      alert(`Export failed: ${err.message || "Could not generate PDF"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveCloud = async () => {
    if (!activeFile || !user) return;
    soundEffects.playClick();
    setIsExporting(true);
    try {
      const outputBytes = await generateEditedPdfBytes();
      const filename = `Edited_${activeFile.name.replace(/\.[^/.]+$/, "")}.pdf`;
      onSaveToCloud?.(outputBytes, filename, "Search & Edit PDF");
      setIsSavedToCloudState(true);
      soundEffects.playSuccess();
      setTimeout(() => setIsSavedToCloudState(false), 3000);
    } catch (err: any) {
      alert(`Failed to save to cloud: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveDrive = async () => {
    if (!activeFile || !onSaveToGoogleDrive) return;
    soundEffects.playClick();
    setIsExporting(true);
    try {
      const outputBytes = await generateEditedPdfBytes();
      const filename = `Edited_${activeFile.name.replace(/\.[^/.]+$/, "")}.pdf`;
      await onSaveToGoogleDrive(filename, outputBytes);
      soundEffects.playSuccess();
    } catch (err: any) {
      alert(`Google Drive save failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // 8. PROTECT PDF (Password Encryption)
  const handleProtectPdf = async () => {
    if (!activeFile) return;
    if (!password || !password.trim()) {
      setErrorMsg("Please enter a password.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }

    soundEffects.playClick();
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const protectedBytes = await apiProtectPdf(activeFile.file, password);
      soundEffects.playSuccess();
      setSuccessMsg("PDF protected successfully.");
      downloadPdfBytes(protectedBytes, `Protected_${activeFile.name}`);

      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to protect PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard shortcut support (Ctrl+Z for Undo, Ctrl+Y for Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndoLatest();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editQueue, redoQueue]);

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto p-2 font-sans text-white">
      {/* Top Banner & Mode Info */}
      <div className="bg-[#18181b] p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/30">
            {mode === "protect" ? <Lock className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              {mode === "protect" ? "Password Protect PDF Security" : "Search & Replace Within PDF"}
              {editQueue.length > 0 && (
                <span className="bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {editQueue.length} {editQueue.length === 1 ? "edit applied" : "edits applied"}
                </span>
              )}
            </h2>
            <p className="text-xs text-zinc-400">
              Active File: <span className="text-zinc-200 font-medium">{activeFile?.name || "None Selected"}</span>
            </p>
          </div>
        </div>

        {!activeFile ? (
          <button
            onClick={onOpenFilePicker}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-lg transition-all cursor-pointer shadow-md"
          >
            <span>SELECT PDF FILE</span>
          </button>
        ) : (
          mode === "search-pdf" && (
            <div className="flex items-center gap-2">
              {/* Undo Button */}
              <button
                onClick={handleUndoLatest}
                disabled={editQueue.length === 0}
                className="flex items-center gap-1.5 bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                title="Undo latest edit (Ctrl+Z)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
                {editQueue.length > 0 && (
                  <span className="bg-zinc-800 text-zinc-400 text-[10px] px-1.5 py-0.2 rounded">
                    {editQueue.length}
                  </span>
                )}
              </button>

              {/* Redo Button */}
              <button
                onClick={handleRedo}
                disabled={redoQueue.length === 0}
                className="flex items-center gap-1.5 bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                title="Redo (Ctrl+Y)"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Redo</span>
              </button>

              {/* Export / Download */}
              <button
                onClick={handleDownload}
                disabled={isExporting}
                className="flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-extrabold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer shadow-md"
              >
                {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 stroke-[2.5]" />}
                <span>Download PDF</span>
              </button>

              {user && (
                <button
                  onClick={handleSaveCloud}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-zinc-200 text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                  title="Save to My Documents"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-[#1DB954]" />
                  <span>{isSavedToCloudState ? "Saved!" : "Save Cloud"}</span>
                </button>
              )}
            </div>
          )
        )}
      </div>

      {activeFile && mode === "protect" && (
        /* PROTECT MODE */
        <div className="bg-[#18181b] p-6 rounded-xl border border-zinc-800 flex flex-col gap-4 max-w-md mx-auto w-full shadow-xl">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-bold text-zinc-300">Set PDF Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-zinc-900 text-white p-3 pr-10 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-bold text-zinc-300">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-zinc-900 text-white p-3 pr-10 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer p-1"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleProtectPdf}
            disabled={isProcessing}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-60 text-black font-extrabold text-xs py-3 rounded-lg transition-all cursor-pointer shadow-lg"
          >
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin text-black" /> : <Lock className="w-4 h-4 stroke-[2.5]" />}
            <span>{isProcessing ? "Protecting PDF..." : "Protect PDF"}</span>
          </button>
        </div>
      )}

      {activeFile && mode === "search-pdf" && (
        /* SEARCH & EDIT PDF STUDIO */
        <div className="flex flex-col gap-3">
          {/* Controls Bar: Search & Replace Inputs */}
          <div className="bg-[#18181b] p-3.5 rounded-xl border border-zinc-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
            {/* Search Input Box */}
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Find text or word in document..."
                  className="w-full bg-zinc-900 text-white text-xs pl-9 pr-8 py-2 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setMatches([]);
                      setCurrentMatchIndex(-1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Case Sensitivity */}
              <button
                onClick={() => setMatchCase(!matchCase)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-mono font-bold border transition-colors cursor-pointer ${
                  matchCase
                    ? "bg-[#1DB954]/20 border-[#1DB954] text-[#1DB954]"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
                title="Match Case (Aa)"
              >
                Aa
              </button>

              {/* Whole Word */}
              <button
                onClick={() => setMatchWholeWord(!matchWholeWord)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-mono font-bold border transition-colors cursor-pointer ${
                  matchWholeWord
                    ? "bg-[#1DB954]/20 border-[#1DB954] text-[#1DB954]"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
                title="Match Whole Word (\b)"
              >
                \b
              </button>

              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-extrabold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Match Navigation Indicator */}
            {matches.length > 0 && (
              <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 shrink-0">
                <span className="text-xs text-zinc-400 font-medium">
                  Match <span className="text-[#1DB954] font-bold">{currentMatchIndex + 1}</span> of{" "}
                  <span className="text-white font-bold">{matches.length}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMatch}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
                    title="Previous match"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextMatch}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
                    title="Next match"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Replace Box */}
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Edit3 className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Replace with..."
                  className="w-full bg-zinc-900 text-white text-xs pl-9 pr-3 py-2 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
                />
              </div>

              <button
                onClick={handleReplaceCurrent}
                disabled={currentMatchIndex < 0 || matches.length === 0}
                className="bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-700 transition-colors cursor-pointer shrink-0"
              >
                Replace
              </button>

              <button
                onClick={handleReplaceAll}
                disabled={matches.length === 0}
                className="bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-40 disabled:cursor-not-allowed text-[#1DB954] text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-700 transition-colors cursor-pointer shrink-0"
              >
                Replace All ({matches.length})
              </button>
            </div>
          </div>

          {/* Main Stage: Canvas Page Viewer (Left) + Results/History Drawer (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[560px]">
            {/* Left 2 Cols: PDF Canvas Viewer */}
            <div className="lg:col-span-2 bg-[#141416] rounded-xl border border-zinc-800 p-4 flex flex-col items-center justify-between gap-4 overflow-hidden relative shadow-inner">
              {/* Top Canvas Toolbar */}
              <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-800/80 text-xs">
                {/* Page Switcher */}
                <div className="flex items-center gap-2 bg-[#1f1f23] px-3 py-1.5 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                    disabled={currentPageIndex === 0}
                    className="p-0.5 rounded hover:bg-zinc-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-zinc-300">
                    Page {currentPageIndex + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPageIndex >= totalPages - 1}
                    className="p-0.5 rounded hover:bg-zinc-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1.5 bg-[#1f1f23] px-2 py-1 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.15))}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-zinc-300 min-w-[36px] text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomScale((z) => Math.min(2.2, z + 0.15))}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomScale(1.0)}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold"
                    title="Reset Zoom"
                  >
                    100%
                  </button>
                </div>
              </div>

              {/* PDF Document Canvas Viewport */}
              <div className="flex-1 w-full flex items-center justify-center overflow-auto p-2 custom-scrollbar max-h-[620px]">
                <div className="relative shadow-2xl rounded border border-zinc-800 bg-white overflow-hidden">
                  <canvas ref={canvasRef} className="block" />
                  <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-none" />
                </div>
              </div>

              {/* Bottom Canvas Footer Info */}
              <div className="w-full flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/80">
                <span>Green outlines indicate replaced text. Yellow/green overlays indicate search hits.</span>
                <span>Shortcuts: Ctrl+Z (Undo), Ctrl+Y (Redo)</span>
              </div>
            </div>

            {/* Right 1 Col: Search Results & Undo History Drawer */}
            <div className="bg-[#18181b] rounded-xl border border-zinc-800 flex flex-col overflow-hidden shadow-lg">
              {/* Drawer Tabs */}
              <div className="flex items-center border-b border-zinc-800 bg-[#1f1f23]">
                <button
                  onClick={() => setSidebarTab("results")}
                  className={`flex-1 py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
                    sidebarTab === "results"
                      ? "border-[#1DB954] text-[#1DB954] bg-[#18181b]"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search Matches ({matches.length})</span>
                </button>

                <button
                  onClick={() => setSidebarTab("history")}
                  className={`flex-1 py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
                    sidebarTab === "history"
                      ? "border-[#1DB954] text-[#1DB954] bg-[#18181b]"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Edit Queue ({editQueue.length})</span>
                </button>
              </div>

              {/* Tab Content 1: Search Matches */}
              {sidebarTab === "results" && (
                <div className="flex-1 flex flex-col p-3 gap-2 overflow-y-auto max-h-[500px] custom-scrollbar">
                  {matches.length > 0 ? (
                    matches.map((match, idx) => {
                      const isSelected = currentMatchIndex === idx;
                      return (
                        <div
                          key={match.id}
                          onClick={() => handleJumpToMatch(idx)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 text-xs ${
                            isSelected
                              ? "bg-[#1DB954]/15 border-[#1DB954] text-white shadow-sm"
                              : "bg-zinc-900/90 border-zinc-800/80 text-zinc-300 hover:bg-zinc-850 hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded">
                              Page {match.pageIndex + 1}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">#{idx + 1}</span>
                          </div>
                          <p className="text-zinc-300 text-[11px] leading-relaxed italic font-mono mt-1">
                            {match.snippet}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-16 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                      <Search className="w-6 h-6 text-zinc-600" />
                      <span>
                        {searchQuery
                          ? `No matches found for "${searchQuery}".`
                          : "Type a keyword above and click Search."}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 2: Edit & Undo Queue in chronological sequence */}
              {sidebarTab === "history" && (
                <div className="flex-1 flex flex-col p-3 gap-2 overflow-y-auto max-h-[500px] custom-scrollbar">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <span className="text-xs font-bold text-zinc-400">Sequential Edit History</span>
                    {editQueue.length > 0 && (
                      <button
                        onClick={handleUndoAll}
                        className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        Reset All Edits
                      </button>
                    )}
                  </div>

                  {editQueue.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {[...editQueue].reverse().map((edit, revIdx) => {
                        const originalIdx = editQueue.length - revIdx;
                        return (
                          <div
                            key={edit.id}
                            className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                <span className="font-bold text-white bg-zinc-800 px-1.5 py-0.2 rounded">
                                  #{originalIdx}
                                </span>
                                <span>Page {edit.pageIndex + 1}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs truncate mt-0.5">
                                <span className="line-through text-rose-400/90 font-mono">
                                  {edit.originalText || "(empty)"}
                                </span>
                                <ArrowRight className="w-3 h-3 text-zinc-500 shrink-0" />
                                <span className="text-[#1DB954] font-bold font-mono">
                                  {edit.replacementText || '""'}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleUndoSpecific(edit.id)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/80 hover:text-rose-400 text-zinc-400 border border-zinc-700 transition-colors cursor-pointer shrink-0"
                              title="Undo this edit"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                      <History className="w-6 h-6 text-zinc-600" />
                      <span>No edits made yet. Replaced words will queue up here with undo support.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
