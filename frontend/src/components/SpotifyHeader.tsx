import React from "react";
import { Search, Upload, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { ToolCategory } from "../types";
import { soundEffects } from "../lib/audio";

interface SpotifyHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: ToolCategory;
  setSelectedCategory: (cat: ToolCategory) => void;
  onUploadClick: () => void;
  activeToolId: string | null;
  onBackClick: () => void;
}

export const SpotifyHeader: React.FC<SpotifyHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  onUploadClick,
  activeToolId,
  onBackClick,
}) => {
  const categories: { id: ToolCategory; label: string }[] = [
    { id: "all", label: "All Tools" },
    { id: "popular", label: "Popular" },
    { id: "read", label: "Read & Analyze" },
    { id: "edit", label: "Edit & Annotate" },
    { id: "convert", label: "Convert" },
    { id: "security", label: "Security" },
  ];

  return (
    <header className="sticky top-0 z-20 bg-[#121215]/95 backdrop-blur-md px-6 py-3 border-b border-zinc-800/80 flex flex-col gap-3 font-sans">
      {/* Top Bar: Nav Controls, Search, Actions */}
      <div className="flex items-center justify-between gap-4">
        {/* Navigation & Search */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                soundEffects.playClick();
                onBackClick();
              }}
              disabled={!activeToolId}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border ${
                activeToolId
                  ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border-zinc-700"
                  : "bg-zinc-900/50 text-zinc-600 border-zinc-800/60 cursor-not-allowed"
              }`}
              title="Back to Studio Home"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="w-8 h-8 rounded-lg bg-zinc-900/50 border border-zinc-800/60 text-zinc-600 flex items-center justify-center cursor-not-allowed"
              title="Forward"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Clean Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PDF tools (e.g. Merge, Watermark, Summary)..."
              className="w-full bg-zinc-800/80 text-zinc-100 placeholder-zinc-400 text-xs font-normal pl-9 pr-8 py-2 rounded-lg border border-zinc-700/60 focus:border-zinc-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right Bar Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              soundEffects.playClick();
              onUploadClick();
            }}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>Upload PDF</span>
          </button>

          <div className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/50 px-3 py-1.5 rounded-lg text-xs text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1DB954]" />
            <span className="font-medium">Client-Side Engine</span>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      {!activeToolId && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 custom-scrollbar scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedCategory(cat.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 border ${
                  isSelected
                    ? "bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold"
                    : "bg-zinc-800/60 text-zinc-400 border-zinc-700/50 font-medium hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
