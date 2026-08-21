import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Upload,
  Download,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Eye,
  Code2,
  FileCode,
  Layers,
  FileSpreadsheet,
  Heading,
  X,
  FileUp,
  ArrowRight,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { soundEffects } from "../../lib/audio";
import { convertPdfToMarkdown, PdfMarkdownResult } from "../../lib/pdfToMarkdownEngine";
import { fileToArrayBuffer } from "../../lib/pdfEngine";
import { UserProfile, apiRecordDownload } from "../../lib/api";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface MarkdownWorkspaceProps {
  activeFile?: PDFFileItem | null;
  onOpenFilePicker?: () => void;
  onFileUpload?: (files: FileList | File[]) => Promise<void>;
  user?: UserProfile | null;
  onSaveToCloud?: (file: File, name: string) => Promise<void>;
  onDownloadRecorded?: () => void;
}

type WorkflowState = "EMPTY" | "UPLOADED" | "CONVERTING" | "CONVERTED";

export const MarkdownWorkspace: React.FC<MarkdownWorkspaceProps> = ({
  activeFile,
  onOpenFilePicker,
  onFileUpload,
  user,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  // State Machine: EMPTY -> UPLOADED -> CONVERTING -> CONVERTED
  const [workflowState, setWorkflowState] = useState<WorkflowState>("EMPTY");

  // Loaded PDF State
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<string>("");
  const [pageCount, setPageCount] = useState<number>(0);
  const [lastLoadedDocId, setLastLoadedDocId] = useState<string | null>(null);

  // Conversion Output & Progress
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [originalMarkdown, setOriginalMarkdown] = useState<string>("");
  const [isScannedPdf, setIsScannedPdf] = useState<boolean>(false);
  const [stats, setStats] = useState<{ headings: number; tables: number; words: number }>({
    headings: 0,
    tables: 0,
    words: 0,
  });

  // UI Controls
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"split" | "editor" | "preview">("split");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showReconvertConfirm, setShowReconvertConfirm] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Sync with Left Sidebar Active Document
  useEffect(() => {
    if (activeFile && activeFile.file) {
      const isPdf =
        activeFile.name.toLowerCase().endsWith(".pdf") ||
        (activeFile.file.type && activeFile.file.type.toLowerCase().includes("pdf"));

      if (!isPdf) {
        // Non-PDF active document selected
        setErrorMsg("Please select a PDF document.");
        setWorkflowState("EMPTY");
        setCurrentFile(null);
        return;
      }

      // If document changed or no document loaded yet
      if (activeFile.id !== lastLoadedDocId) {
        setLastLoadedDocId(activeFile.id);
        setCurrentFile(activeFile.file);
        setFileName(activeFile.name);
        setFileSize(
          activeFile.size > 0
            ? `${(activeFile.size / 1024).toFixed(1)} KB`
            : `${(activeFile.file.size / 1024).toFixed(1)} KB`
        );
        setPageCount(activeFile.pageCount || 1);
        setMarkdownContent("");
        setOriginalMarkdown("");
        setIsScannedPdf(false);
        setErrorMsg(null);
        // Automatically select the existing PDF and set state to UPLOADED (Do NOT auto-convert)
        setWorkflowState("UPLOADED");
      }
    } else if (!activeFile && !currentFile) {
      setWorkflowState("EMPTY");
      setLastLoadedDocId(null);
    }
  }, [activeFile]);

  // 2. Handle Direct File Selection / Upload
  const handleFileSelected = async (file: File) => {
    if (!file || (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf"))) {
      setErrorMsg("Please select a valid PDF file.");
      soundEffects.playClick();
      return;
    }

    try {
      setErrorMsg(null);
      soundEffects.playClick();

      // Read real page count
      const buffer = await fileToArrayBuffer(file);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const loadedDoc = await loadingTask.promise;
      const count = loadedDoc.numPages;

      setCurrentFile(file);
      setFileName(file.name);
      setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
      setPageCount(count);
      setMarkdownContent("");
      setOriginalMarkdown("");
      setIsScannedPdf(false);
      setLastLoadedDocId(null);

      // Transition to UPLOADED (Selected) state
      setWorkflowState("UPLOADED");

      // Also synchronize with the application active documents if handler exists
      if (onFileUpload) {
        onFileUpload([file]).catch(() => {});
      }
    } catch (err: any) {
      console.error("Error reading PDF metadata:", err);
      setErrorMsg("Unable to read PDF. The file may be password-protected or corrupted.");
      setWorkflowState("EMPTY");
    }
  };

  // 3. Process PDF -> Markdown (Triggered by [ Process PDF → Markdown ] button)
  const handleStartConversion = async () => {
    const fileToProcess = currentFile || activeFile?.file;
    if (!fileToProcess) {
      setErrorMsg("No PDF document selected to process.");
      return;
    }

    setWorkflowState("CONVERTING");
    setProgressMsg("Reading PDF document structure...");
    setErrorMsg(null);
    soundEffects.playClick();

    try {
      const result: PdfMarkdownResult = await convertPdfToMarkdown(fileToProcess, (p, total) => {
        setProgressMsg(`Processing page ${p} of ${total}...`);
      });

      if (result.error) {
        setErrorMsg(result.error);
        setWorkflowState("UPLOADED");
        return;
      }

      setPageCount(result.pageCount);
      setIsScannedPdf(result.isScanned);
      setMarkdownContent(result.markdown);
      setOriginalMarkdown(result.markdown);
      setStats({
        headings: result.headingsCount,
        tables: result.tablesCount,
        words: result.wordCount,
      });

      soundEffects.playSuccess();
      setWorkflowState("CONVERTED");
    } catch (err: any) {
      console.error("Conversion error:", err);
      setErrorMsg(err?.message || "Unable to convert PDF to Markdown.");
      setWorkflowState("UPLOADED");
    } finally {
      setProgressMsg("");
    }
  };

  // 4. Change PDF Action
  const handleChangePdf = () => {
    soundEffects.playClick();
    if (onOpenFilePicker) {
      onOpenFilePicker();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 5. Re-convert Handler
  const handleReconvertClick = () => {
    if (markdownContent !== originalMarkdown) {
      setShowReconvertConfirm(true);
    } else {
      handleStartConversion();
    }
  };

  const confirmReconvert = () => {
    setShowReconvertConfirm(false);
    handleStartConversion();
  };

  // 6. Copy Markdown
  const handleCopyMarkdown = () => {
    if (!markdownContent) return;
    soundEffects.playClick();
    navigator.clipboard.writeText(markdownContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // 7. Download .MD
  const handleDownloadMarkdown = async () => {
    if (!markdownContent || markdownContent.trim().length === 0) {
      setErrorMsg("Unable to download Markdown because the converted content is empty.");
      return;
    }

    soundEffects.playSuccess();

    // Clean output filename: test.pdf -> test.md
    const baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "document";
    const downloadName = `${baseName}.md`;

    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    recordDownloadedDoc(downloadName, blob.size, "PDF to Markdown");
    if (user) {
      apiRecordDownload(downloadName, "markdown", blob.size, "PDF to Markdown");
      if (onSaveToCloud) {
        const mdFile = new File([blob], downloadName, { type: "text/markdown" });
        await onSaveToCloud(mdFile, downloadName).catch(() => {});
      }
    }
    if (onDownloadRecorded) onDownloadRecorded();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className="flex flex-col gap-4 max-w-7xl mx-auto p-2 font-sans text-white select-none"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => e.target.files && e.target.files[0] && handleFileSelected(e.target.files[0])}
        className="hidden"
      />

      {/* Error Message Banner */}
      {errorMsg && (
        <div className="bg-rose-950/80 border border-rose-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-rose-200 shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reconvert Confirmation Modal */}
      {showReconvertConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-zinc-700 rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-950 border border-amber-600/40 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Discard Manual Edits?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Re-converting will replace your current Markdown changes with a fresh conversion from the original PDF.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowReconvertConfirm(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmReconvert}
                className="px-4 py-2 rounded-lg bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-extrabold cursor-pointer"
              >
                Re-convert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE 1: EMPTY — NO PDF SELECTED OR UPLOADED                              */}
      {/* ========================================================================= */}
      {workflowState === "EMPTY" && (
        <div className="flex flex-col items-center justify-center min-h-[540px] text-center gap-6 p-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-[#1DB954] text-black flex items-center justify-center font-bold shadow-lg shadow-emerald-950/40 mb-1">
              <FileCode className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">PDF &rarr; Markdown</h1>
            <p className="text-sm text-zinc-400 max-w-md">
              Convert your PDF into clean, structured, and editable Markdown
            </p>
          </div>

          <div
            onClick={handleChangePdf}
            className={`w-full max-w-xl py-16 px-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 cursor-pointer shadow-2xl ${
              isDragOver ? "border-[#1DB954] bg-[#1DB954]/10" : "border-zinc-800 hover:border-zinc-700 bg-[#121215]"
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954] shadow-inner">
              <FileUp className="w-8 h-8" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-zinc-100">Drop your PDF here</h3>
              <p className="text-xs text-zinc-500 mt-1">or</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleChangePdf();
              }}
              className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-full transition-all shadow-md cursor-pointer"
            >
              Select PDF
            </button>
            <span className="text-[11px] text-zinc-500 font-medium">PDF files only</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE 2: UPLOADED — PDF SELECTED, READY TO PROCESS                        */}
      {/* ========================================================================= */}
      {workflowState === "UPLOADED" && (
        <div className="flex flex-col items-center justify-center min-h-[500px] text-center gap-6 p-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-8 max-w-lg w-full flex flex-col items-center gap-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[#1DB954] shadow-inner">
              <FileText className="w-8 h-8" />
            </div>

            <div className="flex flex-col items-center gap-1.5 max-w-sm">
              <span className="text-xs font-bold text-[#1DB954] uppercase tracking-wider">PDF &rarr; Markdown</span>
              <h2 className="text-base font-extrabold text-white truncate max-w-xs">{fileName}</h2>
              <p className="text-xs text-zinc-400 font-medium">
                {pageCount} {pageCount === 1 ? "Page" : "Pages"} • {fileSize}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full justify-center pt-3 border-t border-zinc-800/80">
              <button
                onClick={handleChangePdf}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Change PDF
              </button>
              <button
                onClick={handleStartConversion}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(29,185,84,0.3)] cursor-pointer"
              >
                <span>Process PDF &rarr; Markdown</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE 2B: CONVERTING — PROGRESS SPINNER                                   */}
      {/* ========================================================================= */}
      {workflowState === "CONVERTING" && (
        <div className="bg-[#121215] rounded-2xl border border-zinc-800 p-16 flex flex-col items-center justify-center gap-4 text-center shadow-xl min-h-[460px]">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <div className="flex flex-col gap-1">
            <span className="text-base font-bold text-zinc-100">Converting PDF to Markdown...</span>
            <span className="text-xs text-emerald-400 font-medium">{progressMsg}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE 3: CONVERTED — RICH SPLIT-SCREEN MARKDOWN WORKSPACE                 */}
      {/* ========================================================================= */}
      {workflowState === "CONVERTED" && (
        <div className="flex flex-col gap-4">
          {/* Top Bar */}
          <div className="bg-[#121215] px-5 py-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#1DB954] text-black flex items-center justify-center font-bold shrink-0 shadow-lg shadow-emerald-950/40">
                <FileCode className="w-6 h-6 stroke-[2.5]" />
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-extrabold text-white truncate max-w-md">
                    PDF &rarr; Markdown
                  </h1>
                  <span className="text-[10px] font-bold bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-600/30 uppercase tracking-wider">
                    Converted
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5 flex-wrap">
                  <span className="font-semibold text-zinc-200 truncate max-w-[240px]">{fileName}</span>
                  <span>•</span>
                  <span>{pageCount} {pageCount === 1 ? "Page" : "Pages"}</span>
                  <span>•</span>
                  <span>{fileSize}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleChangePdf}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-3.5 py-2 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#1DB954]" />
                <span>Change PDF</span>
              </button>

              <button
                onClick={handleReconvertClick}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-3 py-2 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer"
                title="Re-convert PDF"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Re-convert</span>
              </button>

              <button
                onClick={handleDownloadMarkdown}
                disabled={!markdownContent || markdownContent.trim().length === 0}
                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2 rounded-full transition-all shadow-[0_0_15px_rgba(29,185,84,0.3)] disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>DOWNLOAD .MD</span>
              </button>
            </div>
          </div>

          {/* Scanned / Warning Banner */}
          {isScannedPdf && (
            <div className="bg-amber-950/70 border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-200 shadow-md">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold">Scanned / Image-Only Document:</span>
                  <p className="text-[11px] text-amber-300/90 mt-0.5">
                    This PDF appears to contain scanned/image-only pages. Text extraction requires OCR.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-bar: Stats & Layout Switcher */}
          <div className="bg-[#18181b] px-4 py-2 rounded-xl border border-zinc-800 flex items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                <Heading className="w-3.5 h-3.5 text-[#1DB954]" />
                <span>{stats.headings} Headings</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                <span>{stats.tables} {stats.tables === 1 ? "Table" : "Tables"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>{stats.words} Words</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Switcher Tabs */}
              <div className="bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 flex items-center">
                <button
                  onClick={() => setActiveTab("split")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === "split" ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Split View
                </button>
                <button
                  onClick={() => setActiveTab("editor")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === "editor" ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Editor Only
                </button>
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === "preview" ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Preview Only
                </button>
              </div>

              <button
                onClick={handleCopyMarkdown}
                className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg border border-zinc-700/60 font-semibold text-[11px] transition-colors cursor-pointer"
                title="Copy Markdown to Clipboard"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* SPLIT / SIDE-BY-SIDE EDITOR & PREVIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[650px]">
            {/* LEFT COLUMN: Monospace Markdown Source Editor */}
            {(activeTab === "split" || activeTab === "editor") && (
              <div
                className={`bg-[#121215] rounded-2xl border border-zinc-800 flex flex-col overflow-hidden shadow-xl ${
                  activeTab === "editor" ? "lg:col-span-2" : ""
                }`}
              >
                <div className="px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                    <Code2 className="w-4 h-4 text-[#1DB954]" />
                    <span>Markdown Source (Editable)</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {markdownContent.split("\n").length} lines
                  </span>
                </div>

                <textarea
                  value={markdownContent}
                  onChange={(e) => setMarkdownContent(e.target.value)}
                  className="flex-1 w-full bg-[#0d0d10] p-4 text-xs font-mono text-zinc-100 focus:outline-none resize-none leading-relaxed custom-scrollbar select-text selection:bg-[#1DB954]/30"
                  placeholder="Generated Markdown will appear here..."
                  spellCheck={false}
                />
              </div>
            )}

            {/* RIGHT COLUMN: Rendered Markdown Live Preview */}
            {(activeTab === "split" || activeTab === "preview") && (
              <div
                className={`bg-[#121215] rounded-2xl border border-zinc-800 flex flex-col overflow-hidden shadow-xl ${
                  activeTab === "preview" ? "lg:col-span-2" : ""
                }`}
              >
                <div className="px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                    <Eye className="w-4 h-4 text-[#1DB954]" />
                    <span>Live Rendered Preview</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    Live HTML / GFM
                  </span>
                </div>

                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar select-text bg-[#09090b]">
                  <RenderedMarkdown markdown={markdownContent} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Lightweight GitHub-flavored Markdown Preview Renderer
 */
const RenderedMarkdown: React.FC<{ markdown: string }> = ({ markdown }) => {
  if (!markdown || !markdown.trim()) {
    return (
      <div className="text-zinc-600 text-xs italic text-center py-12">
        No Markdown content to preview.
      </div>
    );
  }

  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = (key: number) => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1);
      elements.push(
        <div key={`table-${key}`} className="my-4 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse border border-zinc-800">
            <thead className="bg-zinc-900 text-zinc-200 font-bold">
              <tr>
                {header.map((col, cIdx) => (
                  <th key={cIdx} className="border border-zinc-800 p-2.5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-zinc-800/80 hover:bg-zinc-900/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="border border-zinc-800/80 p-2.5 text-zinc-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check Table Row
    if (line.startsWith("|") && line.endsWith("|")) {
      const cols = line
        .split("|")
        .map((c) => c.trim())
        .filter((c, idx, arr) => (idx > 0 && idx < arr.length - 1) || c.length > 0);

      // Skip separator row like | --- | --- |
      if (cols.every((c) => /^[-:]+$/.test(c))) {
        continue;
      }

      inTable = true;
      tableRows.push(cols);
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    if (!line) {
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-extrabold text-white mt-5 mb-3 border-b border-zinc-800 pb-2">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-xl font-bold text-white mt-4 mb-2 text-[#1DB954]">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-zinc-200 mt-3 mb-1.5">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold text-zinc-300 mt-2.5 mb-1">
          {line.slice(5)}
        </h4>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="text-xs text-zinc-300 ml-4 list-disc my-1 leading-relaxed">
          {formatInline(line.slice(2))}
        </li>
      );
    } else if (/^\d+\.\s+/.test(line)) {
      const content = line.replace(/^\d+\.\s+/, "");
      elements.push(
        <li key={i} className="text-xs text-zinc-300 ml-4 list-decimal my-1 leading-relaxed">
          {formatInline(content)}
        </li>
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-4 border-[#1DB954] pl-3 py-1 my-3 bg-zinc-900/50 rounded text-xs text-zinc-300 italic"
        >
          {formatInline(line.slice(2))}
        </blockquote>
      );
    } else if (line === "---") {
      elements.push(<hr key={i} className="border-zinc-800 my-4" />);
    } else {
      elements.push(
        <p key={i} className="text-xs text-zinc-300 my-2.5 leading-relaxed">
          {formatInline(line)}
        </p>
      );
    }
  }

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{elements}</div>;
};

/**
 * Handles basic markdown bold, italic, and links in rendered preview
 */
function formatInline(text: string): React.ReactNode {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const label = match[1];
    const url = match[2];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#1DB954] underline hover:text-[#1ed760]"
      >
        {label}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
