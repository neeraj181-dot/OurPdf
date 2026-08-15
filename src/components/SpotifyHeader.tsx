import React, { useState } from "react";
import { Search, Upload, ShieldCheck, ChevronLeft, ChevronRight, User, LogIn, Crown, Sparkles, LogOut, ChevronDown } from "lucide-react";
import { ToolCategory, UserProfile, AuthMode } from "../types";
import { soundEffects } from "../lib/audio";

interface SpotifyHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: ToolCategory;
  setSelectedCategory: (cat: ToolCategory) => void;
  onUploadClick: () => void;
  activeToolId: string | null;
  onBackClick: () => void;
  user: UserProfile | null;
  onOpenAuth: (mode?: AuthMode) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const SpotifyHeader: React.FC<SpotifyHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  onUploadClick,
  activeToolId,
  onBackClick,
  user,
  onOpenAuth,
  onOpenProfile,
  onLogout,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
                  ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border-zinc-700 cursor-pointer"
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
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>Upload PDF</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/50 px-3 py-1.5 rounded-lg text-xs text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1DB954]" />
            <span className="font-medium">Client-Side Engine</span>
          </div>

          {/* User Account / Auth Button */}
          <div className="relative">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    setDropdownOpen(!dropdownOpen);
                  }}
                  className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-6 h-6 rounded-lg object-cover bg-zinc-700"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-lg bg-[#1DB954] text-black flex items-center justify-center font-bold text-xs">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <span className="font-semibold max-w-[90px] truncate">{user.name}</span>
                  {user.plan === "pro" && (
                    <span className="bg-[#1DB954]/20 text-[#1DB954] text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-[#1DB954]/30">
                      PRO
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-11 z-40 w-48 bg-[#18181c] border border-zinc-800 rounded-xl shadow-2xl py-1 text-xs text-zinc-200">
                      <div className="px-3 py-2 border-b border-zinc-800">
                        <div className="font-semibold text-zinc-100">{user.name}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{user.email}</div>
                      </div>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenProfile();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5 text-[#1DB954]" />
                        <span>Account & Subscription</span>
                      </button>

                      {user.plan !== "pro" && (
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            onOpenProfile();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1DB954]/10 text-[#1DB954] font-semibold text-left transition-colors cursor-pointer"
                        >
                          <Crown className="w-3.5 h-3.5 fill-[#1DB954]" />
                          <span>Upgrade to PRO</span>
                        </button>
                      )}

                      <div className="border-t border-zinc-800 my-1" />

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 text-left transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    onOpenAuth("login");
                  }}
                  className="text-xs font-semibold text-zinc-300 hover:text-zinc-100 px-3 py-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors cursor-pointer"
                >
                  Log In
                </button>
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    onOpenAuth("signup");
                  }}
                  className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-md"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </button>
              </div>
            )}
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
