import React from "react";
import {
  Layers,
  Scissors,
  Grid,
  Stamp,
  FileText,
  Search,
  ScanText,
  Languages,
  TableProperties,
  Hash,
  PenTool,
  FileImage,
  ImagePlus,
  Lock,
  FileArchive,
  ArrowRight,
  Eraser,
  FileCode,
  FolderOpen,
  Type,
  Edit3,
  RotateCw,
  Code,
  Brush,
  FileSignature,
  ShieldAlert,
  Wrench,
  Sparkles,
  ShieldCheck,
  FileCheck,
  Crop,
  Presentation,
  FileSpreadsheet,
  StickyNote,
} from "lucide-react";
import { PDFTool } from "../types";
import { soundEffects } from "../lib/audio";

interface ToolGridProps {
  tools: PDFTool[];
  onSelectTool: (toolId: string) => void;
  activeFileName?: string;
}

export const ToolGrid: React.FC<ToolGridProps> = ({
  tools,
  onSelectTool,
  activeFileName,
}) => {
  // Map icon strings to Lucide icons
  const renderIcon = (name: string) => {
    const iconClass = "w-5 h-5 text-zinc-200 group-hover:text-[#1DB954] transition-colors";
    switch (name) {
      case "FolderOpen":
        return <FolderOpen className={iconClass} />;
      case "Type":
        return <Type className={iconClass} />;
      case "Layers":
        return <Layers className={iconClass} />;
      case "Scissors":
        return <Scissors className={iconClass} />;
      case "Grid":
        return <Grid className={iconClass} />;
      case "Stamp":
        return <Stamp className={iconClass} />;
      case "FileText":
        return <FileText className={iconClass} />;
      case "Search":
        return <Search className={iconClass} />;
      case "ScanText":
        return <ScanText className={iconClass} />;
      case "Languages":
        return <Languages className={iconClass} />;
      case "TableProperties":
        return <TableProperties className={iconClass} />;
      case "Hash":
        return <Hash className={iconClass} />;
      case "PenTool":
        return <PenTool className={iconClass} />;
      case "FileImage":
        return <FileImage className={iconClass} />;
      case "ImagePlus":
        return <ImagePlus className={iconClass} />;
      case "Lock":
        return <Lock className={iconClass} />;
      case "FileArchive":
        return <FileArchive className={iconClass} />;
      case "FileCode":
        return <FileCode className={iconClass} />;
      case "Eraser":
        return <Eraser className={iconClass} />;
      case "Edit3":
        return <Edit3 className={iconClass} />;
      case "RotateCw":
        return <RotateCw className={iconClass} />;
      case "Code":
        return <Code className={iconClass} />;
      case "Brush":
        return <Brush className={iconClass} />;
      case "FileSignature":
        return <FileSignature className={iconClass} />;
      case "ShieldAlert":
        return <ShieldAlert className={iconClass} />;
      case "Wrench":
        return <Wrench className={iconClass} />;
      case "Sparkles":
        return <Sparkles className={iconClass} />;
      case "ShieldCheck":
        return <ShieldCheck className={iconClass} />;
      case "FileCheck":
        return <FileCheck className={iconClass} />;
      case "Crop":
        return <Crop className={iconClass} />;
      case "Presentation":
        return <Presentation className={iconClass} />;
      case "FileSpreadsheet":
        return <FileSpreadsheet className={iconClass} />;
      case "StickyNote":
        return <StickyNote className={iconClass} />;
      default:
        return <FileText className={iconClass} />;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {tools.map((tool) => (
        <div
          key={tool.id}
          onClick={() => {
            soundEffects.playClick();
            onSelectTool(tool.id);
          }}
          className="group relative bg-[#18181b] hover:bg-[#222226] p-5 rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between border border-zinc-800/80 hover:border-zinc-700"
        >
          <div>
            {/* Header: Icon container & Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center group-hover:border-zinc-600 transition-colors">
                {renderIcon(tool.iconName)}
              </div>

              {tool.badge && (
                <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700/50 uppercase tracking-wider">
                  {tool.badge}
                </span>
              )}
            </div>

            {/* Title & Description */}
            <div>
              <h3 className="text-zinc-100 font-bold text-sm tracking-tight flex items-center justify-between">
                <span>{tool.title}</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 group-hover:text-[#1DB954] group-hover:translate-x-0.5 transition-all" />
              </h3>
              <p className="text-zinc-400 text-xs line-clamp-2 mt-1.5 leading-relaxed font-normal">
                {tool.description}
              </p>
            </div>
          </div>

          {/* Minimal metadata footer */}
          <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span>Ready</span>
            {activeFileName ? (
              <span className="text-[#1DB954] truncate max-w-[120px]">
                {activeFileName}
              </span>
            ) : (
              <span className="text-zinc-500">Select File</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
