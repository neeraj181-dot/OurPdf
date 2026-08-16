import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Upload,
  ShieldCheck,
  ChevronLeft,
  LogIn,
  UserPlus,
  LogOut,
  User,
  FolderOpen,
  ArrowDownToLine,
  ChevronDown,
} from "lucide-react";
import { ToolCategory } from "../types";
import { UserProfile } from "../lib/api";
import { soundEffects } from "../lib/audio";

interface SpotifyHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: ToolCategory;
  setSelectedCategory: (cat: ToolCategory) => void;
  onUploadClick: () => void;
  onOpenDrivePicker?: () => void;
  activeToolId: string | null;
  onBackClick: () => void;
  user: UserProfile | null;
  onOpenAuthModal: (mode?: "login" | "register") => void;
  onLogout?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToDocs?: (tab?: "saved" | "downloads" | "recent") => void;
}

export const SpotifyHeader: React.FC<SpotifyHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  onUploadClick,
  onOpenDrivePicker,
  activeToolId,
  onBackClick,
  user,
  onOpenAuthModal,
  onLogout,
  onNavigateToProfile,
  onNavigateToDocs,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
        setIsUploadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const categories: { id: ToolCategory; label: string }[] = [
    { id: "all", label: "All PDF Tools" },
    { id: "create", label: "Create & Edit" },
    { id: "pages", label: "Organize" },
    { id: "edit", label: "Edit & Annotate" },
    { id: "enhance", label: "Optimize" },
    { id: "convert", label: "Convert" },
    { id: "security", label: "Security" },
  ];

  return (
    <header className="sticky top-0 z-20 bg-[#121215]/95 backdrop-blur-md px-6 py-3 border-b border-zinc-800/80 flex flex-col gap-3 font-sans">
      {/* Top Bar: Nav Controls, Search, Upload Button & User Pill */}
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
              title="Back to All PDF Tools"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Clean Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PDF tools (e.g. Merge, Compress, Watermark, OCR)..."
              className="w-full bg-zinc-800/80 text-zinc-100 placeholder-zinc-400 text-xs font-normal pl-9 pr-8 py-2 rounded-lg border border-zinc-700/60 focus:border-zinc-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right Bar Actions: Upload PDF, Engine Pill, Sign In / Register / User */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative" ref={uploadMenuRef}>
            <button
              onClick={() => {
                soundEffects.playClick();
                setIsUploadMenuOpen(!isUploadMenuOpen);
              }}
              className="flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>Import Document</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isUploadMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isUploadMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95 duration-100 font-sans">
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    setIsUploadMenuOpen(false);
                    onUploadClick();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left font-medium"
                >
                  <Upload className="w-4 h-4 text-[#1DB954]" />
                  <div>
                    <p className="font-semibold text-white">From Device</p>
                    <p className="text-[10px] text-zinc-400">PDF, PNG, JPG from computer</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    soundEffects.playClick();
                    setIsUploadMenuOpen(false);
                    onOpenDrivePicker?.();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left font-medium"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <div>
                    <p className="font-semibold text-white">Google Drive</p>
                    <p className="text-[10px] text-zinc-400">Import from your Google Drive</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/50 px-3 py-1.5 rounded-lg text-xs text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1DB954]" />
            <span className="font-medium">Client-Side Engine</span>
          </div>

          {user ? (
            <div className="relative" ref={menuRef}>
              {/* Clickable User Pill */}
              <button
                onClick={() => {
                  soundEffects.playClick();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className={`flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700/90 border border-zinc-700 hover:border-zinc-600 px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm ${
                  isMenuOpen ? "border-[#1DB954] ring-1 ring-[#1DB954]/50" : ""
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-[#1DB954] text-black font-extrabold flex items-center justify-center text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-white text-xs max-w-[130px] truncate">{user.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Floating Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#18181b] border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                    <p className="font-bold text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                  </div>

                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setIsMenuOpen(false);
                      onNavigateToProfile?.();
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left font-medium"
                  >
                    <User className="w-4 h-4 text-[#1DB954]" />
                    <span>Profile & Account</span>
                  </button>

                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setIsMenuOpen(false);
                      onNavigateToDocs?.("saved");
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left font-medium"
                  >
                    <FolderOpen className="w-4 h-4 text-[#1DB954]" />
                    <span>Saved Documents</span>
                  </button>

                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setIsMenuOpen(false);
                      onNavigateToDocs?.("downloads");
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left font-medium"
                  >
                    <ArrowDownToLine className="w-4 h-4 text-[#1DB954]" />
                    <span>Downloads</span>
                  </button>

                  <div className="border-t border-zinc-800/80 my-1"></div>

                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setIsMenuOpen(false);
                      onLogout?.();
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors cursor-pointer text-left font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onOpenAuthModal("login");
                }}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-zinc-300" />
                <span>Sign In</span>
              </button>

              <button
                onClick={() => {
                  soundEffects.playClick();
                  onOpenAuthModal("register");
                }}
                className="hidden sm:flex items-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-zinc-600 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#1DB954]" />
                <span>Register</span>
              </button>
            </div>
          )}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 border cursor-pointer ${
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
