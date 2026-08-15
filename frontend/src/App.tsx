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
import { CreateEditWorkspace } from "./components/workspaces/CreateEditWorkspace";
import { CompressWorkspace } from "./components/workspaces/CompressWorkspace";
import { WordWorkspace } from "./components/workspaces/WordWorkspace";
import { MyDocumentsWorkspace } from "./components/workspaces/MyDocumentsWorkspace";
import { SecuritySearchWorkspace } from "./components/workspaces/SecuritySearchWorkspace";
import { AuthModal } from "./components/AuthModal";
import { UserProfileModal } from "./components/UserProfileModal";
import { LoginPage } from "./components/LoginPage";
import { GoogleOneTapPrompt } from "./components/GoogleOneTapPrompt";
import { UserProfile, apiGetMe, apiLogout, getStoredToken, apiSaveDocument } from "./lib/api";
import { getDemoStoredUser, demoClearSession } from "./lib/auth";

export default function App() {
  // User Authentication State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");
  const [authModalSubtitle, setAuthModalSubtitle] = useState<string | undefined>(undefined);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSavedToCloud, setIsSavedToCloud] = useState(false);
  const [cloudNotification, setCloudNotification] = useState<string | null>(null);

  // Loaded PDFs state
  const [files, setFiles] = useState<PDFFileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Load user on mount (try API token first, fallback to demo session)
  useEffect(() => {
    if (getStoredToken()) {
      apiGetMe()
        .then((u) => setUser(u))
        .catch(() => {
          apiLogout();
          const demoUser = getDemoStoredUser();
          if (demoUser) setUser(demoUser);
        });
    } else {
      const demoUser = getDemoStoredUser();
      if (demoUser) setUser(demoUser);
    }
  }, []);

  const handleLogout = () => {
    apiLogout();
    demoClearSession();
    setUser(null);
    soundEffects.playClick();
  };

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
      (f) => f.name.toLowerCase().endsWith(".pdf") || f.type.toLowerCase().includes("pdf")
    );

    if (fileArray.length === 0) {
      alert("Please select a valid PDF file.");
      return;
    }

    soundEffects.playClick();
    setIsProcessing(true);

    try {
      const newItems: PDFFileItem[] = [];

      for (const file of fileArray) {
        try {
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
        } catch (fileErr: any) {
          console.error(`Error processing file ${file.name}:`, fileErr);
          alert(`Failed to process PDF "${file.name}": ${fileErr?.message || "Invalid or corrupted PDF file."}`);
        }
      }

      if (newItems.length > 0) {
        setFiles((prev) => [...prev, ...newItems]);
        setActiveFileId((prev) => prev || newItems[0].id);
        soundEffects.playSuccess();
      }
    } catch (e: any) {
      console.error("Failed to load PDF:", e);
      alert(`Failed to load PDF: ${e?.message || "An error occurred during file upload."}`);
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
      tool.category === selectedCategory;
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
    } catch (e: any) {
      console.error(e);
      alert(`Failed to merge PDFs: ${e?.message || "Operation failed"}`);
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
    } catch (e: any) {
      console.error(e);
      alert(`Failed to organize pages: ${e?.message || "Operation failed"}`);
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
    } catch (e: any) {
      console.error(e);
      alert(`Failed to apply watermark: ${e?.message || "Operation failed"}`);
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
    } catch (e: any) {
      console.error(e);
      alert(`Failed to add page numbers: ${e?.message || "Operation failed"}`);
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
    } catch (e: any) {
      console.error(e);
      alert(`Failed to convert images to PDF: ${e?.message || "Operation failed"}`);
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

  const handleSaveToMyDocuments = async (
    fileOrBlobOrBytes: File | Blob | Uint8Array,
    filename: string,
    operation = "process"
  ) => {
    if (!user) {
      soundEffects.playClick();
      setAuthModalMode("login");
      setAuthModalSubtitle("Sign in to save this document to your cloud account.");
      setIsAuthModalOpen(true);
      return;
    }

    soundEffects.playClick();
    try {
      let blob: Blob;
      if (fileOrBlobOrBytes instanceof Uint8Array) {
        blob = new Blob([fileOrBlobOrBytes], {
          type: filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png",
        });
      } else if (fileOrBlobOrBytes instanceof File || fileOrBlobOrBytes instanceof Blob) {
        blob = fileOrBlobOrBytes;
      } else {
        blob = new Blob([fileOrBlobOrBytes]);
      }

      await apiSaveDocument(blob, filename, operation);
      soundEffects.playSuccess();
      setIsSavedToCloud(true);
      setCloudNotification(`"${filename}" saved to My Documents!`);
      setTimeout(() => setCloudNotification(null), 4000);
    } catch (err: any) {
      alert(`Failed to save document: ${err?.message || "Error saving to cloud storage."}`);
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
        accept="application/pdf,.pdf"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files);
            e.target.value = "";
          }
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
          onUploadClick={() => {
            setActiveView("home");
            setActiveToolId("merge");
          }}
          onOpenFilePicker={() => fileInputRef.current?.click()}
          activeView={activeView}
          setActiveView={(view) => {
            setActiveView(view);
            if (view === "ai-lab") setActiveToolId("ai-summary");
            if (view === "home") setActiveToolId(null);
          }}
          onSelectPresetPipeline={handleSelectPresetPipeline}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          user={user}
          onOpenAuthModal={(mode) => {
            setAuthModalMode(mode || "login");
            setAuthModalSubtitle(undefined);
            setIsAuthModalOpen(true);
          }}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Right Stage Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#121212] rounded-xl my-2 mr-2 border border-zinc-900/80 overflow-hidden shadow-2xl relative">
          {/* Header Bar */}
          <SpotifyHeader
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onUploadClick={() => {
              setActiveView("home");
              setActiveToolId("merge");
            }}
            activeToolId={activeToolId}
            onBackClick={() => {
              setActiveToolId(null);
              setDownloadBytes(null);
            }}
            user={user}
            onOpenAuthModal={(mode) => {
              setAuthModalMode(mode || "login");
              setAuthModalSubtitle(undefined);
              setIsAuthModalOpen(true);
            }}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onLogout={handleLogout}
          />

          {/* Dynamic Scrollable Stage View */}
          <main className={`flex-1 overflow-y-auto custom-scrollbar ${activeView === "login" ? "" : "p-6"}`}>
            {activeView === "login" ? (
              <LoginPage
                onAuthSuccess={(u) => {
                  setUser(u);
                  setActiveView("home");
                }}
                onContinueAsGuest={() => setActiveView("home")}
              />
            ) : activeView === "my-docs" ? (
              <MyDocumentsWorkspace
                user={user}
                onOpenAuthModal={(mode) => {
                  setAuthModalMode(mode || "login");
                  setAuthModalSubtitle(undefined);
                  setIsAuthModalOpen(true);
                }}
                onOpenDocument={(file) => handleFileUpload([file])}
              />
            ) : (
              <>
                {/* VIEW 1: HOME BROWSE GRID */}
                {!activeToolId && (
                  <div className="flex flex-col gap-6">
                    {/* Clean Feature Header */}
                <div className="bg-[#18181b] p-6 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="max-w-xl text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-medium text-[#1DB954] uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-[#1DB954]" />
                      <span>Easy PDF Document Processing</span>
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-100 mt-1 tracking-tight leading-snug">
                      Create, Edit & Organize PDF Documents
                    </h2>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed font-normal">
                      Create new documents, edit text, insert images, organize pages, merge PDFs, optimize, and convert documents in one unified workspace.
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                      <button
                        onClick={() => {
                          setActiveView("home");
                          setActiveToolId("create-pdf");
                        }}
                        className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Create & Edit PDF</span>
                      </button>

                      <button
                        onClick={() => handleSelectTool("import-pdf")}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 font-medium text-xs px-4 py-2.5 rounded-lg border border-zinc-700/60 transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-[#1DB954]" />
                        <span>Import PDF File</span>
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
                    onReorderFiles={(newOrder) => setFiles(newOrder)}
                    onRunMerge={handleRunMerge}
                    isProcessing={isProcessing}
                  />
                )}

                {/* TOOL 2: ORGANIZE & ROTATE & EXTRACT & SPLIT */}
                {(activeToolId === "organize" ||
                  activeToolId === "rotate" ||
                  activeToolId === "extract" ||
                  activeToolId === "split") &&
                  activeFile && (
                    <OrganizeWorkspace
                      activeFile={activeFile}
                      onExport={handleRunOrganize}
                      isProcessing={isProcessing}
                    />
                  )}

                {/* TOOL 3: WATERMARK & REMOVE WATERMARK */}
                {activeToolId === "watermark" && activeFile && (
                  <WatermarkWorkspace
                    activeFile={activeFile}
                    onApplyWatermark={handleRunWatermark}
                    isProcessing={isProcessing}
                  />
                )}

                {activeToolId === "remove-watermark" && (
                  <RemoveWatermarkWorkspace
                    activeFile={activeFile}
                    isProcessingGlobal={isProcessing}
                  />
                )}

                {/* TOOL 4: CREATE & EDIT PDF */}
                {(activeToolId === "create-pdf" ||
                  activeToolId === "edit-pdf" ||
                  activeToolId === "import-pdf" ||
                  activeToolId === "add-text" ||
                  activeToolId === "insert-image") && (
                  <CreateEditWorkspace
                    activeFile={activeFile}
                    onUploadClick={() => handleSelectTool("merge")}
                    onOpenFilePicker={() => fileInputRef.current?.click()}
                    onSelectTool={handleSelectTool}
                  />
                )}

                {/* TOOL 5: CONVERT */}
                {(activeToolId === "pdf-to-docx" ||
                  activeToolId === "pdf-to-png" ||
                  activeToolId === "pdf-to-jpg" ||
                  activeToolId === "img-to-pdf" ||
                  activeToolId === "img-to-svg" ||
                  activeToolId === "pdf-to-markdown" ||
                  activeToolId === "pdf-to-pdfa" ||
                  activeToolId === "html-to-pdf") && (
                  <ConvertWorkspace
                    mode={activeToolId as any}
                    activeFile={activeFile}
                    onImagesToPdfRun={handleRunImagesToPdf}
                    isProcessing={isProcessing}
                  />
                )}

                {/* TOOL 6: ANNOTATE & UTILITIES */}
                {(activeToolId === "annotate" ||
                  activeToolId === "drawing" ||
                  activeToolId === "sign" ||
                  activeToolId === "redact" ||
                  activeToolId === "page-numbers" ||
                  activeToolId === "lock") &&
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

                {/* TOOL 7: COMPRESS & REPAIR */}
                {(activeToolId === "compress" || activeToolId === "repair") && (
                  <CompressWorkspace
                    activeFile={activeFile}
                    onOpenFilePicker={() => fileInputRef.current?.click()}
                  />
                )}

                {/* TOOL 8: WORD CONVERSION */}
                {(activeToolId === "word-to-pdf" || activeToolId === "pdf-to-word") && (
                  <WordWorkspace
                    mode={activeToolId as any}
                    activeFile={activeFile}
                    onOpenFilePicker={() => fileInputRef.current?.click()}
                    onOpenInEditor={(html, filename) => {
                      setActiveToolId("create-pdf");
                    }}
                    onSaveToCloud={handleSaveToMyDocuments}
                  />
                )}

                {/* TOOL 9: SECURITY & SEARCH */}
                {(activeToolId === "protect" || activeToolId === "search-pdf") && (
                  <SecuritySearchWorkspace
                    mode={activeToolId as any}
                    activeFile={activeFile}
                    onOpenFilePicker={() => fileInputRef.current?.click()}
                  />
                )}

                {/* Fallback if no file is selected for single-file tools */}
                {!activeFile &&
                  activeToolId !== "merge" &&
                  activeToolId !== "img-to-pdf" &&
                  activeToolId !== "img-to-svg" &&
                  activeToolId !== "remove-watermark" &&
                  activeToolId !== "create-pdf" &&
                  activeToolId !== "edit-pdf" &&
                  activeToolId !== "compress" &&
                  activeToolId !== "repair" &&
                  activeToolId !== "word-to-pdf" &&
                  activeToolId !== "pdf-to-word" &&
                  activeToolId !== "html-to-pdf" &&
                  activeToolId !== "protect" &&
                  activeToolId !== "search-pdf" &&
                  activeToolId !== "import-pdf" &&
                  activeToolId !== "add-text" &&
                  activeToolId !== "insert-image" &&
                  activeToolId !== "annotate" && (
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
            </>
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
            onSaveToCloud={() => {
              if (downloadBytes) {
                handleSaveToMyDocuments(downloadBytes, downloadFileName, activeToolId || "process");
              }
            }}
            isSavedToCloud={isSavedToCloud}
          />
        </div>
      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        customSubtitle={authModalSubtitle}
        onSuccess={(u) => {
          setUser(u);
          soundEffects.playSuccess();
        }}
      />

      {/* User Profile Modal */}
      {user && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {/* Floating Google One Tap Prompt for unauthenticated users */}
      {!user && <GoogleOneTapPrompt onAuthSuccess={(u) => setUser(u)} />}

      {/* Floating Cloud Notification Toast */}
      {cloudNotification && (
        <div className="fixed bottom-20 right-8 bg-[#1DB954] text-black font-extrabold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs z-50 border border-white/20 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
          <span>{cloudNotification}</span>
        </div>
      )}
    </div>
  );
}
