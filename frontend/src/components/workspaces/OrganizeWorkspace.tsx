import React, { useState, useEffect } from "react";
import { RotateCw, Trash2, ArrowLeft, ArrowRight, Grid, Copy, RefreshCw } from "lucide-react";
import { PDFFileItem, PageOrderInfo } from "../../types";
import { soundEffects } from "../../lib/audio";

interface OrganizeWorkspaceProps {
  activeFile: PDFFileItem;
  onExport: (pagesInfo: { originalIndex: number; rotation: number }[]) => void;
  isProcessing: boolean;
}

export const OrganizeWorkspace: React.FC<OrganizeWorkspaceProps> = ({
  activeFile,
  onExport,
  isProcessing,
}) => {
  const [pages, setPages] = useState<PageOrderInfo[]>([]);

  useEffect(() => {
    if (activeFile && activeFile.pageThumbnails) {
      const initial: PageOrderInfo[] = activeFile.pageThumbnails.map((url, idx) => ({
        id: `page-${idx}-${Date.now()}`,
        originalIndex: idx,
        rotation: 0,
        thumbnailUrl: url,
      }));
      setPages(initial);
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

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 font-sans text-white">
      {/* Header Controls */}
      <div className="bg-[#121215] p-5 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-[#1DB954] uppercase tracking-wider">
            <Grid className="w-3.5 h-3.5" />
            <span>Page Layout Editor</span>
          </div>
          <h2 className="text-lg font-bold text-zinc-100 mt-0.5">Organize & Rotate Pages</h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-normal">
            Document: <span className="text-zinc-200 font-medium">{activeFile.name}</span> ({pages.length} Pages remaining)
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
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
            <span>Apply Page Changes</span>
          </button>
        </div>
      </div>

      {/* Pages Grid */}
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
              {/* Top Page Label */}
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2 font-mono">
                <span className="font-bold text-white bg-zinc-900 px-2 py-0.5 rounded">
                  Page {idx + 1}
                </span>
                {page.rotation > 0 && (
                  <span className="text-[#1DB954] font-bold">{page.rotation}°</span>
                )}
              </div>

              {/* Page Thumbnail Preview with Rotation Transform */}
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

              {/* Toolbar Controls */}
              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveLeft(idx)}
                    disabled={idx === 0}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
                    title="Move page left"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveRight(idx)}
                    disabled={idx === pages.length - 1}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
                    title="Move page right"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => rotatePage(idx)}
                    className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[#1DB954]"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => duplicatePage(idx)}
                    className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    title="Duplicate page"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => deletePage(idx)}
                    className="p-1.5 rounded bg-zinc-800 hover:bg-rose-950 text-rose-400"
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
  );
};
