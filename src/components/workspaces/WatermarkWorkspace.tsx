import React, { useState } from "react";
import { Stamp, Sparkles, CheckCircle2 } from "lucide-react";
import { PDFFileItem, WatermarkOptions } from "../../types";
import { soundEffects } from "../../lib/audio";

interface WatermarkWorkspaceProps {
  activeFile: PDFFileItem;
  onApplyWatermark: (options: WatermarkOptions) => void;
  isProcessing: boolean;
}

export const WatermarkWorkspace: React.FC<WatermarkWorkspaceProps> = ({
  activeFile,
  onApplyWatermark,
  isProcessing,
}) => {
  const [text, setText] = useState("CONFIDENTIAL");
  const [color, setColor] = useState("#1DB954");
  const [fontSize, setFontSize] = useState(54);
  const [opacity, setOpacity] = useState(0.4);
  const [rotation, setRotation] = useState(-30);
  const [position, setPosition] = useState<"center" | "top" | "bottom">("center");

  const presetTexts = [
    "CONFIDENTIAL",
    "APPROVED",
    "DRAFT",
    "INTERNAL USE ONLY",
    "SAMPLE",
    "DO NOT COPY",
  ];

  const handleApply = () => {
    soundEffects.playClick();
    onApplyWatermark({
      text,
      color,
      fontSize,
      opacity,
      rotation,
      position,
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto p-4 font-sans text-white">
      {/* Left Control Panel */}
      <div className="w-full lg:w-1/2 bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
          <Stamp className="w-4 h-4" />
          <span>STAMP & BRANDING STUDIO</span>
        </div>

        <div>
          <h2 className="text-xl font-black">Watermark PDF Generator</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Document: <span className="text-white font-semibold">{activeFile.name}</span>
          </p>
        </div>

        {/* Quick Preset Badges */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-300">Quick Text Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {presetTexts.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  soundEffects.playClick();
                  setText(preset);
                }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                  text === preset
                    ? "bg-[#1DB954] text-black border-[#1DB954]"
                    : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Text Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-300">Watermark Text</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-[#242424] text-white text-xs font-medium px-3.5 py-2.5 rounded-lg border border-zinc-700 focus:border-[#1DB954] focus:outline-none"
            placeholder="Enter custom watermark text..."
          />
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-zinc-300 font-bold">
              <span>Font Size</span>
              <span className="text-[#1DB954] font-mono">{fontSize}px</span>
            </div>
            <input
              type="range"
              min="16"
              max="120"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="accent-[#1DB954] cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-zinc-300 font-bold">
              <span>Opacity</span>
              <span className="text-[#1DB954] font-mono">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="accent-[#1DB954] cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-zinc-300 font-bold">
              <span>Rotation Angle</span>
              <span className="text-[#1DB954] font-mono">{rotation}°</span>
            </div>
            <input
              type="range"
              min="-90"
              max="90"
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="accent-[#1DB954] cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-300">Watermark Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded border border-zinc-700 cursor-pointer bg-transparent"
              />
              <span className="text-xs font-mono text-zinc-400">{color}</span>
            </div>
          </div>
        </div>

        {/* Position Select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-300">Vertical Alignment</label>
          <div className="grid grid-cols-3 gap-2">
            {(["top", "center", "bottom"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => {
                  soundEffects.playClick();
                  setPosition(pos);
                }}
                className={`py-2 text-xs font-bold capitalize rounded-lg border transition-all ${
                  position === pos
                    ? "bg-[#1DB954] text-black border-[#1DB954]"
                    : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Apply Button */}
        <button
          onClick={handleApply}
          disabled={isProcessing || !text.trim()}
          className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3 rounded-full transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(29,185,84,0.4)] disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4 stroke-[3]" />
          <span>APPLY WATERMARK TO ALL PAGES</span>
        </button>
      </div>

      {/* Right Live Visual Page Preview */}
      <div className="w-full lg:w-1/2 bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center shadow-2xl relative">
        <div className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-wider">
          LIVE INTERACTIVE PREVIEW
        </div>

        {/* Simulated Document Preview Canvas */}
        <div className="w-full max-w-sm aspect-[3/4] bg-white rounded-lg shadow-2xl overflow-hidden relative border border-zinc-300 flex flex-col justify-between p-6">
          {/* Background page thumbnail if available */}
          {activeFile.pageThumbnails[0] ? (
            <img
              src={activeFile.pageThumbnails[0]}
              alt="Page Preview"
              className="absolute inset-0 w-full h-full object-cover opacity-90 pointer-events-none"
            />
          ) : (
            <div className="text-zinc-400 space-y-3 pointer-events-none">
              <div className="h-4 bg-zinc-200 rounded w-3/4" />
              <div className="h-2.5 bg-zinc-200 rounded w-full" />
              <div className="h-2.5 bg-zinc-200 rounded w-5/6" />
              <div className="h-2.5 bg-zinc-200 rounded w-2/3" />
            </div>
          )}

          {/* Watermark Overlay Element */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none p-4"
            style={{
              alignItems:
                position === "top"
                  ? "flex-start"
                  : position === "bottom"
                  ? "flex-end"
                  : "center",
            }}
          >
            <span
              style={{
                color: color,
                fontSize: `${fontSize * 0.45}px`,
                opacity: opacity,
                transform: `rotate(${rotation}deg)`,
                fontWeight: "bold",
                whiteSpace: "nowrap",
                fontFamily: "sans-serif",
                letterSpacing: "0.05em",
                textShadow: "0 0 2px rgba(0,0,0,0.2)",
              }}
            >
              {text || "WATERMARK"}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 mt-4 text-center">
          Real vector text watermark will be stamped directly on every PDF page.
        </p>
      </div>
    </div>
  );
};
