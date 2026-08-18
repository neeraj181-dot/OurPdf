import React, { useState } from "react";
import {
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { downloadPdfBytes, fileToArrayBuffer, protectPDF } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";

interface SecuritySearchWorkspaceProps {
  mode: "protect" | "search-pdf";
  activeFile: PDFFileItem | null;
  onOpenFilePicker: () => void;
}

export interface SearchResult {
  pageNumber: number;
  snippet: string;
}

export const SecuritySearchWorkspace: React.FC<SecuritySearchWorkspaceProps> = ({
  mode,
  activeFile,
  onOpenFilePicker,
}) => {
  // Password State
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 1. PROTECT PDF (Password Encryption)
  const handleProtectPdf = async () => {
    if (!activeFile) return;
    if (!password) {
      setErrorMsg("Please enter a password.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    soundEffects.playClick();
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const protectedBytes = await protectPDF(activeFile.file, password);
      soundEffects.playSuccess();
      setSuccessMsg(`PDF protected successfully! Any user opening it will be prompted for the password.`);
      downloadPdfBytes(protectedBytes, `protected_${activeFile.name}`);
    } catch (err: any) {
      console.error("Protect PDF error:", err);
      setErrorMsg(err.message || "Failed to protect PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. SEARCH PDF
  const handleSearchPdf = async () => {
    if (!activeFile || !searchQuery.trim()) return;
    soundEffects.playClick();
    setIsSearching(true);
    setSearchResults([]);

    try {
      const buffer = await fileToArrayBuffer(activeFile.file);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      const results: SearchResult[] = [];
      const query = searchQuery.toLowerCase().trim();

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");

        if (pageText.toLowerCase().includes(query)) {
          const matchIndex = pageText.toLowerCase().indexOf(query);
          const start = Math.max(0, matchIndex - 40);
          const end = Math.min(pageText.length, matchIndex + query.length + 60);
          const snippet = (start > 0 ? "..." : "") + pageText.substring(start, end) + (end < pageText.length ? "..." : "");

          results.push({
            pageNumber: i,
            snippet,
          });
        }
      }

      setSearchResults(results);
      soundEffects.playSuccess();
    } catch (err: any) {
      alert("Failed to search document text.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 font-sans text-white">
      {/* Header */}
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            {mode === "protect" && <Lock className="w-4 h-4" />}
            {mode === "search-pdf" && <Search className="w-4 h-4" />}
            <span>
              {mode === "protect"
                ? "PROTECT PDF SECURITY"
                : "SEARCH PDF TEXT"}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-0.5">
            {mode === "protect"
              ? "Password Protect PDF Document"
              : "Search Within PDF Document"}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Active PDF: <span className="text-white font-semibold">{activeFile?.name || "None Selected"}</span>
          </p>
        </div>

        {!activeFile && (
          <button
            onClick={onOpenFilePicker}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-all cursor-pointer shadow-md"
          >
            <span>SELECT PDF FILE</span>
          </button>
        )}
      </div>

      {activeFile && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-6 shadow-xl">
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

          {/* MODE 1: PROTECT */}
          {mode === "protect" && (
            <div className="flex flex-col gap-4 max-w-md mx-auto w-full">
              <div className="flex flex-col gap-1 text-xs">
                <label className="font-bold text-zinc-300">Set Document Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter strong password..."
                  className="bg-zinc-900 text-white p-3 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <label className="font-bold text-zinc-300">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password..."
                  className="bg-zinc-900 text-white p-3 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
                />
              </div>

              <button
                onClick={handleProtectPdf}
                disabled={isProcessing}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3.5 rounded-full transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{isProcessing ? "ENCRYPTING PDF..." : "ENCRYPT & PROTECT PDF"}</span>
              </button>
            </div>
          )}

          {/* MODE 2: SEARCH PDF */}
          {mode === "search-pdf" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchPdf()}
                    placeholder="Search keywords or text inside document (e.g. invoice, total, agreement)..."
                    className="w-full bg-zinc-900 text-white text-xs pl-9 pr-3 py-3 rounded-xl border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleSearchPdf}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  <span>{isSearching ? "Searching..." : "Search"}</span>
                </button>
              </div>

              {/* Search Results Display */}
              {searchResults.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-[#1DB954]">
                    Found {searchResults.length} {searchResults.length === 1 ? "match" : "matches"} for "{searchQuery}":
                  </span>

                  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                    {searchResults.map((res, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 flex flex-col gap-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white bg-zinc-800 px-2 py-0.5 rounded text-[10px]">
                            Page {res.pageNumber}
                          </span>
                        </div>
                        <p className="text-zinc-300 text-[11px] leading-relaxed italic mt-1 font-mono">
                          {res.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searchQuery && !isSearching ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No matches found for "{searchQuery}" in this document.
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
