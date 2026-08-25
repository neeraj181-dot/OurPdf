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
  Crop,
  Presentation,
  FileSpreadsheet,
  StickyNote,
} from "lucide-react";
import { PDFTool, ToolCategory } from "../types";
import { soundEffects } from "../lib/audio";

interface ToolGridProps {
  tools: PDFTool[];
  onSelectTool: (toolId: string) => void;
  activeFileName?: string;
  groupByCategory?: boolean;
}

export const ToolGrid: React.FC<ToolGridProps> = ({
  tools,
  onSelectTool,
  groupByCategory = false,
}) => {
  // Map icon strings to monochrome line icons
  const renderIcon = (name: string) => {
    const iconClass = "w-4 h-4 text-zinc-400 group-hover:text-zinc-100 transition-colors";
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

  const categoryTitles: Record<string, string> = {
    create: "Create & Edit",
    pages: "Organize",
    convert: "Convert",
    enhance: "Optimize",
    security: "Security",
  };

  const renderCard = (tool: PDFTool) => (
    <div
      key={tool.id}
      onClick={() => {
        soundEffects.playClick();
        onSelectTool(tool.id);
      }}
      className="group bg-[#17191b] hover:bg-[#1d2023] p-4 rounded-lg cursor-pointer transition-colors duration-150 flex flex-col justify-between border border-[#292c30] hover:border-[#3e4248] min-h-[136px]"
    >
      <div>
        {/* Compact 32px Icon container */}
        <div className="w-8 h-8 rounded-md bg-[#121315] border border-[#292c30] flex items-center justify-center mb-3 group-hover:border-[#3e4248] transition-colors">
          {renderIcon(tool.iconName)}
        </div>

        {/* Title & Description */}
        <h3 className="text-[#f1f3f5] font-semibold text-sm tracking-tight leading-tight">
          {tool.title}
        </h3>
        <p className="text-[#9aa0a6] text-xs leading-relaxed line-clamp-2 mt-1.5 font-normal">
          {tool.description}
        </p>
      </div>

      {/* Clean Bottom Action Row */}
      <div className="mt-3 pt-2.5 border-t border-[#292c30]/50 flex items-center justify-end">
        <span className="text-[11px] font-medium text-zinc-500 group-hover:text-[#1db954] flex items-center gap-1 transition-colors">
          <span>Open</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </div>
  );

  if (groupByCategory) {
    const categories: ToolCategory[] = ["create", "pages", "convert", "enhance", "security"];
    return (
      <div className="flex flex-col gap-8">
        {categories.map((cat) => {
          const categoryTools = tools.filter((t) => t.category === cat);
          if (categoryTools.length === 0) return null;

          return (
            <div key={cat} className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1 border-b border-[#292c30]/60">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                  {categoryTitles[cat] || cat}
                </h2>
                <span className="text-xs text-zinc-500 font-mono">
                  {categoryTools.length} tool{categoryTools.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {categoryTools.map(renderCard)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {tools.map(renderCard)}
    </div>
  );
};

