import React, { useState } from "react";
import { Hash, Lock, FileArchive, CheckCircle2 } from "lucide-react";
import { PDFFileItem, PageNumberOptions } from "../../types";
import { soundEffects } from "../../lib/audio";

interface AnnotateWorkspaceProps {
  mode: "page-numbers" | "lock" | "compress";
  activeFile: PDFFileItem;
  onPageNumbersRun: (options: PageNumberOptions) => void;
  onLockRun: (password: string) => void;
  onCompressRun: (quality: number) => void;
  isProcessing: boolean;
}

export const AnnotateWorkspace: React.FC<AnnotateWorkspaceProps> = ({
  mode,
  activeFile,
  onPageNumbersRun,
  onLockRun,
  onCompressRun,
  isProcessing,
}) => {
  // Page Numbers State
  const [numFormat, setNumFormat] = useState<"Page {n}" | "{n} of {total}" | "- {n} -">("Page {n}");
  const [numPos, setNumPos] = useState<"bottom-center" | "bottom-right" | "top-right" | "bottom-left">("bottom-center");
  const [numFontSize, setNumFontSize] = useState(11);

  // Lock State
  const [password, setPassword] = useState("");

  // Compress State
  const [compressionRatio, setCompressionRatio] = useState(0.6); // 60% quality

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 font-sans text-white">
      {/* PAGE NUMBERS MODE */}
      {mode === "page-numbers" && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-5 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <Hash className="w-4 h-4" />
            <span>NUMBERING PIPELINE</span>
          </div>

          <div>
            <h2 className="text-xl font-bold">Add Page Numbers</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Document: <span className="text-white font-semibold">{activeFile.name}</span> ({activeFile.pagesCount} Pages)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300">Numbering Format</label>
              <select
                value={numFormat}
                onChange={(e) => setNumFormat(e.target.value as any)}
                className="bg-[#242424] text-white text-xs font-bold p-3 rounded-lg border border-zinc-700 focus:outline-none"
              >
                <option value="Page {n}">Page 1, Page 2...</option>
                <option value="{n} of {total}">1 of 12, 2 of 12...</option>
                <option value="- {n} -">- 1 -, - 2 -...</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300">Position on Page</label>
              <select
                value={numPos}
                onChange={(e) => setNumPos(e.target.value as any)}
                className="bg-[#242424] text-white text-xs font-bold p-3 rounded-lg border border-zinc-700 focus:outline-none"
              >
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-bold text-zinc-300">
              <span>Font Size</span>
              <span className="text-[#1DB954] font-mono">{numFontSize}pt</span>
            </div>
            <input
              type="range"
              min="8"
              max="24"
              value={numFontSize}
              onChange={(e) => setNumFontSize(Number(e.target.value))}
              className="accent-[#1DB954] cursor-pointer"
            />
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              onPageNumbersRun({
                format: numFormat,
                position: numPos,
                fontSize: numFontSize,
                color: "#333333",
              });
            }}
            disabled={isProcessing}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3 rounded-full transition-all shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-black stroke-[3]" />
            <span>STAMP PAGE NUMBERS</span>
          </button>
        </div>
      )}

      {/* LOCK MODE */}
      {mode === "lock" && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-5 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>SECURITY PIPELINE</span>
          </div>

          <div>
            <h2 className="text-xl font-bold">Protect & Lock PDF</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Document: <span className="text-white font-semibold">{activeFile.name}</span>
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-300">Set Security Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter strong document password..."
              className="bg-[#242424] text-white text-xs font-medium px-4 py-3 rounded-lg border border-zinc-700 focus:border-rose-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              onLockRun(password);
            }}
            disabled={isProcessing || !password.trim()}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs py-3 rounded-full transition-all shadow-lg disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>ENCRYPT & LOCK PDF FILE</span>
          </button>
        </div>
      )}

      {/* COMPRESS MODE */}
      {mode === "compress" && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-5 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <FileArchive className="w-4 h-4" />
            <span>COMPRESSION PIPELINE</span>
          </div>

          <div>
            <h2 className="text-xl font-bold">Compress & Optimize PDF</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Original Size: <span className="text-white font-semibold">{(activeFile.size / (1024 * 1024)).toFixed(2)} MB</span>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-300">Compression Preset</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Light", ratio: 0.8, desc: "High quality, modest size reduction" },
                { label: "Balanced", ratio: 0.5, desc: "Optimal balance for web & email" },
                { label: "Maximum", ratio: 0.3, desc: "Aggressive compression" },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    soundEffects.playClick();
                    setCompressionRatio(p.ratio);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    compressionRatio === p.ratio
                      ? "bg-[#1DB954]/20 border-[#1DB954] text-white"
                      : "bg-[#202020] border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  <p className="text-xs font-bold text-white">{p.label}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              soundEffects.playClick();
              onCompressRun(compressionRatio);
            }}
            disabled={isProcessing}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3 rounded-full transition-all shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-black stroke-[3]" />
            <span>COMPRESS PDF NOW</span>
          </button>
        </div>
      )}
    </div>
  );
};
