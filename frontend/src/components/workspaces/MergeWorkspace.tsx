import React from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Layers, FileText, CheckCircle2 } from "lucide-react";
import { PDFFileItem } from "../../types";
import { soundEffects } from "../../lib/audio";

interface MergeWorkspaceProps {
  files: PDFFileItem[];
  onAddFilesClick: () => void;
  onRemoveFile: (id: string) => void;
  onReorderFiles: (newFiles: PDFFileItem[]) => void;
  onRunMerge: () => void;
  isProcessing: boolean;
}

export const MergeWorkspace: React.FC<MergeWorkspaceProps> = ({
  files,
  onAddFilesClick,
  onRemoveFile,
  onReorderFiles,
  onRunMerge,
  isProcessing,
}) => {
  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const copy = [...files];
    const temp = copy[idx - 1];
    copy[idx - 1] = copy[idx];
    copy[idx] = temp;
    onReorderFiles(copy);
  };

  const moveDown = (idx: number) => {
    if (idx >= files.length - 1) return;
    const copy = [...files];
    const temp = copy[idx + 1];
    copy[idx + 1] = copy[idx];
    copy[idx] = temp;
    onReorderFiles(copy);
  };

  const totalPages = files.reduce((acc, curr) => acc + curr.pagesCount, 0);

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto p-4 font-sans text-white">
      {/* Header Banner */}
      <div className="bg-[#121215] p-5 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row items-center gap-5">
        <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954] shrink-0">
          <Layers className="w-8 h-8" />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-[10px] font-semibold text-[#1DB954] tracking-wider uppercase">
            <span>Document Pipeline</span>
            <span>•</span>
            <span>Multi-File Queue</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mt-0.5 tracking-tight text-zinc-100">
            Merge PDF Documents
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-lg font-normal">
            Arrange multiple PDF files in your preferred sequence. Compile them into a single continuous document.
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-center sm:items-end gap-0.5">
          <span className="text-[11px] text-zinc-400 font-normal">Total Combined</span>
          <span className="text-base font-bold text-[#1DB954]">{files.length} Files • {totalPages} Pages</span>
        </div>
      </div>

      {/* Document Queue Controls */}
      <div className="bg-[#18181b] p-5 rounded-xl border border-zinc-800 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <h3 className="font-semibold text-xs text-zinc-200 flex items-center gap-2">
            <span>Document Sequence</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-medium">
              {files.length} selected
            </span>
          </h3>

          <button
            onClick={() => {
              soundEffects.playClick();
              onAddFilesClick();
            }}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#1DB954]" />
            <span>Add More PDFs</span>
          </button>
        </div>

        {/* File Queue List */}
        {files.length === 0 ? (
          <div
            onClick={() => {
              soundEffects.playClick();
              onAddFilesClick();
            }}
            className="py-12 border-2 border-dashed border-zinc-800 hover:border-[#1DB954]/50 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-zinc-900/40 group"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-[#1DB954] group-hover:text-black text-zinc-400 flex items-center justify-center transition-all">
              <Plus className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-zinc-300">Your Merge Queue is Empty</p>
            <p className="text-xs text-zinc-500">Click or drop 2 or more PDF files here to begin merging</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {files.map((file, idx) => (
              <div
                key={file.id}
                className="flex items-center gap-4 bg-[#202020] hover:bg-[#282828] p-3 rounded-lg border border-zinc-800 transition-colors group"
              >
                <span className="font-mono text-sm font-bold text-zinc-500 w-6 text-center">
                  #{idx + 1}
                </span>

                <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-700 overflow-hidden shrink-0">
                  {file.pageThumbnails[0] ? (
                    <img
                      src={file.pageThumbnails[0]}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <FileText className="w-5 h-5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{file.name}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {file.pagesCount} pages • {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                {/* Move Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      moveUp(idx);
                    }}
                    disabled={idx === 0}
                    className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      moveDown(idx);
                    }}
                    disabled={idx === files.length - 1}
                    className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onRemoveFile(file.id);
                    }}
                    className="p-1.5 rounded hover:bg-rose-950/60 text-zinc-500 hover:text-rose-400"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action button */}
        {files.length > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                soundEffects.playClick();
                onRunMerge();
              }}
              disabled={isProcessing || files.length < 2}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                files.length < 2
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800"
                  : "bg-[#1DB954] hover:bg-[#1ed760] text-black"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />
              <span>
                {files.length < 2
                  ? "Add at least 2 files to merge"
                  : `Merge ${files.length} Documents`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
