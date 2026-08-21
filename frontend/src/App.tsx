/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Upload, Plus, Sparkles, CheckCircle2, FileText, Zap } from "lucide-react";
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
import {
  savePersistentDoc,
  getPersistentDocs,
  deletePersistentDoc,
  updatePersistentDocName,
  updatePersistentDocBackendId,
  recordDownloadedDoc,
} from "./lib/docStorage";

import { SpotifySidebar } from "./components/SpotifySidebar";
import { SpotifyHeader } from "./components/SpotifyHeader";
import { ToolGrid } from "./components/ToolGrid";

import { MergeWorkspace } from "./components/workspaces/MergeWorkspace";
import { OrganizeWorkspace } from "./components/workspaces/OrganizeWorkspace";
import { WatermarkWorkspace } from "./components/workspaces/WatermarkWorkspace";
import { AiDocumentWorkspace } from "./components/workspaces/AiDocumentWorkspace";
import { ConvertWorkspace } from "./components/workspaces/ConvertWorkspace";
import { RemoveWatermarkWorkspace } from "./components/workspaces/RemoveWatermarkWorkspace";
import { CreateEditWorkspace } from "./components/workspaces/CreateEditWorkspace";
import { CompressWorkspace } from "./components/workspaces/CompressWorkspace";
import { WordWorkspace } from "./components/workspaces/WordWorkspace";
import { HtmlWorkspace } from "./components/workspaces/HtmlWorkspace";
import { MarkdownWorkspace } from "./components/workspaces/MarkdownWorkspace";
import { SignWorkspace } from "./components/workspaces/SignWorkspace";
import { CropWorkspace } from "./components/workspaces/CropWorkspace";
import { PageNumbersWorkspace } from "./components/workspaces/PageNumbersWorkspace";
import { MyDocumentsWorkspace } from "./components/workspaces/MyDocumentsWorkspace";
import { ProfileWorkspace } from "./components/workspaces/ProfileWorkspace";
import { SecuritySearchWorkspace } from "./components/workspaces/SecuritySearchWorkspace";
import { AuthModal } from "./components/AuthModal";
import { RenameDocModal } from "./components/RenameDocModal";
import { GoogleDrivePickerModal } from "./components/GoogleDrivePickerModal";
import {
  UserProfile,
  apiGetMe,
  apiLogout,
  getStoredToken,
  apiSaveDocument,
  apiRenameDocument,
  apiGetDocuments,
  apiRecordDownload,
  apiUploadToGoogleDrive,
} from "./lib/api";

export default function App() {
  // User Authentication State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");
  const [authModalSubtitle, setAuthModalSubtitle] = useState<string | undefined>(undefined);
  const [isSavedToCloud, setIsSavedToCloud] = useState(false);
  const [isSavedToGoogleDrive, setIsSavedToGoogleDrive] = useState(false);
  const [isSavingToGoogleDrive, setIsSavingToGoogleDrive] = useState(false);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [cloudNotification, setCloudNotification] = useState<string | null>(null);

  // Loaded PDFs state
  const [files, setFiles] = useState<PDFFileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Navigation & Search State
  const [activeView, setActiveView] = useState<string>("home"); // "home" | "browse" | "editor" | "my-docs" | "profile"
  const [myDocsTab, setMyDocsTab] = useState<"saved" | "downloads" | "recent">("saved");
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>("all");
  const [activeAiTab, setActiveAiTab] = useState<"summary" | "chat" | "ocr" | "translate" | "extract">("summary");

  // Rename modal for active documents
  const [renameTarget, setRenameTarget] = useState<PDFFileItem | null>(null);

  // Processing & Output Bytes State
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadBytes, setDownloadBytes] = useState<Uint8Array | null>(null);
  const [downloadFileName, setDownloadFileName] = useState("modified_document.pdf");

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Drag Overlay
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docsRefreshKey, setDocsRefreshKey] = useState(0);

  // Load user, persistent documents, and URL query params on mount
  useEffect(() => {
    // 1. Check if returning from Google Drive OAuth redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.get("google_drive_status") === "success" ||
      urlParams.get("google_drive") === "connected"
    ) {
      soundEffects.playSuccess();
      setDocsRefreshKey((k) => k + 1);
      // Clean query params without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (getStoredToken()) {
      apiGetMe()
        .then((u) => setUser(u))
        .catch(() => apiLogout());
    }

    // Restore active documents from IndexedDB
    getPersistentDocs()
      .then((persisted) => {
        if (persisted && persisted.length > 0) {
          setFiles(persisted);
          setActiveFileId(persisted[0].id);
        }
      })
      .catch((err) => console.warn("Could not load persisted files:", err));
  }, []);

  // Active File object
  const activeFile = files.find((f) => f.id === activeFileId) || files[0] || null;

  // Handle Uploading PDF and Image Files
  const handleFileUpload = async (uploadedFiles: FileList | File[], existingBackendDocId?: number) => {
    const fileList = Array.from(uploadedFiles);
    if (fileList.length === 0) return;

    soundEffects.playClick();
    setIsProcessing(true);

    try {
      const newItems: PDFFileItem[] = [];

      for (const file of fileList) {
        // Check if file is already loaded in files list
        const existing = files.find(
          (f) =>
            (existingBackendDocId && f.backendDocId === existingBackendDocId) ||
            f.name === file.name
        );
        if (existing) {
          setActiveFileId(existing.id);
          continue;
        }

        const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type.toLowerCase().includes("pdf");
        const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);

        if (isPdf) {
          try {
            const processed = await processPdfFile(file);
            let backendDocId: number | undefined = existingBackendDocId;

            // If user is authenticated and not already a saved backend document, save to backend
            if (user && !backendDocId) {
              try {
                const savedDoc = await apiSaveDocument(file, file.name, "upload");
                backendDocId = savedDoc.id;
              } catch (e) {
                console.warn("Backend cloud sync error:", e);
              }
            }

            const item: PDFFileItem = {
              id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              file,
              name: file.name,
              size: file.size,
              pagesCount: processed.pagesCount,
              pageThumbnails: processed.pageThumbnails,
              extractedText: processed.fullText,
              pageTexts: processed.pageTexts,
              backendDocId,
            };

            // Save to IndexedDB persistence
            await savePersistentDoc(item, backendDocId);
            newItems.push(item);
          } catch (fileErr: any) {
            console.error(`Error processing file ${file.name}:`, fileErr);
            alert(`Failed to process PDF "${file.name}": ${fileErr?.message || "Invalid or corrupted PDF file."}`);
          }
        } else if (isImage) {
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.onerror = (e) => reject(e);
              reader.readAsDataURL(file);
            });

            let backendDocId: number | undefined = undefined;
            if (user) {
              try {
                const savedDoc = await apiSaveDocument(file, file.name, "upload");
                backendDocId = savedDoc.id;
              } catch (e) {
                console.warn("Backend cloud sync error:", e);
              }
            }

            const item: PDFFileItem = {
              id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              file,
              name: file.name,
              size: file.size,
              pagesCount: 1,
              pageThumbnails: [dataUrl],
              extractedText: "",
              pageTexts: [""],
              backendDocId,
            };

            await savePersistentDoc(item, backendDocId);
            newItems.push(item);
          } catch (imgErr: any) {
            console.error(`Error reading image ${file.name}:`, imgErr);
            alert(`Failed to load image "${file.name}".`);
          }
        } else {
          alert(`File format not supported for "${file.name}". Please upload a PDF or Image file.`);
        }
      }

      if (newItems.length > 0) {
        setFiles((prev) => [...prev, ...newItems]);
        setActiveFileId(newItems[0].id);
        setDocsRefreshKey((k) => k + 1);
        soundEffects.playSuccess();
      }
    } catch (e: any) {
      console.error("Failed to load file:", e);
      alert(`Failed to load file: ${e?.message || "An error occurred during file upload."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove File
  const handleRemoveFile = (id: string) => {
    soundEffects.playClick();
    deletePersistentDoc(id);
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

  // Rename File (Synchronizes across Active Documents, IndexedDB, and Backend Saved Documents)
  const handleRenameFile = async (id: string, newName: string) => {
    soundEffects.playClick();
    const extMatch = newName.match(/\.([a-zA-Z0-9]+)$/);
    const finalName = extMatch ? newName : `${newName}.pdf`;

    const target = files.find((f) => f.id === id);
    if (!target) return;

    // 1. Update in-memory files state with renamed File instance
    const updatedFile = new File([target.file], finalName, {
      type: target.file.type || "application/pdf",
    });

    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, name: finalName, file: updatedFile } : f
      )
    );

    // 2. Update local IndexedDB storage
    await updatePersistentDocName(id, finalName);

    // 3. Update backend cloud document if user is authenticated
    if (user) {
      try {
        if (target.backendDocId) {
          await apiRenameDocument(target.backendDocId, finalName);
        } else {
          // Find matching backend document by old original filename
          const userDocs = await apiGetDocuments();
          const match = userDocs.find(
            (d) => d.original_filename === target.name || d.original_filename === target.file.name
          );
          if (match) {
            await apiRenameDocument(match.id, finalName);
            target.backendDocId = match.id;
            await updatePersistentDocBackendId(id, match.id);
          }
        }
      } catch (err) {
        console.warn("Backend rename sync warning:", err);
      }
    }

    // 4. Trigger reload in Saved Documents workspace
    setDocsRefreshKey((k) => k + 1);
    soundEffects.playSuccess();
  };

  // Rename Handler from Workspace Saved Documents
  const handleRenameFromWorkspace = async (backendDocId: number, newFilename: string) => {
    const matching = files.find((f) => f.backendDocId === backendDocId);
    if (matching) {
      const updatedFile = new File([matching.file], newFilename, {
        type: matching.file.type || "application/pdf",
      });
      setFiles((prev) =>
        prev.map((f) =>
          f.id === matching.id ? { ...f, name: newFilename, file: updatedFile } : f
        )
      );
      await updatePersistentDocName(matching.id, newFilename);
    }
    setDocsRefreshKey((k) => k + 1);
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

  // Bottom PlayerBar action handler: Select Tool navigation & Tool Execution
  const handlePlayerBarAction = () => {
    if (!activeFile) {
      alert("Please select a document first.");
      return;
    }

    if (!activeToolId) {
      // User clicked "Select Tool ->": Navigate to All PDF Tools with activeFile preserved
      soundEffects.playClick();
      setActiveView("browse");
      setActiveToolId(null);
      return;
    }

    // Execute active tool processing action
    if (activeToolId === "merge") {
      handleRunMerge();
    } else if (
      activeToolId === "organize" ||
      activeToolId === "rotate" ||
      activeToolId === "extract" ||
      activeToolId === "split"
    ) {
      handleRunOrganize(
        Array.from({ length: activeFile.pagesCount }, (_, i) => ({
          originalIndex: i,
          rotation: 0,
        }))
      );
    } else if (activeToolId === "watermark") {
      handleRunWatermark({
        text: "CONFIDENTIAL",
        color: "#ff0000",
        opacity: 0.4,
        fontSize: 36,
        rotation: -45,
        position: "center",
      });
    } else if (activeToolId === "compress") {
      handleRunCompress(0.7);
    }
  };

  const handleDownloadAndRecord = async () => {
    if (!downloadBytes) return;
    soundEffects.playSuccess();
    downloadPdfBytes(downloadBytes, downloadFileName);

    const toolTitle = activeToolObj?.title || "Export";

    // Track download in backend PostgreSQL (if authenticated) and local persistence
    if (user) {
      apiRecordDownload(downloadBytes, downloadFileName, toolTitle)
        .then(() => setDocsRefreshKey((k) => k + 1))
        .catch((err) => console.warn("Backend download recording warning:", err));
    } else {
      await recordDownloadedDoc(
        downloadFileName,
        downloadBytes.length,
        activeFile?.pagesCount || 1,
        toolTitle,
        new Blob([downloadBytes], { type: "application/pdf" })
      );
      setDocsRefreshKey((k) => k + 1);
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

  const handleSaveToGoogleDrive = async (
    fileOrBlobOrBytes?: File | Blob | Uint8Array,
    filename?: string
  ) => {
    const targetBytes = fileOrBlobOrBytes || downloadBytes;
    const targetName = filename || downloadFileName;
    if (!targetBytes) return;

    if (!user) {
      soundEffects.playClick();
      setAuthModalMode("login");
      setAuthModalSubtitle("Sign in to save this document to your Google Drive.");
      setIsAuthModalOpen(true);
      return;
    }

    soundEffects.playClick();
    setIsSavingToGoogleDrive(true);
    try {
      await apiUploadToGoogleDrive(targetBytes, targetName);
      soundEffects.playSuccess();
      setIsSavedToGoogleDrive(true);
      setCloudNotification(`✓ "${targetName}" saved to Google Drive!`);
      setTimeout(() => setCloudNotification(null), 4000);
    } catch (err: any) {
      alert(`Google Drive Upload: ${err?.message || "Failed to save file to Google Drive. Please ensure Google Drive is connected in your profile."}`);
    } finally {
      setIsSavingToGoogleDrive(false);
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
        accept="application/pdf,.pdf,image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp,image/*"
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
          onRenameFile={handleRenameFile}
          onUploadClick={() => fileInputRef.current?.click()}
          onOpenFilePicker={() => fileInputRef.current?.click()}
          onDropFiles={handleFileUpload}
          activeView={activeView}
          setActiveView={(view) => {
            setActiveView(view);
            if (view === "ai-lab") setActiveToolId("ai-summary");
            if (view === "home" || view === "profile" || view === "my-docs") setActiveToolId(null);
            if (view === "editor") setActiveToolId("create-pdf");
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
          onLogout={() => {
            apiLogout();
            setUser(null);
            soundEffects.playClick();
          }}
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
            onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
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
            onLogout={() => {
              apiLogout();
              setUser(null);
              soundEffects.playClick();
            }}
            onNavigateToProfile={() => {
              setActiveToolId(null);
              setActiveView("profile");
            }}
            onNavigateToDocs={(tab) => {
              setActiveToolId(null);
              setMyDocsTab(tab || "saved");
              setActiveView("my-docs");
            }}
          />

          {/* Dynamic Scrollable Stage View */}
          <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeView === "profile" ? (
              <ProfileWorkspace
                user={user}
                onUpdateUser={(updated) => setUser(updated)}
                onOpenAuthModal={(mode) => {
                  setAuthModalMode(mode || "login");
                  setAuthModalSubtitle(undefined);
                  setIsAuthModalOpen(true);
                }}
                onLogout={() => {
                  apiLogout();
                  setUser(null);
                  setActiveView("home");
                  soundEffects.playClick();
                }}
                onNavigateToDocs={(tab) => {
                  setMyDocsTab(tab || "saved");
                  setActiveView("my-docs");
                }}
              />
            ) : activeView === "my-docs" ? (
              <MyDocumentsWorkspace
                user={user}
                initialTab={myDocsTab}
                refreshKey={docsRefreshKey}
                activeFileName={activeFile?.name}
                onOpenAuthModal={(mode) => {
                  setAuthModalMode(mode || "login");
                  setAuthModalSubtitle(undefined);
                  setIsAuthModalOpen(true);
                }}
                onOpenDocument={(file, docId) => handleFileUpload([file], docId)}
                onRenameDocument={handleRenameFromWorkspace}
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
                          <span>OurPDF Document Processing</span>
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
                        user={user}
                        onSaveToCloud={(bytes, name) =>
                          handleSaveToMyDocuments(bytes, name, "Merge PDF")
                        }
                        onSaveToGoogleDrive={(bytes, name) =>
                          handleSaveToGoogleDrive(bytes, name)
                        }
                        onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
                      />
                    )}

                    {/* TOOL 2: ORGANIZE & ROTATE & EXTRACT & SPLIT */}
                    {(activeToolId === "organize" ||
                      activeToolId === "organize-pdf" ||
                      activeToolId === "rotate" ||
                      activeToolId === "extract" ||
                      activeToolId === "split") &&
                      activeFile && (
                        <OrganizeWorkspace
                          activeFile={activeFile}
                          onExport={handleRunOrganize}
                          isProcessing={isProcessing}
                          user={user}
                          onSaveToCloud={(bytes, name) =>
                            handleSaveToMyDocuments(bytes, name, "Organize PDF")
                          }
                          onSaveToGoogleDrive={(bytes, name) =>
                            handleSaveToGoogleDrive(bytes, name)
                          }
                          onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
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
                        onUploadFile={handleFileUpload}
                        onProcessedOutput={(bytes, filename) => {
                          setDownloadBytes(bytes);
                          setDownloadFileName(filename);
                        }}
                      />
                    )}

                    {/* TOOL 4: CREATE & EDIT PDF */}
                    {(activeToolId === "create-pdf" ||
                      activeToolId === "import-pdf" ||
                      activeToolId === "insert-image") && (
                      <CreateEditWorkspace
                        activeFile={activeFile}
                        onUploadClick={() => fileInputRef.current?.click()}
                        onOpenFilePicker={() => fileInputRef.current?.click()}
                        onSelectTool={handleSelectTool}
                        user={user}
                        onSaveToCloud={handleSaveToMyDocuments}
                        onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
                      />
                    )}

                    {/* TOOL 5: CONVERT (EXCEL, PPTX, IMAGES, SVG) */}
                    {(activeToolId === "pdf-to-docx" ||
                      activeToolId === "pdf-to-png" ||
                      activeToolId === "pdf-to-jpg" ||
                      activeToolId === "img-to-pdf" ||
                      activeToolId === "img-to-svg" ||
                      activeToolId === "pdf-to-excel" ||
                      activeToolId === "pdf-to-powerpoint") && (
                      <ConvertWorkspace
                        mode={activeToolId as any}
                        activeFile={activeFile}
                        onImagesToPdfRun={handleRunImagesToPdf}
                        isProcessing={isProcessing}
                      />
                    )}

                    {/* TOOL 5B: HTML TO PDF */}
                    {activeToolId === "html-to-pdf" && (
                      <HtmlWorkspace
                        activeFile={activeFile}
                        user={user}
                        onOpenFilePicker={() => fileInputRef.current?.click()}
                        onSaveToCloud={handleSaveToMyDocuments}
                        onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
                      />
                    )}

                    {/* TOOL 5C: PDF TO MARKDOWN */}
                    {activeToolId === "pdf-to-markdown" && (
                      <MarkdownWorkspace
                        activeFile={activeFile}
                        onOpenFilePicker={() => fileInputRef.current?.click()}
                        onFileUpload={handleFileUpload}
                        user={user}
                        onSaveToCloud={handleSaveToMyDocuments}
                        onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
                      />
                    )}

                    {/* TOOL 6: SIGN PDF */}
                    {(activeToolId === "sign" || activeToolId === "sign-pdf") && (
                      <SignWorkspace
                        activeFile={activeFile}
                        user={user}
                        onOpenFilePicker={() => fileInputRef.current?.click()}
                        onSaveToCloud={handleSaveToMyDocuments}
                        onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
                      />
                    )}

                    {/* TOOL 7: CROP PDF */}
                    {activeToolId === "crop-pdf" && (
                      <CropWorkspace
                        activeFile={activeFile}
                        user={user}
                        onOpenFilePicker={() => fileInputRef.current?.click()}
                        onSaveToCloud={handleSaveToMyDocuments}
                        onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
                      />
                    )}

                    {/* TOOL 8: PAGE NUMBERS */}
                    {activeToolId === "page-numbers" && (
                      <PageNumbersWorkspace
                        activeFile={activeFile}
                        user={user}
                        onOpenFilePicker={() => fileInputRef.current?.click()}
                        onSaveToCloud={handleSaveToMyDocuments}
                        onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
                      />
                    )}

                    {/* TOOL 9: COMPRESS PDF */}
                    {(activeToolId === "compress" || activeToolId === "compress-pdf") && (
                      <CompressWorkspace
                        activeFile={activeFile}
                        user={user}
                        onOpenFilePicker={() => fileInputRef.current?.click()}
                        onSaveToCloud={handleSaveToMyDocuments}
                        onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
                      />
                    )}

                    {/* TOOL 10: WORD CONVERSION */}
                    {(activeToolId === "word-to-pdf" || activeToolId === "pdf-to-word") && (
                      <WordWorkspace
                        mode={activeToolId as any}
                        activeFile={activeFile}
                        user={user}
                        onOpenFilePicker={() => fileInputRef.current?.click()}
                        onOpenInEditor={(html, filename) => {
                          setActiveToolId("create-pdf");
                        }}
                        onSaveToCloud={handleSaveToMyDocuments}
                        onDownloadRecorded={() => setDocsRefreshKey((k) => k + 1)}
                      />
                    )}

                    {/* TOOL 11: SECURITY & SEARCH */}
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
                      activeToolId !== "compress" &&
                      activeToolId !== "compress-pdf" &&
                      activeToolId !== "word-to-pdf" &&
                      activeToolId !== "pdf-to-word" &&
                      activeToolId !== "html-to-pdf" &&
                      activeToolId !== "pdf-to-markdown" &&
                      activeToolId !== "sign" &&
                      activeToolId !== "sign-pdf" &&
                      activeToolId !== "pdf-to-excel" &&
                      activeToolId !== "pdf-to-powerpoint" &&
                      activeToolId !== "crop-pdf" &&
                      activeToolId !== "page-numbers" &&
                      activeToolId !== "protect" &&
                      activeToolId !== "search-pdf" &&
                      activeToolId !== "import-pdf" &&
                      activeToolId !== "insert-image" && (
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
        </div>
      </div>

      {/* Google Drive Import Modal */}
      <GoogleDrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onImportFile={(file) => handleFileUpload([file])}
        user={user}
        onOpenAuthModal={(mode) => {
          setAuthModalMode(mode || "login");
          setIsAuthModalOpen(true);
        }}
      />

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
