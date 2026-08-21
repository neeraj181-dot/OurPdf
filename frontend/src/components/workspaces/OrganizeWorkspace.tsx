import React, { useState, useEffect } from "react";
import {
  RotateCw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Grid,
  Copy,
  RefreshCw,
  Scissors,
  Download,
  CheckCircle2,
  FileText,
  Cloud,
  Check,
  HardDrive,
  RotateCcw,
  Layers,
} from "lucide-react";
import { PDFFileItem, PageOrderInfo } from "../../types";
import { soundEffects } from "../../lib/audio";
import { splitPDF, reorderAndRotatePages, downloadPdfBytes } from "../../lib/pdfEngine";
import { UserProfile, apiRecordDownload } from "../../lib/api";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface OrganizeWorkspaceProps {
  activeFile: PDFFileItem;
  onExport?: (pagesInfo: { originalIndex: number; rotation: number }[]) => void;
  isProcessing?: boolean;
  initialTab?: "organize" | "split" | "extract";
  user?: UserProfile | null;
  onSaveToCloud?: (bytes: Uint8Array, name: string) => Promise<void>;
  onSaveToGoogleDrive?: (bytes: Uint8Array, name: string) => Promise<void>;
  onDownloadRecorded?: () => void;
}

export const OrganizeWorkspace: React.FC<OrganizeWorkspaceProps> = ({
  activeFile,
  onExport,
  initialTab = "organize",
  user,
  onSaveToCloud,
  onSaveToGoogleDrive,
  onDownloadRecorded,
}) => {
  const [activeTab, setActiveTab] = useState<"organize" | "split" | "extract">(initialTab);
  const [pages, setPages] = useState<PageOrderInfo[]>([]);
  const [isProcessingInternal, setIsProcessingInternal] = useState(false);

  // Processed Output State (Organized PDF)
  const [processedBytes, setProcessedBytes] = useState<Uint8Array | null>(null);
  const [processedFileName, setProcessedFileName] = useState<string>("");
  const [isSavedCloud, setIsSavedCloud] = useState(false);
  const [isSavedDrive, setIsSavedDrive] = useState(false);

  // Split Mode State
  const [rangeInput, setRangeInput] = useState<string>("1, 2-3, 4-5");
  const [splitResults, setSplitResults] = useState<{ filename: string; bytes: Uint8Array }[]>([]);
  const [isSplitting, setIsSplitting] = useState(false);

  // Extract Mode State
  const [selectedPagesForExtract, setSelectedPagesForExtract] = useState<number[]>([]);

  useEffect(() => {
    if (activeFile) {
      const totalCount = activeFile.pagesCount || activeFile.pageThumbnails?.length || 1;
      const initial: PageOrderInfo[] = [];
      for (let idx = 0; idx < totalCount; idx++) {
        initial.push({
          id: `page-${idx}-${Date.now()}`,
          originalIndex: idx,
          rotation: 0,
          thumbnailUrl: activeFile.pageThumbnails?.[idx] || "",
        });
      }
      setPages(initial);
      setSelectedPagesForExtract([]);
      setSplitResults([]);
      setProcessedBytes(null);
      setProcessedFileName("");
      setIsSavedCloud(false);
      setIsSavedDrive(false);

      if (activeFile.pagesCount > 2) {
        setRangeInput(
          `1, 2-${Math.min(3, activeFile.pagesCount)}, ${Math.min(4, activeFile.pagesCount)}-${activeFile.pagesCount}`
        );
      } else {
        setRangeInput("1, 2");
      }
    }
  }, [activeFile]);

  // Page Operations
  const rotatePage = (idx: number) => {
    soundEffects.playClick();
    setProcessedBytes(null);
    setPages((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        rotation: (copy[idx].rotation + 90) % 360,
      };
      return copy;
    });
  };

  const rotateAll = () => {
    soundEffects.playClick();
    setProcessedBytes(null);
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + 90) % 360,
      }))
    );
  };

  const deletePage = (idx: number) => {
    soundEffects.playClick();
    setProcessedBytes(null);
    setPages((prev) => prev.filter((_, i) => i !== idx));
  };

  const duplicatePage = (idx: number) => {
    soundEffects.playClick();
    setProcessedBytes(null);
    setPages((prev) => {
      const copy = [...prev];
      const target = copy[idx];
      const newPage: PageOrderInfo = {
        ...target,
        id: `page-dup-${Date.now()}-${Math.random()}`,
      };
      copy.splice(idx + 1, 0, newPage);
      return copy;
    });
  };

  const moveLeft = (idx: number) => {
    if (idx <= 0) return;
    soundEffects.playClick();
    setProcessedBytes(null);
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const moveRight = (idx: number) => {
    if (idx >= pages.length - 1) return;
    soundEffects.playClick();
    setProcessedBytes(null);
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const resetPages = () => {
    soundEffects.playClick();
    if (!activeFile) return;
    const totalCount = activeFile.pagesCount || activeFile.pageThumbnails?.length || 1;
    const initial: PageOrderInfo[] = [];
    for (let idx = 0; idx < totalCount; idx++) {
      initial.push({
        id: `page-${idx}-${Date.now()}`,
        originalIndex: idx,
        rotation: 0,
        thumbnailUrl: activeFile.pageThumbnails?.[idx] || "",
      });
    }
    setPages(initial);
    setProcessedBytes(null);
  };

  // 1. Process & Save Organized PDF
  const handleApplyChanges = async () => {
    if (!activeFile || pages.length === 0) return;
    soundEffects.playClick();
    setIsProcessingInternal(true);

    try {
      const pagesInfo = pages.map((p) => ({
        originalIndex: p.originalIndex,
        rotation: p.rotation,
      }));

      // Generate real modified PDF bytes
      const output = await reorderAndRotatePages(activeFile.file, pagesInfo);
      const outputName = `${activeFile.name.replace(/\.[^/.]+$/, "")}_organized.pdf`;

      setProcessedBytes(output);
      setProcessedFileName(outputName);
      soundEffects.playSuccess();

      if (onExport) {
        onExport(pagesInfo);
      }
    } catch (err: any) {
      console.error("Failed to organize pages:", err);
      alert(`Failed to apply page changes: ${err?.message || "Operation failed"}`);
    } finally {
      setIsProcessingInternal(false);
    }
  };

  // 2. Download Modified PDF
  const handleDownloadOrganizedPdf = () => {
    if (!processedBytes || processedBytes.length === 0) {
      alert("Unable to download because the processed PDF is empty.");
      return;
    }

    soundEffects.playSuccess();
    downloadPdfBytes(processedBytes, processedFileName);
    recordDownloadedDoc(processedFileName, processedBytes.length, "Organize PDF");

    if (user) {
      apiRecordDownload(processedBytes, processedFileName, processedBytes.length, "Organize PDF");
    }
    if (onDownloadRecorded) onDownloadRecorded();
  };

  // 3. Save to Cloud / Google Drive
  const handleSaveCloudClick = async () => {
    if (!processedBytes || !onSaveToCloud) return;
    soundEffects.playClick();
    try {
      await onSaveToCloud(processedBytes, processedFileName);
      setIsSavedCloud(true);
      soundEffects.playSuccess();
      setTimeout(() => setIsSavedCloud(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveDriveClick = async () => {
    if (!processedBytes || !onSaveToGoogleDrive) return;
    soundEffects.playClick();
    try {
      await onSaveToGoogleDrive(processedBytes, processedFileName);
      setIsSavedDrive(true);
      soundEffects.playSuccess();
      setTimeout(() => setIsSavedDrive(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // 4. Run PDF Split
  const handleRunSplit = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsSplitting(true);

    try {
      const parts = rangeInput.split(",").map((p) => p.trim()).filter(Boolean);
      const ranges: { start: number; end: number }[] = [];

      for (const part of parts) {
        if (part.includes("-")) {
          const [startStr, endStr] = part.split("-");
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end)) {
            ranges.push({ start, end });
          }
        } else {
          const pageNum = parseInt(part, 10);
          if (!isNaN(pageNum)) {
            ranges.push({ start: pageNum, end: pageNum });
          }
        }
      }

      if (ranges.length === 0) {
        alert("Please enter valid page ranges (e.g., 1, 2-3, 4-5)");
        setIsSplitting(false);
        return;
      }

      const results = await splitPDF(activeFile.file, ranges);
      setSplitResults(results);
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error(err);
      alert(`Split failed: ${err.message || err}`);
    } finally {
      setIsSplitting(false);
    }
  };

  // 5. Run Page Extraction
  const handleRunExtract = async () => {
    if (!activeFile || selectedPagesForExtract.length === 0) return;
    soundEffects.playClick();
    setIsSplitting(true);

    try {
      const ranges = selectedPagesForExtract.map((p) => ({ start: p + 1, end: p + 1 }));
      const results = await splitPDF(activeFile.file, ranges);
      setSplitResults(results);
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error(err);
      alert(`Extraction failed: ${err.message || err}`);
    } finally {
      setIsSplitting(false);
    }
  };

  const togglePageSelection = (idx: number) => {
    soundEffects.playClick();
    setSelectedPagesForExtract((prev) =>
      prev.includes(idx) ? prev.filter((p) => p !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 font-sans text-white">
      {/* Header & Mode Switcher Bar */}
      <div className="bg-[#121215] p-5 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <Grid className="w-4 h-4" />
            <span>Document Page Layout Studio</span>
          </div>
          <h2 className="text-xl font-extrabold text-zinc-100 mt-1">Organize, Rotate & Split PDF</h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-medium">
            Document: <span className="text-zinc-100 font-semibold">{activeFile.name}</span> ({pages.length} Pages)
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab("organize")}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === "organize" ? "bg-[#1DB954] text-black shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            Organize & Rotate
          </button>
          <button
            onClick={() => setActiveTab("split")}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === "split" ? "bg-[#1DB954] text-black shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            Split PDF
          </button>
          <button
            onClick={() => setActiveTab("extract")}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === "extract" ? "bg-[#1DB954] text-black shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            Extract Pages
          </button>
        </div>
      </div>

      {/* SUCCESS & DOWNLOAD BANNER (MAIN CONTENT AREA) */}
      {processedBytes && processedBytes.length > 0 && activeTab === "organize" && (
        <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-900 border border-emerald-500/50 flex items-center justify-center text-[#1DB954] shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">PDF Processed Successfully!</h3>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                All {pages.length} pages preserved with rotations and custom order applied.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadOrganizedPdf}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-full transition-all shadow-[0_0_15px_rgba(29,185,84,0.3)] cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download PDF</span>
            </button>

            {user && onSaveToCloud && (
              <button
                onClick={handleSaveCloudClick}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-full border border-zinc-700 transition-colors cursor-pointer"
              >
                {isSavedCloud ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <Cloud className="w-3.5 h-3.5" />}
                <span>{isSavedCloud ? "Saved to Cloud" : "Save to Cloud"}</span>
              </button>
            )}

            {onSaveToGoogleDrive && (
              <button
                onClick={handleSaveDriveClick}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-full border border-zinc-700 transition-colors cursor-pointer"
              >
                {isSavedDrive ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <HardDrive className="w-3.5 h-3.5" />}
                <span>{isSavedDrive ? "Saved to Drive" : "Save to Drive"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: ORGANIZE & ROTATE */}
      {activeTab === "organize" && (
        <div className="flex flex-col gap-6">
          {/* Action Controls Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={rotateAll}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-zinc-200"
              >
                <RotateCw className="w-4 h-4 text-[#1DB954]" />
                <span>Rotate All 90°</span>
              </button>

              <button
                onClick={resetPages}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer text-zinc-400 hover:text-zinc-200"
                title="Reset to original order and rotation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {processedBytes && (
                <button
                  onClick={handleDownloadOrganizedPdf}
                  className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download PDF</span>
                </button>
              )}

              <button
                onClick={handleApplyChanges}
                disabled={isProcessingInternal || pages.length === 0}
                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(29,185,84,0.25)] cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessingInternal ? "animate-spin" : ""}`} />
                <span>Apply & Save Page Order</span>
              </button>
            </div>
          </div>

          {pages.length === 0 ? (
            <div className="text-center py-16 bg-[#121215] rounded-2xl border border-zinc-800 text-zinc-400">
              <p className="text-sm font-bold">All pages were removed from this document.</p>
              <button
                onClick={resetPages}
                className="mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold"
              >
                Restore Pages
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((page, idx) => (
                <div
                  key={page.id}
                  className="group bg-[#18181b] hover:bg-[#202024] border border-zinc-800 hover:border-[#1DB954]/50 p-3.5 rounded-2xl flex flex-col justify-between transition-all shadow-xl relative"
                >
                  {/* Page Card Header */}
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2.5 font-mono">
                    <span className="font-bold text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      Page {idx + 1}
                    </span>
                    {page.rotation > 0 && (
                      <span className="text-[#1DB954] font-bold text-[11px] bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        {page.rotation}°
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Preview with Dynamic Rotation */}
                  <div className="w-full aspect-[3/4] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center p-2 relative shadow-inner">
                    {page.thumbnailUrl ? (
                      <img
                        src={page.thumbnailUrl}
                        alt={`Page ${idx + 1}`}
                        style={{
                          transform: `rotate(${page.rotation}deg)`,
                          transition: "transform 0.25s ease",
                        }}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div className="text-xs text-zinc-500 font-mono">Page {page.originalIndex + 1}</div>
                    )}
                  </div>

                  {/* Page Card Actions */}
                  <div className="flex items-center justify-between gap-1 mt-3 pt-2.5 border-t border-zinc-800/80">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveLeft(idx)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 hover:text-white cursor-pointer transition-colors border border-zinc-800"
                        title="Move left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => moveRight(idx)}
                        disabled={idx === pages.length - 1}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 hover:text-white cursor-pointer transition-colors border border-zinc-800"
                        title="Move right"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => rotatePage(idx)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[#1DB954] cursor-pointer transition-colors border border-zinc-800"
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => duplicatePage(idx)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-indigo-400 cursor-pointer transition-colors border border-zinc-800"
                        title="Duplicate page"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => deletePage(idx)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950 text-rose-400 cursor-pointer transition-colors border border-zinc-800"
                        title="Delete page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Action Area */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            {processedBytes && (
              <button
                onClick={handleDownloadOrganizedPdf}
                className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-black font-extrabold text-xs px-6 py-3 rounded-full transition-all shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download PDF</span>
              </button>
            )}

            <button
              onClick={handleApplyChanges}
              disabled={isProcessingInternal || pages.length === 0}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-8 py-3 rounded-full transition-all shadow-[0_0_15px_rgba(29,185,84,0.3)] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessingInternal ? "animate-spin" : ""}`} />
              <span>Apply & Save Page Order</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SPLIT PDF BY RANGES */}
      {activeTab === "split" && (
        <div className="bg-[#121215] p-8 rounded-2xl border border-zinc-800 flex flex-col gap-6 shadow-xl max-w-2xl mx-auto w-full">
          <div>
            <h3 className="text-base font-extrabold text-zinc-100">Split by Page Ranges</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Specify comma-separated ranges to split into distinct PDF documents (e.g.,{" "}
              <span className="text-[#1DB954] font-mono">1, 2-3, 4-5</span>).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-300">Page Ranges</label>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="e.g. 1, 2-3, 4-5"
              className="bg-zinc-900 text-white text-xs font-mono px-4 py-3 rounded-xl border border-zinc-700 focus:border-[#1DB954] focus:outline-none"
            />
          </div>

          <button
            onClick={handleRunSplit}
            disabled={isSplitting || !rangeInput.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3.5 rounded-full transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            <Scissors className="w-4 h-4 text-black stroke-[2.5]" />
            <span>{isSplitting ? "SPLITTING PDF..." : "SPLIT PDF NOW"}</span>
          </button>

          {/* Split Output Results List */}
          {splitResults.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-zinc-200">Generated PDF Files ({splitResults.length}):</h4>
              <div className="flex flex-col gap-2">
                {splitResults.map((res, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-[#1DB954] shrink-0" />
                      <span className="text-xs font-bold text-white truncate max-w-xs">{res.filename}</span>
                    </div>
                    <button
                      onClick={() => {
                        downloadPdfBytes(res.bytes, res.filename);
                        recordDownloadedDoc(res.filename, res.bytes.length, "Split PDF");
                      }}
                      className="flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-4 py-1.5 rounded-full transition-colors cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXTRACT SELECTED PAGES */}
      {activeTab === "extract" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between bg-[#121215] p-5 rounded-2xl border border-zinc-800 shadow-xl">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Select Pages to Extract</h3>
              <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                Click pages to toggle selection ({selectedPagesForExtract.length} pages selected)
              </p>
            </div>

            <button
              onClick={handleRunExtract}
              disabled={isSplitting || selectedPagesForExtract.length === 0}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-full transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Scissors className="w-4 h-4 stroke-[2.5]" />
              <span>Extract Selected Pages</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pages.map((page, idx) => {
              const isSelected = selectedPagesForExtract.includes(idx);
              return (
                <div
                  key={page.id}
                  onClick={() => togglePageSelection(idx)}
                  className={`bg-[#18181b] hover:bg-[#202024] border p-3.5 rounded-2xl flex flex-col justify-between transition-all shadow-xl cursor-pointer select-none ${
                    isSelected ? "border-[#1DB954] ring-2 ring-[#1DB954]/40" : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2 font-mono">
                    <span className="font-bold text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      Page {idx + 1}
                    </span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 accent-[#1DB954] rounded cursor-pointer"
                    />
                  </div>

                  <div className="w-full aspect-[3/4] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center p-2 relative shadow-inner">
                    {page.thumbnailUrl ? (
                      <img
                        src={page.thumbnailUrl}
                        alt={`Page ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-zinc-600 font-mono">Page {page.originalIndex + 1}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Extract Output Results */}
          {splitResults.length > 0 && (
            <div className="bg-[#121215] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl">
              <h4 className="text-xs font-bold text-zinc-200">Extracted PDF Files ({splitResults.length}):</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {splitResults.map((res, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-[#1DB954] shrink-0" />
                      <span className="text-xs font-bold text-white truncate max-w-[200px]">{res.filename}</span>
                    </div>
                    <button
                      onClick={() => {
                        downloadPdfBytes(res.bytes, res.filename);
                        recordDownloadedDoc(res.filename, res.bytes.length, "Extract Pages");
                      }}
                      className="flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-4 py-1.5 rounded-full transition-colors cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
