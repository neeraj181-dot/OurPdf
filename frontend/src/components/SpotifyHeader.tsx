import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Upload,
  Shield,
  ChevronLeft,
  LogIn,
  UserPlus,
  LogOut,
  User,
  FolderOpen,
  ArrowDownToLine,
  ChevronDown,
  HardDrive,
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
  activeToolTitle?: string | null;
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
  activeToolTitle,
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

  // Close dropdowns on outside click
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
    { id: "all", label: "All Tools" },
    { id: "create", label: "Create & Edit" },
    { id: "pages", label: "Organize" },
    { id: "convert", label: "Convert" },
    { id: "enhance", label: "Optimize" },
    { id: "security", label: "Security" },
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#0f1011] border-b border-[#292c30] flex flex-col font-sans select-none">
      {/* Top Application Toolbar */}
      <div className="h-12 px-4 flex items-center justify-between gap-4">
        {/* Left: Breadcrumbs & Navigation */}
        <div className="flex items-center gap-3 shrink-0">
          {activeToolId && (
            <button
              onClick={() => {
                soundEffects.playClick();
                onBackClick();
              }}
              className="w-7 h-7 rounded-md bg-[#17191b] hover:bg-[#1d2023] text-zinc-300 hover:text-white border border-[#292c30] flex items-center justify-center transition-colors cursor-pointer"
              title="Back to All Tools"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
            <span className="text-zinc-200 font-semibold">OurPDF</span>
            <span>/</span>
            <span className="text-zinc-400 truncate max-w-[180px]">
              {activeToolTitle || (selectedCategory === "all" ? "All Tools" : categories.find((c) => c.id === selectedCategory)?.label || "Workspace")}
            </span>
          </div>
        </div>

        {/* Center: Search Field */}
        <div className="flex-1 max-w-md relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full bg-[#17191b] text-zinc-200 placeholder-zinc-500 text-xs font-normal pl-8 pr-7 py-1.5 rounded-md border border-[#292c30] focus:border-zinc-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right: Local indicator, Import button, and Account */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Subtle Local Processing Indicator */}
          <div
            className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-400 px-2 py-1 rounded-md bg-[#17191b] border border-[#292c30] cursor-help"
            title="Your documents are processed locally in your browser with zero server data retention."
          >
            <Shield className="w-3 h-3 text-[#1db954]" />
            <span>Local processing</span>
          </div>

          {/* Import Button Dropdown */}
          <div className="relative" ref={uploadMenuRef}>
            <button
              onClick={() => {
                soundEffects.playClick();
                setIsUploadMenuOpen(!isUploadMenuOpen);
              }}
              className="flex items-center gap-1.5 bg-[#1db954] hover:bg-[#1ed760] text-black font-semibold text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Import PDF</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isUploadMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isUploadMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#17191b] border border-[#292c30] rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    setIsUploadMenuOpen(false);
                    onUploadClick();
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-zinc-200 hover:bg-[#1d2023] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                  <span>From Device</span>
                </button>

                <button
                  onClick={() => {
                    soundEffects.playClick();
                    setIsUploadMenuOpen(false);
                    onOpenDrivePicker?.();
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-zinc-200 hover:bg-[#1d2023] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <span>Google Drive</span>
                </button>
              </div>
            )}
          </div>

          {/* User Account / Sign In */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => {
                  soundEffects.playClick();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="flex items-center gap-1.5 bg-[#17191b] hover:bg-[#1d2023] border border-[#292c30] px-2 py-1 rounded-md text-xs transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-[#1db954] text-black font-bold flex items-center justify-center text-[10px]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-zinc-200 max-w-[90px] truncate">{user.name}</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#17191b] border border-[#292c30] rounded-lg shadow-xl p-1.5 z-50 flex flex-col gap-0.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1.5 border-b border-[#292c30] mb-0.5">
                    <p className="font-semibold text-zinc-100 truncate">{user.name}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                  </div>

                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setIsMenuOpen(false);
                      onNavigateToProfile?.();
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-zinc-300 hover:bg-[#1d2023] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Profile & Account</span>
                  </button>

                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setIsMenuOpen(false);
                      onNavigateToDocs?.("saved");
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-zinc-300 hover:bg-[#1d2023] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Saved Documents</span>
                  </button>

                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setIsMenuOpen(false);
                      onNavigateToDocs?.("downloads");
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-zinc-300 hover:bg-[#1d2023] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Downloads</span>
                  </button>

                  <div className="border-t border-[#292c30] my-1" />

                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      setIsMenuOpen(false);
                      onLogout?.();
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onOpenAuthModal("login");
                }}
                className="flex items-center gap-1 bg-[#17191b] hover:bg-[#1d2023] text-zinc-200 text-xs font-medium px-2.5 py-1.5 rounded-md border border-[#292c30] transition-colors cursor-pointer"
              >
                <LogIn className="w-3 h-3 text-zinc-400" />
                <span>Sign In</span>
              </button>

              <button
                onClick={() => {
                  soundEffects.playClick();
                  onOpenAuthModal("register");
                }}
                className="hidden sm:flex items-center gap-1 bg-[#1d2023] hover:bg-[#25292d] text-zinc-200 text-xs font-medium px-2.5 py-1.5 rounded-md border border-[#292c30] transition-colors cursor-pointer"
              >
                <UserPlus className="w-3 h-3 text-[#1db954]" />
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Category Tabs Strip (when browsing tools on Home) */}
      {!activeToolId && (
        <div className="h-9 px-4 flex items-center gap-1 overflow-x-auto border-t border-[#292c30]/50 custom-scrollbar scrollbar-none bg-[#0f1011]">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedCategory(cat.id);
                }}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-[#17191b] text-[#f1f3f5] font-semibold border border-[#292c30]"
                    : "text-[#9aa0a6] hover:text-[#f1f3f5] hover:bg-[#17191b]/50"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};

