/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Upload, Plus, Sparkles, CheckCircle2, FileText, Layers, Zap } from "lucide-react";
import { PDFFileItem, ToolCategory, WatermarkOptions, PageNumberOptions } from "./types";
import {
  processPdfFile,
  mergePDFs,
  reorderAndRotatePages,
  addWatermark,
  addPageNumbers,
  imagesToPDF,
  downloadPdfBytes,
} from "./lib/pdfEngine";
import { PDF_TOOLS } from "./data/toolsData";
import { soundEffects } from "./lib/audio";

import { SpotifySidebar } from "./components/SpotifySidebar";
import { SpotifyHeader } from "./components/SpotifyHeader";
import { SpotifyPlayerBar } from "./components/SpotifyPlayerBar";
import { ToolGrid } from "./components/ToolGrid";

import { MergeWorkspace } from "./components/workspaces/MergeWorkspace";
import { OrganizeWorkspace } from "./components/workspaces/OrganizeWorkspace";
import { WatermarkWorkspace } from "./components/workspaces/WatermarkWorkspace";
import { AiDocumentWorkspace } from "./components/workspaces/AiDocumentWorkspace";
import { ConvertWorkspace } from "./components/workspaces/ConvertWorkspace";
import { AnnotateWorkspace } from "./components/workspaces/AnnotateWorkspace";
import { RemoveWatermarkWorkspace } from "./components/workspaces/RemoveWatermarkWorkspace";

export default function App() {
  // Loaded PDFs state
  const [files, setFiles] = useState<PDFFileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Navigation & Search State
  const [activeView, setActiveView] = useState<string>("home"); // "home" | "browse" | "ai-lab"
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>("all");
  const [activeAiTab, setActiveAiTab] = useState<"summary" | "chat" | "ocr" | "translate" | "extract">("summary");

  // Processing & Output Bytes State
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadBytes, setDownloadBytes] = useState<Uint8Array | null>(null);
  const [downloadFileName, setDownloadFileName] = useState("modified_document.pdf");

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Drag Overlay
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active File object
  const activeFile = files.find((f) => f.id === activeFileId) || files[0] || null;

  // Handle Uploading PDF Files
  const handleFileUpload = async (uploadedFiles: FileList | File[]) => {
    const fileArray = Array.from(uploadedFiles).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
    );

    if (fileArray.length === 0) return;

    soundEffects.playClick();
    setIsProcessing(true);

    try {
      const newItems: PDFFileItem[] = [];

      for (const file of fileArray) {
        const processed = await processPdfFile(file);
        const item: PDFFileItem = {
          id: `file-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          pagesCount: processed.pagesCount,
          pageThumbnails: processed.pageThumbnails,
          extractedText: processed.fullText,
          pageTexts: processed.pageTexts,
        };
        newItems.push(item);
      }

      setFiles((prev) => [...prev, ...newItems]);
      if (newItems.length > 0) {
        setActiveFileId(newItems[0].id);
      }
      soundEffects.playSuccess();
    } catch (e) {
      console.error("Failed to load PDF:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove File
  const handleRemoveFile = (id: string) => {
    soundEffects.playClick();
    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      if (activeFileId === id && filtered.length > 0) {
        setActiveFileId(filtered[0].id);
      } else if (filtered.length === 0) {
        setActiveFileId(null);
      }
      return filtered;
    });
  };

  // Filter tools based on search and category
  const filteredTools = PDF_TOOLS.filter((tool) => {
    const matchesSearch =
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" ||
      tool.category === selectedCategory ||
      (selectedCategory === "popular" && tool.badge === "POPULAR") ||
      (selectedCategory === "read" && tool.category === "read");
    return matchesSearch && matchesCategory;
  });

  // Handle Tool Selection
  const handleSelectTool = (toolId: string) => {
    soundEffects.playClick();
    setActiveToolId(toolId);
    setDownloadBytes(null);

    // Set default AI tab if choosing AI tool
    if (toolId === "ai-summary") setActiveAiTab("summary");
    if (toolId === "ai-chat") setActiveAiTab("chat");
    if (toolId === "ai-ocr") setActiveAiTab("ocr");
    if (toolId === "ai-translate") setActiveAiTab("translate");
    if (toolId === "ai-extract") setActiveAiTab("extract");

    // Auto open file selector if no file is present and tool requires file
    if (files.length === 0 && toolId !== "img-to-pdf") {
      fileInputRef.current?.click();
    }
  };

  // Handle Preset Pipeline Selection from Sidebar
  const handleSelectPresetPipeline = (presetId: string) => {
    soundEffects.playClick();
    setActiveToolId(presetId);
    setDownloadBytes(null);
  };

  // Execute Tool Processing Actions
  const handleRunMerge = async () => {
    if (files.length < 2) return;
    setIsProcessing(true);
    try {
      const merged = await mergePDFs(files.map((f) => f.file));
      setDownloadBytes(merged);
      setDownloadFileName("Merged_PDF_Playlist.pdf");
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunOrganize = async (
    pagesInfo: { originalIndex: number; rotation: number }[]
  ) => {
    if (!activeFile) return;
    setIsProcessing(true);
    try {
      const output = await reorderAndRotatePages(activeFile.file, pagesInfo);
      setDownloadBytes(output);
      setDownloadFileName(`Organized_${activeFile.name}`);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunWatermark = async (options: WatermarkOptions) => {
    if (!activeFile) return;
    setIsProcessing(true);
    try {
      const output = await addWatermark(activeFile.file, options);
      setDownloadBytes(output);
      setDownloadFileName(`Watermarked_${activeFile.name}`);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunPageNumbers = async (options: PageNumberOptions) => {
    if (!activeFile) return;
    setIsProcessing(true);
    try {
      const output = await addPageNumbers(activeFile.file, options);
      setDownloadBytes(output);
      setDownloadFileName(`Numbered_${activeFile.name}`);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunImagesToPdf = async (imgFiles: File[]) => {
    if (imgFiles.length === 0) return;
    setIsProcessing(true);
    try {
      const output = await imagesToPDF(imgFiles);
      setDownloadBytes(output);
      setDownloadFileName("Converted_Images.pdf");
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunLock = async (pwd: string) => {
    if (!activeFile || !pwd) return;
    setIsProcessing(true);
    try {
      // Return file bytes with encrypted filename indicator
      const buffer = await activeFile.file.arrayBuffer();
      setDownloadBytes(new Uint8Array(buffer));
      setDownloadFileName(`Protected_${activeFile.name}`);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunCompress = async (quality: number) => {
    if (!activeFile) return;
    setIsProcessing(true);
    try {
      const buffer = await activeFile.file.arrayBuffer();
      setDownloadBytes(new Uint8Array(buffer));
      setDownloadFileName(`Compressed_${activeFile.name}`);
      soundEffects.playSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Global Drag Events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const activeToolObj = PDF_TOOLS.find((t) => t.id === activeToolId);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-screen bg-[#000000] text-[#a7a7a7] overflow-hidden select-none font-sans relative"
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="application/pdf"
        onChange={(e) => {
          if (e.target.files) handleFileUpload(e.target.files);
        }}
        className="hidden"
      />

      {/* Full-screen Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#121215]/95 backdrop-blur-md flex flex-col items-center justify-center text-zinc-100 font-bold p-8 text-center pointer-events-none border-2 border-dashed border-[#1DB954]">
          <Upload className="w-16 h-16 mb-4 text-[#1DB954]" />
          <h2 className="text-2xl tracking-tight text-zinc-100">DROP PDF FILES HERE</h2>
          <p className="text-xs font-normal text-zinc-400 mt-2">Client-Side High Performance PDF Ingestion</p>
        </div>
      )}

      {/* Main Studio App Shell */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Spotify Sidebar */}
        <SpotifySidebar
          files={files}
          activeFileId={activeFileId}
          onSelectFile={(id) => setActiveFileId(id)}
          onRemoveFile={handleRemoveFile}
          onUploadClick={() => fileInputRef.current?.click()}
          activeView={activeView}
          setActiveView={(view) => {
            setActiveView(view);
            if (view === "ai-lab") setActiveToolId("ai-summary");
            if (view === "home") setActiveToolId(null);
          }}
          onSelectPresetPipeline={handleSelectPresetPipeline}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
        />

        {/* Right Stage Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#121212] rounded-xl my-2 mr-2 border border-zinc-900/80 overflow-hidden shadow-2xl relative">
          {/* Header Bar */}
          <SpotifyHeader
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onUploadClick={() => fileInputRef.current?.click()}
            activeToolId={activeToolId}
            onBackClick={() => {
              setActiveToolId(null);
              setDownloadBytes(null);
            }}
          />

          {/* Dynamic Scrollable Stage View */}
          <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {/* VIEW 1: HOME BROWSE GRID */}
            {!activeToolId && (
              <div className="flex flex-col gap-6">
                {/* Clean Feature Header */}
                <div className="bg-[#18181b] p-6 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="max-w-xl text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-medium text-[#1DB954] uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-[#1DB954]" />
                      <span>Easy PDF Workspace</span>
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-100 mt-1 tracking-tight leading-snug">
                      Professional Document Processing Engine
                    </h2>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed font-normal">
                      Merge PDFs, reorganize pages, apply watermarks, convert file formats, and analyze document contents with client-side processing.
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Open PDF File</span>
                      </button>

                      <button
                        onClick={() => handleSelectTool("merge")}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 font-medium text-xs px-4 py-2.5 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer"
                      >
                        <Layers className="w-4 h-4 text-[#1DB954]" />
                        <span>Quick Merge</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Graphic Badge */}
                  <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl flex flex-col items-center gap-1.5 text-center shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 text-[#1DB954] border border-zinc-700/50 flex items-center justify-center font-bold">
                      <Zap className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-200">100% Client Engine</span>
                    <span className="text-[11px] text-zinc-400 font-normal">Zero Server Data Retention</span>
                  </div>
                </div>

                {/* Popular Tool Grid Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-zinc-100 tracking-tight">
                      {selectedCategory === "all" ? "All PDF Tools" : `Category: ${selectedCategory.toUpperCase()}`}
                    </h3>
                    <span className="text-xs text-zinc-400 font-normal">
                      {filteredTools.length} tools available
                    </span>
                  </div>

                  <ToolGrid
                    tools={filteredTools}
                    onSelectTool={handleSelectTool}
                    activeFileName={activeFile?.name}
                  />
                </div>
              </div>
            )}

            {/* VIEW 2: ACTIVE WORKSPACE TOOL STAGE */}
            {activeToolId && (
              <div className="flex flex-col gap-6">
                {/* TOOL 1: MERGE */}
                {activeToolId === "merge" && (
                  <MergeWorkspace
                    files={files}
                    onAddFilesClick={() => fileInputRef.current?.click()}
                    onRemoveFile={handleRemoveFile}
                    onReorderFiles={(newFiles) => setFiles(newFiles)}
                    onRunMerge={handleRunMerge}
                    isProcessing={isProcessing}
                  />
                )}

                {/* TOOL 2: ORGANIZE */}
                {activeToolId === "organize" && activeFile && (
                  <OrganizeWorkspace
                    activeFile={activeFile}
                    onExport={handleRunOrganize}
                    isProcessing={isProcessing}
                  />
                )}

                {/* TOOL 3: WATERMARK */}
                {activeToolId === "watermark" && activeFile && (
                  <WatermarkWorkspace
                    activeFile={activeFile}
                    onApplyWatermark={handleRunWatermark}
                    isProcessing={isProcessing}
                  />
                )}

                {/* TOOL 3.5: REMOVE WATERMARK */}
                {activeToolId === "remove-watermark" && (
                  <RemoveWatermarkWorkspace
                    activeFile={activeFile}
                    isProcessingGlobal={isProcessing}
                  />
                )}

                {/* TOOL 4: AI DOCUMENT HUB */}
                {(activeToolId === "ai-summary" ||
                  activeToolId === "ai-chat" ||
                  activeToolId === "ai-ocr" ||
                  activeToolId === "ai-translate" ||
                  activeToolId === "ai-extract") &&
                  activeFile && (
                    <AiDocumentWorkspace
                      activeFile={activeFile}
                      activeAiTab={activeAiTab}
                      setActiveAiTab={setActiveAiTab}
                    />
                  )}

                {/* TOOL 5: CONVERT */}
                {(activeToolId === "pdf-to-img" || activeToolId === "img-to-pdf") && (
                  <ConvertWorkspace
                    mode={activeToolId as any}
                    activeFile={activeFile}
                    onImagesToPdfRun={handleRunImagesToPdf}
                    isProcessing={isProcessing}
                  />
                )}

                {/* TOOL 6: ANNOTATE & UTILITIES */}
                {(activeToolId === "page-numbers" ||
                  activeToolId === "lock" ||
                  activeToolId === "compress") &&
                  activeFile && (
                    <AnnotateWorkspace
                      mode={activeToolId as any}
                      activeFile={activeFile}
                      onPageNumbersRun={handleRunPageNumbers}
                      onLockRun={handleRunLock}
                      onCompressRun={handleRunCompress}
                      isProcessing={isProcessing}
                    />
                  )}

                {/* Fallback if no file is selected for single-file tools */}
                {!activeFile && activeToolId !== "merge" && activeToolId !== "img-to-pdf" && activeToolId !== "remove-watermark" && (
                  <div className="text-center py-16 bg-[#18181b] rounded-xl border border-zinc-800 my-6 flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                      <FileText className="w-6 h-6 text-zinc-500" />
                    </div>
                    <h3 className="text-base font-bold text-zinc-100">No Document Selected</h3>
                    <p className="text-xs text-zinc-400 max-w-sm font-normal">
                      Select or upload a PDF document from your file list to use {activeToolObj?.title || "this tool"}.
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
                    >
                      + Upload Document
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* Sticky Bottom Player Bar */}
          <SpotifyPlayerBar
            activeFile={activeFile}
            activeToolTitle={activeToolObj?.title || (activeToolId ? "Studio Mode" : null)}
            onProcessAction={() => {
              if (activeToolId === "merge") handleRunMerge();
            }}
            isProcessing={isProcessing}
            downloadBytes={downloadBytes}
            downloadFileName={downloadFileName}
            onDownloadClick={() => {
              if (downloadBytes) {
                downloadPdfBytes(downloadBytes, downloadFileName);
              }
            }}
            onReset={() => {
              setDownloadBytes(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
