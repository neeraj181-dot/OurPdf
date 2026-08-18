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
  Layers,
} from "lucide-react";
import { PDFFileItem, PageOrderInfo } from "../../types";
import { soundEffects } from "../../lib/audio";
import { splitPDF, downloadPdfBytes } from "../../lib/pdfEngine";

interface OrganizeWorkspaceProps {
  activeFile: PDFFileItem;
  onExport: (pagesInfo: { originalIndex: number; rotation: number }[]) => void;
  isProcessing: boolean;
  initialTab?: "organize" | "split" | "extract";
}

export const OrganizeWorkspace: React.FC<OrganizeWorkspaceProps> = ({
  activeFile,
  onExport,
  isProcessing,
  initialTab = "organize",
}) => {
  const [activeTab, setActiveTab] = useState<"organize" | "split" | "extract">(initialTab);
  const [pages, setPages] = useState<PageOrderInfo[]>([]);

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

      // Set default range suggestion based on page count
      if (activeFile.pagesCount > 2) {
        setRangeInput(`1, 2-${Math.min(3, activeFile.pagesCount)}, ${Math.min(4, activeFile.pagesCount)}-${activeFile.pagesCount}`);
      } else {
        setRangeInput("1, 2");
      }
    }
  }, [activeFile]);

  const rotatePage = (idx: number) => {
    soundEffects.playClick();
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
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + 90) % 360,
      }))
    );
  };

  const deletePage = (idx: number) => {
    soundEffects.playClick();
    setPages((prev) => prev.filter((_, i) => i !== idx));
  };

  const duplicatePage = (idx: number) => {
    soundEffects.playClick();
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
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const handleExportClick = () => {
    soundEffects.playClick();
    onExport(
      pages.map((p) => ({
        originalIndex: p.originalIndex,
        rotation: p.rotation,
      }))
    );
  };

  // Run Real PDF Split
  const handleRunSplit = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsSplitting(true);

    try {
      // Parse ranges string like "1, 2-3, 4-5"
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

  // Run Page Extraction
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
      <div className="bg-[#121215] p-5 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-[#1DB954] uppercase tracking-wider">
            <Grid className="w-3.5 h-3.5" />
            <span>Document Page Layout Studio</span>
          </div>
          <h2 className="text-lg font-bold text-zinc-100 mt-0.5">Organize, Rotate & Split PDF</h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-normal">
            Document: <span className="text-zinc-200 font-medium">{activeFile.name}</span> ({pages.length} Pages)
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab("organize")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "organize" ? "bg-[#1DB954] text-black" : "text-zinc-400 hover:text-white"
            }`}
          >
            Organize & Rotate
          </button>
          <button
            onClick={() => setActiveTab("split")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "split" ? "bg-[#1DB954] text-black" : "text-zinc-400 hover:text-white"
            }`}
          >
            Split PDF
          </button>
          <button
            onClick={() => setActiveTab("extract")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "extract" ? "bg-[#1DB954] text-black" : "text-zinc-400 hover:text-white"
            }`}
          >
            Extract Pages
          </button>
        </div>
      </div>

      {/* TAB 1: ORGANIZE & ROTATE */}
      {activeTab === "organize" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <button
              onClick={rotateAll}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#1DB954]" />
              <span>Rotate All 90°</span>
            </button>

            <button
              onClick={handleExportClick}
              disabled={isProcessing || pages.length === 0}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
              <span>Apply & Save Page Order</span>
            </button>
          </div>

          {pages.length === 0 ? (
            <div className="text-center py-16 bg-[#181818] rounded-2xl border border-zinc-800 text-zinc-400">
              <p className="text-sm font-bold">All pages were removed from this document.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((page, idx) => (
                <div
                  key={page.id}
                  className="group bg-[#202020] hover:bg-[#282828] border border-zinc-800 hover:border-[#1DB954]/50 p-3 rounded-xl flex flex-col justify-between transition-all shadow-md relative"
                >
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2 font-mono">
                    <span className="font-bold text-white bg-zinc-900 px-2 py-0.5 rounded">
                      Page {idx + 1}
                    </span>
                    {page.rotation > 0 && (
                      <span className="text-[#1DB954] font-bold">{page.rotation}°</span>
                    )}
                  </div>

                  <div className="w-full aspect-[3/4] bg-zinc-900 rounded border border-zinc-700/60 overflow-hidden flex items-center justify-center p-1 relative">
                    {page.thumbnailUrl ? (
                      <img
                        src={page.thumbnailUrl}
                        alt={`Page ${idx + 1}`}
                        style={{ transform: `rotate(${page.rotation}deg)` }}
                        className="w-full h-full object-contain transition-transform duration-300"
                      />
                    ) : (
                      <div className="text-xs text-zinc-600 font-mono">Page {page.originalIndex + 1}</div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveLeft(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 cursor-pointer"
                        title="Move page left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveRight(idx)}
                        disabled={idx === pages.length - 1}
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 cursor-pointer"
                        title="Move page right"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => rotatePage(idx)}
                        className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[#1DB954] cursor-pointer"
                        title="Rotate 90 degrees"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => duplicatePage(idx)}
                        className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                        title="Duplicate page"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => deletePage(idx)}
                        className="p-1.5 rounded bg-zinc-800 hover:bg-rose-950 text-rose-400 cursor-pointer"
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
        </div>
      )}

      {/* TAB 2: SPLIT PDF BY RANGES */}
      {activeTab === "split" && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-6 shadow-xl max-w-2xl mx-auto w-full">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">Split by Page Ranges</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Specify comma-separated ranges to split into distinct PDF documents (e.g., <span className="text-[#1DB954] font-mono">1, 2-3, 4-5</span>).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-300">Page Ranges</label>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="e.g. 1, 2-3, 4-5"
              className="bg-zinc-900 text-white text-xs font-mono px-4 py-3 rounded-lg border border-zinc-700 focus:border-[#1DB954] focus:outline-none"
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
                    className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-[#1DB954]" />
                      <span className="text-xs font-bold text-white truncate max-w-xs">{res.filename}</span>
                    </div>
                    <button
                      onClick={() => downloadPdfBytes(res.bytes, res.filename)}
                      className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-900 font-bold text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
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
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Select Pages to Extract</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Click pages to toggle selection ({selectedPagesForExtract.length} pages selected)
              </p>
            </div>

            <button
              onClick={handleRunExtract}
              disabled={isSplitting || selectedPagesForExtract.length === 0}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
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
                  className={`bg-[#202020] hover:bg-[#282828] border p-3 rounded-xl flex flex-col justify-between transition-all shadow-md cursor-pointer select-none ${
                    isSelected ? "border-[#1DB954] ring-2 ring-[#1DB954]/40" : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2 font-mono">
                    <span className="font-bold text-white bg-zinc-900 px-2 py-0.5 rounded">
                      Page {idx + 1}
                    </span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 accent-[#1DB954] rounded cursor-pointer"
                    />
                  </div>

                  <div className="w-full aspect-[3/4] bg-zinc-900 rounded border border-zinc-700/60 overflow-hidden flex items-center justify-center p-1 relative">
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
            <div className="bg-[#181818] p-5 rounded-xl border border-zinc-800 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-zinc-200">Extracted PDF Files ({splitResults.length}):</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {splitResults.map((res, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-[#1DB954]" />
                      <span className="text-xs font-bold text-white truncate max-w-[200px]">{res.filename}</span>
                    </div>
                    <button
                      onClick={() => downloadPdfBytes(res.bytes, res.filename)}
                      className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-900 font-bold text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
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
