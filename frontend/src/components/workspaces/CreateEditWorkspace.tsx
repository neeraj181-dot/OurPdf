import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText,
  FolderOpen,
  Download,
  Plus,
  Trash2,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Edit2,
  Check,
  X,
  ListTree,
  UploadCloud,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  ArrowRight,
  FileSignature,
  Search,
  Maximize2,
  Minimize2,
  Copy,
  MoveUp,
  MoveDown,
  Palette,
  Highlighter,
  List,
  ListOrdered,
  MoveVertical,
  Shapes,
  PenTool,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { downloadPdfBytes, fileToArrayBuffer } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import {
  apiDetectPdfHeadings,
  apiExportOrganizedPdf,
  DetectedHeadingItem,
  InsertedElementItem,
  UserProfile,
  apiRecordDownload,
} from "../../lib/api";
import { recordDownloadedDoc } from "../../lib/docStorage";

export interface DocumentPage {
  id: string;
  pageNumber: number;
  originalIndex: number;
  thumbnailUrl?: string | null;
  width: number;
  height: number;
  rotation?: number;
  isBlank?: boolean;
}

interface CreateEditWorkspaceProps {
  activeFile: PDFFileItem | null;
  onUploadClick: () => void;
  onOpenFilePicker: () => void;
  onSelectTool: (toolId: string) => void;
  user?: UserProfile | null;
  onSaveToCloud?: (file: File, name: string) => Promise<void>;
  onDownloadRecorded?: () => void;
}

interface HistorySnapshot {
  textElements: DetectedHeadingItem[];
  insertedElements: InsertedElementItem[];
  pages: DocumentPage[];
  activePageIndex: number;
  docTitle: string;
}

export const CreateEditWorkspace: React.FC<CreateEditWorkspaceProps> = ({
  activeFile,
  onUploadClick,
  onOpenFilePicker,
  onSelectTool,
  user,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  // Document State
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState<string>("Untitled Document");
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>("");

  // Pages State
  const [pages, setPages] = useState<DocumentPage[]>([
    {
      id: "p-1",
      pageNumber: 1,
      originalIndex: 0,
      width: 595.28,
      height: 841.89,
      rotation: 0,
    },
  ]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isImportedPdfMode, setIsImportedPdfMode] = useState<boolean>(false);

  // Extracted Text Elements & Inserted Objects
  const [textElements, setTextElements] = useState<DetectedHeadingItem[]>([]);
  const [headings, setHeadings] = useState<DetectedHeadingItem[]>([]);
  const [insertedElements, setInsertedElements] = useState<InsertedElementItem[]>([]);

  // Canva Dock Navigation Sidebar Mode
  const [activeDockTab, setActiveDockTab] = useState<"pages" | "elements" | "text" | "uploads" | "draw" | "outline" | null>("pages");

  // Selected Item for Editing
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"text-block" | "inserted" | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  // Active Tool Mode (e.g., clicking canvas to add text or shape)
  const [activeInsertMode, setActiveInsertMode] = useState<"select" | "text" | "rectangle" | "circle" | "line" | "arrow">("select");

  // Canva Floating Toolbar State
  const [currentHeadingLevel, setCurrentHeadingLevel] = useState<"Title" | "H1" | "H2" | "H3" | "Body">("H1");
  const [currentFont, setCurrentFont] = useState<string>("Canva Sans");
  const [currentFontSize, setCurrentFontSize] = useState<number>(36);
  const [isBold, setIsBold] = useState<boolean>(true);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isUnderline, setIsUnderline] = useState<boolean>(false);
  const [isStrike, setIsStrike] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>("#111827");
  const [highlightColor, setHighlightColor] = useState<string>("");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right" | "justify">("left");
  const [listType, setListType] = useState<"none" | "bullet" | "number">("none");

  // Shape Styling States
  const [shapeBorderColor, setShapeBorderColor] = useState<string>("#7D2AE8");
  const [shapeFillColor, setShapeFillColor] = useState<string>("rgba(125, 42, 232, 0.1)");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2);

  // Popups & Dropdowns
  const [isLevelMenuOpen, setIsLevelMenuOpen] = useState<boolean>(false);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState<boolean>(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState<boolean>(false);
  const [isAlignMenuOpen, setIsAlignMenuOpen] = useState<boolean>(false);
  const [isSpacingMenuOpen, setIsSpacingMenuOpen] = useState<boolean>(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [showBottomThumbnails, setShowBottomThumbnails] = useState<boolean>(true);

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<{ page: number; elementId: string; text: string }[]>([]);
  const [currentSearchIdx, setCurrentSearchIdx] = useState<number>(0);

  // PDF Preview & Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [pdfJsDoc, setPdfJsDoc] = useState<any>(null);
  const [pdfPageViewport, setPdfPageViewport] = useState<{ width: number; height: number; scale: number }>({
    width: 595,
    height: 842,
    scale: 1.0,
  });

  // History Stack (Undo / Redo)
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Processing & Loading States
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isScannedPdf, setIsScannedPdf] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "saved_just_now">("saved");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Signature Draw Pad State
  const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
  const [typedSigText, setTypedSigText] = useState<string>("");
  const [sigPenColor, setSigPenColor] = useState<string>("#111827");
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false);

  // DOM Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const currentPage = pages[activePageIndex] || pages[0];

  // Helper to record history snapshot before modifications
  const pushHistorySnapshot = useCallback(() => {
    const snapshot: HistorySnapshot = {
      textElements: JSON.parse(JSON.stringify(textElements)),
      insertedElements: JSON.parse(JSON.stringify(insertedElements)),
      pages: JSON.parse(JSON.stringify(pages)),
      activePageIndex,
      docTitle,
    };
    setUndoStack((prev) => [...prev.slice(-30), snapshot]);
    setRedoStack([]);
    setSaveStatus("unsaved");
  }, [textElements, insertedElements, pages, activePageIndex, docTitle]);

  // Load activeFile prop if passed
  useEffect(() => {
    if (activeFile && activeFile.file && (!currentFile || currentFile.name !== activeFile.file.name)) {
      handleLoadPdfFile(activeFile.file);
    }
  }, [activeFile]);

  // 1. PDF Loading & Full Text Element Extraction Pipeline
  const handleLoadPdfFile = async (file: File) => {
    if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
      alert("Please select a valid PDF file.");
      return;
    }

    try {
      setIsLoadingPdf(true);
      setSaveStatus("saving");
      setStatusMessage("Reading document...");
      soundEffects.playClick();
      setCurrentFile(file);

      const cleanFileName = file.name;
      setDocTitle(cleanFileName);
      setTitleDraft(cleanFileName);

      // Load PDF with pdfjs-dist
      const buffer = await fileToArrayBuffer(file);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const loadedDoc = await loadingTask.promise;
      setPdfJsDoc(loadedDoc);
      const numPages = loadedDoc.numPages;

      // Generate Page Thumbnails
      const importedPages: DocumentPage[] = [];
      for (let i = 1; i <= numPages; i++) {
        const page = await loadedDoc.getPage(i);
        const viewport = page.getViewport({ scale: 0.25 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let thumbUrl = null;
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          thumbUrl = canvas.toDataURL("image/jpeg", 0.7);
        }

        importedPages.push({
          id: `page-${i}-${Date.now()}`,
          pageNumber: i,
          originalIndex: i - 1,
          thumbnailUrl: thumbUrl,
          width: page.view[2] || 595.28,
          height: page.view[3] || 841.89,
          rotation: 0,
        });
      }

      setPages(importedPages);
      setActivePageIndex(0);
      setIsImportedPdfMode(true);

      // Extract all text elements & headings via Backend
      setIsDetecting(true);
      setStatusMessage("Building editable text overlay...");

      try {
        const detected = await apiDetectPdfHeadings(file);
        if (detected.title && detected.title !== "Untitled Document" && detected.title !== "Document.pdf") {
          setDocTitle(detected.title);
          setTitleDraft(detected.title);
        }

        const allElements = detected.textElements && detected.textElements.length > 0
          ? detected.textElements
          : detected.headings || [];

        setTextElements(allElements);
        setHeadings(detected.headings || allElements.filter((el) => ["Title", "H1", "H2", "H3"].includes(el.level)));
        setIsScannedPdf(detected.isScanned || allElements.length === 0);

        if (allElements.length > 0) {
          const first = allElements[0];
          setCurrentFontSize(first.fontSize || 36);
          setCurrentHeadingLevel((first.level as any) || "H1");
        }
      } catch (detectErr) {
        console.warn("Backend text detection fallback:", detectErr);
        const fallbackEl: DetectedHeadingItem = {
          id: "txt-auto-1",
          originalText: cleanFileName.replace(/\.pdf$/i, ""),
          text: cleanFileName.replace(/\.pdf$/i, ""),
          level: "H1",
          page: 1,
          position: 1,
          bbox: [50, 60, 450, 110],
          fontSize: 36,
          isBold: true,
        };
        setTextElements([fallbackEl]);
        setHeadings([fallbackEl]);
        setIsScannedPdf(false);
      }

      soundEffects.playSuccess();
      setSaveStatus("saved_just_now");
      setTimeout(() => setSaveStatus("saved"), 3000);
    } catch (err: any) {
      console.error("Failed to load PDF:", err);
      alert(`Error loading PDF: ${err?.message || "Invalid or password-protected PDF."}`);
    } finally {
      setIsLoadingPdf(false);
      setIsDetecting(false);
    }
  };

  // 2. Render Active Page onto PDF Canvas
  const renderCurrentPdfPage = useCallback(async () => {
    if (!pdfJsDoc || !pdfCanvasRef.current) return;
    try {
      const pageNumberInPdf = (currentPage?.originalIndex ?? activePageIndex) + 1;
      if (currentPage?.isBlank) {
        const canvas = pdfCanvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const w = 595.28 * 1.35 * zoomLevel;
          const h = 841.89 * 1.35 * zoomLevel;
          canvas.width = w;
          canvas.height = h;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, h);
          setPdfPageViewport({ width: w, height: h, scale: 1.35 * zoomLevel });
        }
        return;
      }

      const page = await pdfJsDoc.getPage(Math.max(1, Math.min(pageNumberInPdf, pdfJsDoc.numPages)));
      const canvas = pdfCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const baseScale = 1.35;
      const scale = baseScale * zoomLevel;
      const rotation = ((page.rotate || 0) + (currentPage?.rotation || 0)) % 360;
      const viewport = page.getViewport({ scale, rotation });

      setPdfPageViewport({ width: viewport.width, height: viewport.height, scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      await page.render(renderContext as any).promise;
    } catch (err) {
      console.error("Error rendering PDF page:", err);
    }
  }, [pdfJsDoc, activePageIndex, currentPage, zoomLevel]);

  useEffect(() => {
    if (isImportedPdfMode && pdfJsDoc) {
      renderCurrentPdfPage();
    }
  }, [isImportedPdfMode, pdfJsDoc, activePageIndex, zoomLevel, currentPage?.rotation, renderCurrentPdfPage]);

  // 3. Selection & Formatting Synchronization
  const handleSelectElement = (id: string, type: "text-block" | "inserted") => {
    soundEffects.playClick();
    setSelectedElementId(id);
    setSelectedType(type);

    if (type === "text-block") {
      const el = textElements.find((item) => item.id === id);
      if (el) {
        setCurrentHeadingLevel((el.level as any) || "H1");
        setCurrentFontSize(el.fontSize || 36);
        setIsBold(Boolean(el.isBold || el.bold || el.level === "Title" || el.level === "H1"));
        setIsItalic(Boolean(el.italic));
        setIsUnderline(Boolean(el.underline));
        setIsStrike(Boolean(el.strikethrough));
        setTextColor(el.color || "#111827");
        setHighlightColor(el.highlight || "");
      }
    } else if (type === "inserted") {
      const el = insertedElements.find((item) => item.id === id);
      if (el) {
        if (el.type === "text") {
          setCurrentFont(el.fontFamily || "Canva Sans");
          setCurrentFontSize(el.fontSize || 36);
          setIsBold(Boolean(el.bold));
          setIsItalic(Boolean(el.italic));
          setIsUnderline(Boolean(el.underline));
          setIsStrike(Boolean(el.strikethrough));
          setTextColor(el.color || "#111827");
          setHighlightColor(el.highlight || "");
          setTextAlign(el.align || "left");
        } else if (el.type === "shape") {
          setShapeBorderColor(el.borderColor || "#7D2AE8");
          setShapeFillColor(el.fillColor || "rgba(125,42,232,0.1)");
          setShapeStrokeWidth(el.strokeWidth || 2);
        }
      }
    }
  };

  // Deselect when clicking canvas background
  const handleCanvasContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "CANVAS") {
      if (activeInsertMode === "select") {
        setSelectedElementId(null);
        setSelectedType(null);
      } else {
        const rect = canvasContainerRef.current?.getBoundingClientRect();
        if (rect) {
          const clickX = (e.clientX - rect.left) / pdfPageViewport.scale;
          const clickY = (e.clientY - rect.top) / pdfPageViewport.scale;
          handlePlaceItemAt(clickX, clickY);
        }
      }
    }
  };

  // 4. In-Place Text Editing Handlers
  const handleUpdateTextContent = (id: string, newText: string) => {
    pushHistorySnapshot();
    if (selectedType === "text-block") {
      setTextElements((prev) =>
        prev.map((item) => (item.id === id ? { ...item, text: newText, isEdited: true } : item))
      );
      setHeadings((prev) =>
        prev.map((h) => (h.id === id ? { ...h, text: newText, isEdited: true } : h))
      );
    } else if (selectedType === "inserted") {
      setInsertedElements((prev) =>
        prev.map((item) => (item.id === id ? { ...item, text: newText } : item))
      );
    }
  };

  // Apply Formatting change to selected element
  const handleApplyFormatting = (changes: Partial<DetectedHeadingItem & InsertedElementItem>) => {
    pushHistorySnapshot();
    if (selectedType === "text-block" && selectedElementId) {
      setTextElements((prev) =>
        prev.map((item) => (item.id === selectedElementId ? { ...item, ...changes, isEdited: true } : item))
      );
    } else if (selectedType === "inserted" && selectedElementId) {
      setInsertedElements((prev) =>
        prev.map((item) => (item.id === selectedElementId ? { ...item, ...changes } : item))
      );
    }
  };

  // 5. Insert Tools (Text, Image, Shape, Signature)
  const handlePlaceItemAt = (x: number, y: number) => {
    pushHistorySnapshot();
    const currentPageNum = activePageIndex + 1;
    const newId = `insert-${Date.now()}`;

    if (activeInsertMode === "text") {
      const newTextItem: InsertedElementItem = {
        id: newId,
        type: "text",
        page: currentPageNum,
        x: Math.max(20, x),
        y: Math.max(20, y),
        width: 260,
        height: 60,
        text: "Add a heading",
        fontSize: currentFontSize,
        fontFamily: currentFont,
        color: textColor,
        bold: isBold,
        italic: isItalic,
        align: textAlign,
      };
      setInsertedElements((prev) => [...prev, newTextItem]);
      setSelectedElementId(newId);
      setSelectedType("inserted");
      setActiveInsertMode("select");
      soundEffects.playSuccess();
    } else if (["rectangle", "circle", "line", "arrow"].includes(activeInsertMode)) {
      const newShapeItem: InsertedElementItem = {
        id: newId,
        type: "shape",
        page: currentPageNum,
        shapeType: activeInsertMode as any,
        x: Math.max(20, x),
        y: Math.max(20, y),
        width: activeInsertMode === "circle" ? 120 : 180,
        height: activeInsertMode === "circle" ? 120 : (activeInsertMode === "line" ? 2 : 100),
        borderColor: shapeBorderColor,
        fillColor: shapeFillColor,
        strokeWidth: shapeStrokeWidth,
      };
      setInsertedElements((prev) => [...prev, newShapeItem]);
      setSelectedElementId(newId);
      setSelectedType("inserted");
      setActiveInsertMode("select");
      soundEffects.playSuccess();
    }
  };

  // Add specific text tier from Canva Text Panel
  const handleAddTextTier = (tier: "heading" | "subheading" | "body") => {
    pushHistorySnapshot();
    const currentPageNum = activePageIndex + 1;
    const newId = `text-tier-${Date.now()}`;
    const fontSz = tier === "heading" ? 36 : tier === "subheading" ? 24 : 16;
    const defaultText = tier === "heading" ? "Add a heading" : tier === "subheading" ? "Add a subheading" : "Add a little bit of body text";

    const newTextItem: InsertedElementItem = {
      id: newId,
      type: "text",
      page: currentPageNum,
      x: 100,
      y: 120 + (tier === "subheading" ? 60 : tier === "body" ? 110 : 0),
      width: tier === "body" ? 300 : 260,
      height: fontSz + 24,
      text: defaultText,
      fontSize: fontSz,
      fontFamily: currentFont,
      color: "#111827",
      bold: tier === "heading",
      italic: false,
      align: "left",
    };
    setInsertedElements((prev) => [...prev, newTextItem]);
    setSelectedElementId(newId);
    setSelectedType("inserted");
    soundEffects.playSuccess();
  };

  // Image upload handling
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        pushHistorySnapshot();
        const newImg: InsertedElementItem = {
          id: `img-${Date.now()}`,
          type: "image",
          page: activePageIndex + 1,
          x: 100,
          y: 100,
          width: 240,
          height: 180,
          dataUrl,
        };
        setInsertedElements((prev) => [...prev, newImg]);
        setSelectedElementId(newImg.id);
        setSelectedType("inserted");
        soundEffects.playSuccess();
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    }
  };

  // Signature Draw Pad Handlers
  const handleStartDrawSig = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = sigPenColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    setIsDrawingSig(true);
  };

  const handleDrawSigMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handleEndDrawSig = () => {
    setIsDrawingSig(false);
  };

  const handleClearSig = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleInsertSignature = () => {
    let sigDataUrl = "";
    if (sigMode === "draw") {
      const canvas = sigCanvasRef.current;
      if (!canvas) return;
      sigDataUrl = canvas.toDataURL("image/png");
    } else if (sigMode === "type") {
      if (!typedSigText.trim()) return;
      const offscreen = document.createElement("canvas");
      offscreen.width = 400;
      offscreen.height = 120;
      const ctx = offscreen.getContext("2d");
      if (ctx) {
        ctx.font = "italic 36px 'Brush Script MT', cursive, sans-serif";
        ctx.fillStyle = sigPenColor;
        ctx.fillText(typedSigText, 20, 70);
        sigDataUrl = offscreen.toDataURL("image/png");
      }
    }

    if (sigDataUrl) {
      pushHistorySnapshot();
      const newSig: InsertedElementItem = {
        id: `sig-${Date.now()}`,
        type: "signature",
        page: activePageIndex + 1,
        x: 120,
        y: 200,
        width: 180,
        height: 70,
        dataUrl: sigDataUrl,
      };
      setInsertedElements((prev) => [...prev, newSig]);
      setSelectedElementId(newSig.id);
      setSelectedType("inserted");
      setIsSignatureModalOpen(false);
      soundEffects.playSuccess();
    }
  };

  // Delete selected item
  const handleDeleteSelected = () => {
    if (!selectedElementId) return;
    pushHistorySnapshot();
    if (selectedType === "text-block") {
      setTextElements((prev) =>
        prev.map((el) => (el.id === selectedElementId ? { ...el, text: "", isEdited: true } : el))
      );
    } else if (selectedType === "inserted") {
      setInsertedElements((prev) => prev.filter((el) => el.id !== selectedElementId));
    }
    setSelectedElementId(null);
    setSelectedType(null);
    soundEffects.playClick();
  };

  // 6. Page Operations (Add, Duplicate, Delete, Rotate, Reorder)
  const handleAddBlankPage = () => {
    pushHistorySnapshot();
    const newPageNum = pages.length + 1;
    const newPage: DocumentPage = {
      id: `blank-${Date.now()}`,
      pageNumber: newPageNum,
      originalIndex: pages.length,
      width: 595.28,
      height: 841.89,
      isBlank: true,
      rotation: 0,
    };
    setPages((prev) => [...prev, newPage]);
    setActivePageIndex(pages.length);
    soundEffects.playSuccess();
  };

  const handleDuplicatePage = (idx: number) => {
    pushHistorySnapshot();
    const pageToDup = pages[idx];
    const newPage: DocumentPage = {
      ...pageToDup,
      id: `dup-${Date.now()}`,
      pageNumber: idx + 2,
    };
    const newPages = [...pages.slice(0, idx + 1), newPage, ...pages.slice(idx + 1)].map((p, i) => ({
      ...p,
      pageNumber: i + 1,
    }));
    setPages(newPages);
    setActivePageIndex(idx + 1);
    soundEffects.playSuccess();
  };

  const handleDeletePage = (idx: number) => {
    if (pages.length <= 1) {
      alert("Document must have at least one page.");
      return;
    }
    pushHistorySnapshot();
    const newPages = pages.filter((_, i) => i !== idx).map((p, i) => ({ ...p, pageNumber: i + 1 }));
    setPages(newPages);
    setActivePageIndex(Math.max(0, idx - 1));
    soundEffects.playClick();
  };

  const handleRotatePage = (idx: number) => {
    pushHistorySnapshot();
    setPages((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, rotation: ((p.rotation || 0) + 90) % 360 } : p))
    );
    soundEffects.playClick();
  };

  // 7. Undo / Redo Engine
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevSnapshot = undoStack[undoStack.length - 1];
    const currentSnapshot: HistorySnapshot = {
      textElements: JSON.parse(JSON.stringify(textElements)),
      insertedElements: JSON.parse(JSON.stringify(insertedElements)),
      pages: JSON.parse(JSON.stringify(pages)),
      activePageIndex,
      docTitle,
    };
    setRedoStack((prev) => [...prev, currentSnapshot]);
    setUndoStack((prev) => prev.slice(0, -1));

    setTextElements(prevSnapshot.textElements);
    setInsertedElements(prevSnapshot.insertedElements);
    setPages(prevSnapshot.pages);
    setActivePageIndex(prevSnapshot.activePageIndex);
    setDocTitle(prevSnapshot.docTitle);
    soundEffects.playClick();
  }, [undoStack, textElements, insertedElements, pages, activePageIndex, docTitle]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    const currentSnapshot: HistorySnapshot = {
      textElements: JSON.parse(JSON.stringify(textElements)),
      insertedElements: JSON.parse(JSON.stringify(insertedElements)),
      pages: JSON.parse(JSON.stringify(pages)),
      activePageIndex,
      docTitle,
    };
    setUndoStack((prev) => [...prev, currentSnapshot]);
    setRedoStack((prev) => prev.slice(0, -1));

    setTextElements(nextSnapshot.textElements);
    setInsertedElements(nextSnapshot.insertedElements);
    setPages(nextSnapshot.pages);
    setActivePageIndex(nextSnapshot.activePageIndex);
    setDocTitle(nextSnapshot.docTitle);
    soundEffects.playClick();
  }, [redoStack, textElements, insertedElements, pages, activePageIndex, docTitle]);

  // 8. Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+F, Delete, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
          setSelectedElementId(null);
          setSelectedType(null);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          handleRedo();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          handleExportPdf();
        } else if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          setIsSearchOpen((prev) => !prev);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key === "Escape") {
        setSelectedElementId(null);
        setSelectedType(null);
        setActiveInsertMode("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, selectedElementId]);

  // 9. Export Final Edited PDF
  const handleExportPdf = async () => {
    soundEffects.playClick();
    setIsExporting(true);
    setSaveStatus("saving");
    setStatusMessage("Exporting document...");

    try {
      if (!currentFile && !isImportedPdfMode) {
        throw new Error("No PDF document is currently open.");
      }

      const pageOrder = pages.map((p) => p.originalIndex);
      const pageRotations: Record<number, number> = {};
      pages.forEach((p, idx) => {
        if (p.rotation) pageRotations[idx + 1] = p.rotation;
      });

      const exportedBytes = await apiExportOrganizedPdf(currentFile!, {
        title: docTitle,
        headings,
        text_elements: textElements,
        inserted_elements: insertedElements,
        page_rotations: pageRotations,
        show_page_numbers: false,
        page_order: pageOrder,
      });

      if (!exportedBytes || exportedBytes.byteLength === 0) {
        throw new Error("Exported PDF data is empty.");
      }

      const exportName = docTitle.toLowerCase().endsWith(".pdf")
        ? `${docTitle.slice(0, -4)}-edited.pdf`
        : `${docTitle}-edited.pdf`;

      const safeBytes = new Uint8Array(exportedBytes.buffer.slice(0));
      downloadPdfBytes(safeBytes, exportName);

      // Cloud / Local record
      if (user) {
        apiRecordDownload(safeBytes, exportName, "Edit PDF")
          .then(() => onDownloadRecorded && onDownloadRecorded())
          .catch((err) => console.warn("Backend download recording:", err));
      } else {
        await recordDownloadedDoc(
          exportName,
          safeBytes.length,
          pages.length,
          "Edit PDF",
          new Blob([safeBytes], { type: "application/pdf" })
        );
        if (onDownloadRecorded) onDownloadRecorded();
      }

      soundEffects.playSuccess();
      setSaveStatus("saved_just_now");
      setTimeout(() => setSaveStatus("saved"), 4000);
    } catch (err: any) {
      console.error("Export error:", err);
      alert(`Export Failed: ${err?.message || "Error generating edited PDF"}`);
      setSaveStatus("unsaved");
    } finally {
      setIsExporting(false);
    }
  };

  // Active Page Elements Filter
  const activePageNum = activePageIndex + 1;
  const activePageTextElements = textElements.filter((el) => el.page === activePageNum);
  const activePageInsertedElements = insertedElements.filter((el) => el.page === activePageNum);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-h-screen bg-[#0e0e11] text-zinc-100 select-none overflow-hidden font-sans border border-zinc-800 rounded-2xl shadow-2xl">
      {/* ========================================================================= */}
      {/* 1. TOP CANVA HEADER BAR */}
      {/* ========================================================================= */}
      <div className="h-13 bg-[#18181b] border-b border-zinc-800 px-4 flex items-center justify-between gap-3 shrink-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => onSelectTool("all")}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Back to Tools"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Canva Brand / Icon Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs tracking-wide shadow-sm">
            <span>OurPdf</span>
            <span className="text-[10px] font-normal opacity-80">Edit</span>
          </div>

          {/* File Name & Rename */}
          <div className="flex items-center gap-2 min-w-0">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  setDocTitle(titleDraft.trim() || "Untitled Document");
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setDocTitle(titleDraft.trim() || "Untitled Document");
                    setIsEditingTitle(false);
                  }
                }}
                className="bg-zinc-900 text-white text-xs font-bold px-2.5 py-1 rounded-md border border-purple-500 focus:outline-none"
                autoFocus
              />
            ) : (
              <div
                onClick={() => {
                  setTitleDraft(docTitle);
                  setIsEditingTitle(true);
                }}
                className="group flex items-center gap-1.5 cursor-pointer hover:bg-zinc-800/80 px-2 py-1 rounded-md transition-all"
                title="Click to rename"
              >
                <span className="text-xs font-bold text-zinc-200 truncate max-w-[220px]">{docTitle}</span>
                <Edit2 className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}

            {/* Save Status */}
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400">
              {saveStatus === "saving" ? "Saving..." : saveStatus === "unsaved" ? "• Unsaved" : "All changes saved"}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleLoadPdfFile(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="hidden md:flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-zinc-700"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open PDF</span>
          </button>

          {/* Canva Export / Share CTA */}
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg transition-all cursor-pointer"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN 3-PANEL BODY (CANVA DOCK + DRAWER + CANVAS) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ------------------------------------------------------------- */}
        {/* CANVA LEFT VERTICAL ICON DOCK */}
        {/* ------------------------------------------------------------- */}
        <div className="w-18 bg-[#121214] border-r border-zinc-800 flex flex-col items-center py-3 gap-2 shrink-0 z-30 select-none">
          {/* Dock Item 1: Pages */}
          <button
            onClick={() => setActiveDockTab(activeDockTab === "pages" ? null : "pages")}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
              activeDockTab === "pages"
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pages</span>
          </button>

          {/* Dock Item 2: Elements / Shapes */}
          <button
            onClick={() => setActiveDockTab(activeDockTab === "elements" ? null : "elements")}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
              activeDockTab === "elements"
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <Shapes className="w-4 h-4" />
            <span>Elements</span>
          </button>

          {/* Dock Item 3: Text */}
          <button
            onClick={() => setActiveDockTab(activeDockTab === "text" ? null : "text")}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
              activeDockTab === "text"
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Text</span>
          </button>

          {/* Dock Item 4: Uploads */}
          <button
            onClick={() => setActiveDockTab(activeDockTab === "uploads" ? null : "uploads")}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
              activeDockTab === "uploads"
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Uploads</span>
          </button>

          {/* Dock Item 5: Draw / Sign */}
          <button
            onClick={() => setActiveDockTab(activeDockTab === "draw" ? null : "draw")}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
              activeDockTab === "draw"
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Sign</span>
          </button>

          {/* Dock Item 6: Outline / Headings */}
          <button
            onClick={() => setActiveDockTab(activeDockTab === "outline" ? null : "outline")}
            className={`w-14 py-2.5 rounded-xl flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
              activeDockTab === "outline"
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <ListTree className="w-4 h-4" />
            <span>Outline</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CANVA FLYOUT DRAWER (PAGES, ELEMENTS, TEXT, UPLOADS, ETC) */}
        {/* ------------------------------------------------------------- */}
        {activeDockTab && (
          <div className="w-72 bg-[#18181b] border-r border-zinc-800 flex flex-col shrink-0 z-20 shadow-xl transition-all">
            {/* Drawer Header */}
            <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white capitalize tracking-wide">
                {activeDockTab === "pages" && `Document Pages (${pages.length})`}
                {activeDockTab === "elements" && "Shapes & Elements"}
                {activeDockTab === "text" && "Add Text"}
                {activeDockTab === "uploads" && "Images & Media"}
                {activeDockTab === "draw" && "Signature & Draw"}
                {activeDockTab === "outline" && "Document Outline (TOC)"}
              </h3>
              <button
                onClick={() => setActiveDockTab(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-3">
              {/* TAB 1: PAGES */}
              {activeDockTab === "pages" && (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleAddBlankPage}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-bold text-xs border border-purple-500/40 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add blank page</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    {pages.map((page, idx) => (
                      <div
                        key={page.id || idx}
                        onClick={() => setActivePageIndex(idx)}
                        className={`group relative rounded-xl border p-1.5 cursor-pointer transition-all flex flex-col gap-1 ${
                          activePageIndex === idx
                            ? "bg-zinc-800 border-purple-500 shadow-md ring-2 ring-purple-500/30"
                            : "bg-zinc-900/80 border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        <div className="aspect-[3/4] bg-white rounded-lg overflow-hidden flex items-center justify-center relative shadow-inner">
                          {page.thumbnailUrl ? (
                            <img
                              src={page.thumbnailUrl}
                              alt={`Page ${idx + 1}`}
                              className="w-full h-full object-contain"
                              style={{ transform: `rotate(${page.rotation || 0}deg)` }}
                            />
                          ) : (
                            <FileText className="w-6 h-6 text-zinc-400" />
                          )}
                          <span className="absolute bottom-1 right-1 bg-black/70 text-white font-mono text-[9px] px-1 rounded">
                            {idx + 1}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
                          <span>Page {idx + 1}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotatePage(idx);
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:text-white p-0.5"
                            title="Rotate"
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: ELEMENTS & SHAPES */}
              {activeDockTab === "elements" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                      Shapes
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setActiveInsertMode("rectangle");
                          handlePlaceItemAt(100, 150);
                        }}
                        className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl flex flex-col items-center gap-1.5 transition-colors"
                      >
                        <Square className="w-6 h-6 text-purple-400" />
                        <span className="text-xs text-zinc-300 font-semibold">Rectangle</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveInsertMode("circle");
                          handlePlaceItemAt(100, 150);
                        }}
                        className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl flex flex-col items-center gap-1.5 transition-colors"
                      >
                        <Circle className="w-6 h-6 text-purple-400" />
                        <span className="text-xs text-zinc-300 font-semibold">Circle</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveInsertMode("line");
                          handlePlaceItemAt(100, 150);
                        }}
                        className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl flex flex-col items-center gap-1.5 transition-colors"
                      >
                        <Minus className="w-6 h-6 text-purple-400" />
                        <span className="text-xs text-zinc-300 font-semibold">Line</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveInsertMode("arrow");
                          handlePlaceItemAt(100, 150);
                        }}
                        className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl flex flex-col items-center gap-1.5 transition-colors"
                      >
                        <ArrowRight className="w-6 h-6 text-purple-400" />
                        <span className="text-xs text-zinc-300 font-semibold">Arrow</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TEXT TIERS (CANVA STYLE) */}
              {activeDockTab === "text" && (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleAddTextTier("heading")}
                    className="w-full text-left p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all shadow-sm"
                  >
                    <span className="text-xl font-bold text-white block">Add a heading</span>
                  </button>

                  <button
                    onClick={() => handleAddTextTier("subheading")}
                    className="w-full text-left p-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all shadow-sm"
                  >
                    <span className="text-base font-semibold text-zinc-200 block">Add a subheading</span>
                  </button>

                  <button
                    onClick={() => handleAddTextTier("body")}
                    className="w-full text-left p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all shadow-sm"
                  >
                    <span className="text-xs text-zinc-400 block">Add a little bit of body text</span>
                  </button>
                </div>
              )}

              {/* TAB 4: UPLOADS */}
              {activeDockTab === "uploads" && (
                <div className="flex flex-col gap-3">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleImageFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload file</span>
                  </button>
                  <p className="text-[11px] text-zinc-400 text-center">
                    Upload PNG, JPG, or WebP to place anywhere on your PDF.
                  </p>
                </div>
              )}

              {/* TAB 5: SIGNATURE */}
              {activeDockTab === "draw" && (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="w-full py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-bold text-xs border border-purple-500/40 transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSignature className="w-4 h-4" />
                    <span>Open Signature Pad</span>
                  </button>
                </div>
              )}

              {/* TAB 6: OUTLINE */}
              {activeDockTab === "outline" && (
                <div className="flex flex-col gap-1.5">
                  {headings.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-6">No headings detected.</p>
                  ) : (
                    headings.map((h, i) => (
                      <div
                        key={h.id || i}
                        onClick={() => {
                          setActivePageIndex(h.page - 1);
                          setSelectedElementId(h.id);
                          setSelectedType("text-block");
                        }}
                        className="p-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/80 cursor-pointer text-xs flex items-center justify-between gap-2"
                      >
                        <span className="truncate flex-1 font-medium text-zinc-200">{h.text}</span>
                        <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded">
                          p.{h.page}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CENTER CANVA STAGE & FLOATING TOP TOOLBAR */}
        {/* ------------------------------------------------------------- */}
        <div
          onClick={handleCanvasContainerClick}
          className="flex-1 bg-[#202124] overflow-auto flex flex-col items-center justify-start p-6 custom-scrollbar relative"
        >
          {/* ========================================================= */}
          {/* EXACT CANVA FLOATING TOOLBAR (AS IN USER PICTURE) */}
          {/* ========================================================= */}
          <div className="sticky top-0 z-50 mb-6 bg-white text-zinc-800 rounded-2xl shadow-2xl border border-zinc-200/80 px-2 py-1.5 flex items-center gap-1.5 select-none transition-all">
            {/* 1. Heading Level Dropdown: H1 ⌄ */}
            <div className="relative">
              <button
                onClick={() => setIsLevelMenuOpen(!isLevelMenuOpen)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-zinc-100 text-xs font-bold text-purple-700 bg-purple-50 transition-colors"
                title="Text Level"
              >
                <span>{currentHeadingLevel}</span>
                <ChevronDown className="w-3 h-3 text-purple-600" />
              </button>

              {isLevelMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-2xl p-1.5 w-32 flex flex-col gap-0.5 z-50">
                  {["Title", "H1", "H2", "H3", "Body"].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        setCurrentHeadingLevel(lvl as any);
                        const sz = lvl === "Title" ? 44 : lvl === "H1" ? 36 : lvl === "H2" ? 24 : lvl === "H3" ? 18 : 14;
                        setCurrentFontSize(sz);
                        handleApplyFormatting({ level: lvl as any, fontSize: sz });
                        setIsLevelMenuOpen(false);
                      }}
                      className="px-2.5 py-1.5 text-xs text-left rounded-lg hover:bg-purple-50 hover:text-purple-700 font-semibold text-zinc-700"
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Font Family Pill Selector (e.g. Canva Sans) */}
            <div className="relative">
              <button
                onClick={() => setIsFontMenuOpen(!isFontMenuOpen)}
                className="flex items-center justify-between w-28 px-2.5 py-1 rounded-xl bg-zinc-100/80 hover:bg-zinc-100 text-xs font-medium text-zinc-800 transition-colors"
                title="Font Family"
              >
                <span className="truncate">{currentFont}</span>
                <ChevronDown className="w-3 h-3 text-zinc-500 ml-1 shrink-0" />
              </button>

              {isFontMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-2xl p-1.5 w-44 flex flex-col gap-0.5 z-50 max-h-56 overflow-y-auto">
                  {["Canva Sans", "Arial", "Inter", "Helvetica", "Times New Roman", "Georgia", "Courier New", "Roboto"].map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setCurrentFont(f);
                        handleApplyFormatting({ fontFamily: f });
                        setIsFontMenuOpen(false);
                      }}
                      className="px-2.5 py-1.5 text-xs text-left rounded-lg hover:bg-purple-50 hover:text-purple-700 font-medium text-zinc-700"
                      style={{ fontFamily: f }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Font Size Stepper: −  36  + */}
            <div className="flex items-center bg-zinc-100/80 rounded-xl px-1 py-0.5">
              <button
                onClick={() => {
                  const prev = Math.max(8, currentFontSize - 2);
                  setCurrentFontSize(prev);
                  handleApplyFormatting({ fontSize: prev });
                }}
                className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-black font-bold text-xs rounded hover:bg-zinc-200/60"
                title="Decrease font size"
              >
                −
              </button>
              <input
                type="number"
                value={currentFontSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCurrentFontSize(v);
                  handleApplyFormatting({ fontSize: v });
                }}
                className="w-9 text-center bg-transparent text-xs font-bold text-zinc-800 focus:outline-none"
              />
              <button
                onClick={() => {
                  const next = currentFontSize + 2;
                  setCurrentFontSize(next);
                  handleApplyFormatting({ fontSize: next });
                }}
                className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-black font-bold text-xs rounded hover:bg-zinc-200/60"
                title="Increase font size"
              >
                +
              </button>
            </div>

            {/* 4. Text Color Button (A with color indicator) */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsColorPickerOpen(!isColorPickerOpen);
                  setIsHighlightPickerOpen(false);
                }}
                className="p-1.5 rounded-xl hover:bg-zinc-100 flex flex-col items-center gap-0.5"
                title="Text color"
              >
                <span className="font-extrabold text-xs text-zinc-900 leading-none">A</span>
                <span className="w-3.5 h-1 rounded-full block" style={{ backgroundColor: textColor }} />
              </button>

              {isColorPickerOpen && (
                <div className="absolute top-full left-0 mt-1.5 bg-white border border-zinc-200 p-2.5 rounded-2xl shadow-2xl flex flex-wrap gap-1.5 w-36 z-50">
                  {["#111827", "#7D2AE8", "#1DB954", "#EF4444", "#3B82F6", "#F59E0B", "#EC4899", "#FFFFFF"].map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setTextColor(c);
                        handleApplyFormatting({ color: c });
                        setIsColorPickerOpen(false);
                      }}
                      className="w-6 h-6 rounded-lg border border-zinc-300 hover:scale-110 transition-transform shadow-xs"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 5. Highlight Marker Icon */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsHighlightPickerOpen(!isHighlightPickerOpen);
                  setIsColorPickerOpen(false);
                }}
                className="p-1.5 rounded-xl hover:bg-zinc-100 flex flex-col items-center gap-0.5"
                title="Highlight color"
              >
                <Highlighter className="w-3.5 h-3.5 text-zinc-700" />
                <span
                  className="w-3.5 h-1 rounded-full block"
                  style={{ backgroundColor: highlightColor || "transparent" }}
                />
              </button>

              {isHighlightPickerOpen && (
                <div className="absolute top-full left-0 mt-1.5 bg-white border border-zinc-200 p-2 rounded-2xl shadow-2xl flex flex-wrap gap-1.5 w-36 z-50">
                  <button
                    onClick={() => {
                      setHighlightColor("");
                      handleApplyFormatting({ highlight: "" });
                      setIsHighlightPickerOpen(false);
                    }}
                    className="w-full text-[10px] text-zinc-500 hover:text-black py-0.5 text-left"
                  >
                    No Highlight
                  </button>
                  {["#FEF08A", "#BBF7D0", "#BAE6FD", "#FBCFE8", "#FED7AA"].map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setHighlightColor(c);
                        handleApplyFormatting({ highlight: c });
                        setIsHighlightPickerOpen(false);
                      }}
                      className="w-6 h-6 rounded-lg border border-zinc-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-zinc-200 mx-0.5" />

            {/* 6. Bold Pill Button (Purple Canva active style) */}
            <button
              onClick={() => {
                const n = !isBold;
                setIsBold(n);
                handleApplyFormatting({ bold: n, isBold: n });
              }}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                isBold
                  ? "bg-[#7D2AE8] text-white shadow-sm font-black"
                  : "hover:bg-zinc-100 text-zinc-700 font-bold"
              }`}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* 7. Italic */}
            <button
              onClick={() => {
                const n = !isItalic;
                setIsItalic(n);
                handleApplyFormatting({ italic: n });
              }}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                isItalic ? "bg-purple-100 text-purple-700 font-bold" : "hover:bg-zinc-100 text-zinc-700"
              }`}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            {/* 8. Underline */}
            <button
              onClick={() => {
                const n = !isUnderline;
                setIsUnderline(n);
                handleApplyFormatting({ underline: n });
              }}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                isUnderline ? "bg-purple-100 text-purple-700 font-bold" : "hover:bg-zinc-100 text-zinc-700"
              }`}
              title="Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>

            {/* 9. Strikethrough */}
            <button
              onClick={() => {
                const n = !isStrike;
                setIsStrike(n);
                handleApplyFormatting({ strikethrough: n });
              }}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                isStrike ? "bg-purple-100 text-purple-700 font-bold" : "hover:bg-zinc-100 text-zinc-700"
              }`}
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-zinc-200 mx-0.5" />

            {/* 10. Alignment Toggle */}
            <button
              onClick={() => {
                const order: ("left" | "center" | "right" | "justify")[] = ["left", "center", "right", "justify"];
                const nextIdx = (order.indexOf(textAlign) + 1) % order.length;
                const nextAlign = order[nextIdx];
                setTextAlign(nextAlign);
                handleApplyFormatting({ align: nextAlign });
              }}
              className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-700"
              title={`Alignment (${textAlign})`}
            >
              {textAlign === "left" && <AlignLeft className="w-3.5 h-3.5" />}
              {textAlign === "center" && <AlignCenter className="w-3.5 h-3.5" />}
              {textAlign === "right" && <AlignRight className="w-3.5 h-3.5" />}
              {textAlign === "justify" && <AlignJustify className="w-3.5 h-3.5" />}
            </button>

            {/* 11. List Toggle */}
            <button
              onClick={() => {
                const next = listType === "none" ? "bullet" : listType === "bullet" ? "number" : "none";
                setListType(next);
              }}
              className={`p-1.5 rounded-xl transition-all ${
                listType !== "none" ? "bg-purple-100 text-purple-700" : "hover:bg-zinc-100 text-zinc-700"
              }`}
              title="List"
            >
              {listType === "number" ? <ListOrdered className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            </button>

            {/* 12. Letter / Line Spacing */}
            <button
              onClick={() => setIsSpacingMenuOpen(!isSpacingMenuOpen)}
              className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-700"
              title="Spacing"
            >
              <MoveVertical className="w-3.5 h-3.5" />
            </button>

            {/* Delete / Trash for selected */}
            {selectedElementId && (
              <button
                onClick={handleDeleteSelected}
                className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors ml-1"
                title="Delete element"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ========================================================= */}
          {/* PRIMARY DOCUMENT CANVAS (CANVA ARTBOARD) */}
          {/* ========================================================= */}
          <div
            ref={canvasContainerRef}
            className="relative bg-white shadow-2xl rounded-sm transition-all border border-zinc-300"
            style={{
              width: pdfPageViewport.width,
              height: pdfPageViewport.height,
              cursor: activeInsertMode === "select" ? "default" : "crosshair",
            }}
          >
            {/* Background PDF Render Canvas */}
            <canvas ref={pdfCanvasRef} className="block w-full h-full pointer-events-none" />

            {/* Text Overlay Layer */}
            {activePageTextElements.map((el) => {
              const bbox = el.bbox || [50, 50, 200, 80];
              const scale = pdfPageViewport.scale;
              const x = bbox[0] * scale;
              const y = bbox[1] * scale;
              const w = Math.max(60, (bbox[2] - bbox[0]) * scale);
              const h = Math.max(20, (bbox[3] - bbox[1]) * scale);

              const isSelected = selectedElementId === el.id && selectedType === "text-block";
              const isHovered = hoveredElementId === el.id;

              return (
                <div
                  key={el.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectElement(el.id, "text-block");
                  }}
                  onMouseEnter={() => setHoveredElementId(el.id)}
                  onMouseLeave={() => setHoveredElementId(null)}
                  className={`absolute rounded transition-all group ${
                    isSelected
                      ? "ring-2 ring-[#7D2AE8] bg-white shadow-2xl z-40"
                      : isHovered
                      ? "ring-1 ring-purple-400 bg-purple-500/10 cursor-pointer z-20"
                      : "hover:bg-black/5 cursor-pointer z-10"
                  }`}
                  style={{
                    left: x,
                    top: y,
                    width: isSelected ? Math.max(w, 240) : w,
                    minHeight: h,
                  }}
                >
                  {isSelected ? (
                    <div className="p-1 flex flex-col gap-1 w-full">
                      <textarea
                        value={el.text}
                        onChange={(e) => handleUpdateTextContent(el.id, e.target.value)}
                        className="w-full text-zinc-900 bg-transparent border-0 focus:outline-none resize-none font-sans"
                        style={{
                          fontSize: `${(el.fontSize || currentFontSize) * (scale / 1.35)}px`,
                          fontWeight: el.isBold || el.bold || el.level === "Title" ? "bold" : "normal",
                          fontStyle: el.italic ? "italic" : "normal",
                          color: el.color || "#111827",
                        }}
                        rows={Math.max(1, Math.ceil(el.text.length / 30))}
                        autoFocus
                      />
                    </div>
                  ) : el.isEdited ? (
                    <div
                      className="w-full h-full bg-white px-0.5 text-zinc-950 truncate"
                      style={{
                        fontSize: `${(el.fontSize || 14) * (scale / 1.35)}px`,
                        fontWeight: el.isBold || el.bold ? "bold" : "normal",
                        fontStyle: el.italic ? "italic" : "normal",
                        color: el.color || "#111827",
                        backgroundColor: el.highlight || "#FFFFFF",
                      }}
                    >
                      {el.text}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* Inserted Elements Layer */}
            {activePageInsertedElements.map((item) => {
              const scale = pdfPageViewport.scale;
              const x = item.x * scale;
              const y = item.y * scale;
              const w = item.width * scale;
              const h = item.height * scale;

              const isSelected = selectedElementId === item.id && selectedType === "inserted";

              return (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectElement(item.id, "inserted");
                  }}
                  className={`absolute rounded transition-all ${
                    isSelected
                      ? "ring-2 ring-[#7D2AE8] shadow-2xl z-40"
                      : "hover:ring-1 hover:ring-purple-300 z-30 cursor-pointer"
                  }`}
                  style={{
                    left: x,
                    top: y,
                    width: w,
                    height: h,
                  }}
                >
                  {item.type === "text" && (
                    <div
                      className="w-full h-full p-1 bg-white/95 rounded flex items-start"
                      style={{ backgroundColor: item.highlight || "#FFFFFF" }}
                    >
                      {isSelected ? (
                        <textarea
                          value={item.text}
                          onChange={(e) => handleUpdateTextContent(item.id, e.target.value)}
                          className="w-full h-full text-zinc-950 bg-transparent border-0 focus:outline-none resize-none"
                          style={{
                            fontSize: `${(item.fontSize || 36) * (scale / 1.35)}px`,
                            fontFamily: item.fontFamily || "Canva Sans",
                            fontWeight: item.bold ? "bold" : "normal",
                            fontStyle: item.italic ? "italic" : "normal",
                            textAlign: item.align || "left",
                            color: item.color || "#111827",
                          }}
                          autoFocus
                        />
                      ) : (
                        <div
                          className="w-full h-full text-zinc-950 overflow-hidden"
                          style={{
                            fontSize: `${(item.fontSize || 36) * (scale / 1.35)}px`,
                            fontFamily: item.fontFamily || "Canva Sans",
                            fontWeight: item.bold ? "bold" : "normal",
                            fontStyle: item.italic ? "italic" : "normal",
                            textAlign: item.align || "left",
                            color: item.color || "#111827",
                          }}
                        >
                          {item.text}
                        </div>
                      )}
                    </div>
                  )}

                  {(item.type === "image" || item.type === "signature") && item.dataUrl && (
                    <img
                      src={item.dataUrl}
                      alt="Inserted Graphic"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  )}

                  {item.type === "shape" && (
                    <div className="w-full h-full">
                      {item.shapeType === "rectangle" && (
                        <div
                          className="w-full h-full rounded-sm"
                          style={{
                            borderColor: item.borderColor || "#7D2AE8",
                            borderWidth: `${item.strokeWidth || 2}px`,
                            borderStyle: "solid",
                            backgroundColor: item.fillColor || "transparent",
                          }}
                        />
                      )}
                      {item.shapeType === "circle" && (
                        <div
                          className="w-full h-full rounded-full"
                          style={{
                            borderColor: item.borderColor || "#7D2AE8",
                            borderWidth: `${item.strokeWidth || 2}px`,
                            borderStyle: "solid",
                            backgroundColor: item.fillColor || "transparent",
                          }}
                        />
                      )}
                      {item.shapeType === "line" && (
                        <div
                          className="w-full"
                          style={{
                            borderTopColor: item.borderColor || "#7D2AE8",
                            borderTopWidth: `${item.strokeWidth || 2}px`,
                            borderTopStyle: "solid",
                            marginTop: `${h / 2}px`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CANVA BOTTOM BAR (PAGE STRIP & ZOOM) */}
      {/* ========================================================================= */}
      <div className="h-10 bg-[#141416] border-t border-zinc-800 px-4 flex items-center justify-between text-xs text-zinc-400 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-zinc-300">
            Page {activePageIndex + 1} of {pages.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActivePageIndex(Math.max(0, activePageIndex - 1))}
              disabled={activePageIndex === 0}
              className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActivePageIndex(Math.min(pages.length - 1, activePageIndex + 1))}
              disabled={activePageIndex === pages.length - 1}
              className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
            className="p-1 hover:text-white"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-zinc-300 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
            className="p-1 hover:text-white"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1.0)}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-zinc-300"
          >
            Fit
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SIGNATURE PAD MODAL */}
      {/* ========================================================================= */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181a] border border-zinc-800 rounded-2xl w-full max-w-lg p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Create Electronic Signature</h3>
              <button
                onClick={() => setIsSignatureModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setSigMode("draw")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  sigMode === "draw" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Draw
              </button>
              <button
                onClick={() => setSigMode("type")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  sigMode === "type" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Type
              </button>
            </div>

            {sigMode === "draw" && (
              <div className="flex flex-col gap-3">
                <div className="border border-zinc-700 bg-white rounded-xl overflow-hidden relative shadow-inner">
                  <canvas
                    ref={sigCanvasRef}
                    width={450}
                    height={160}
                    onMouseDown={handleStartDrawSig}
                    onMouseMove={handleDrawSigMove}
                    onMouseUp={handleEndDrawSig}
                    onMouseLeave={handleEndDrawSig}
                    className="w-full h-40 cursor-crosshair block"
                  />
                  <button
                    onClick={handleClearSig}
                    className="absolute top-2 right-2 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {sigMode === "type" && (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={typedSigText}
                  onChange={(e) => setTypedSigText(e.target.value)}
                  placeholder="Type signature name..."
                  className="bg-zinc-900 text-white p-3 rounded-xl border border-zinc-800 focus:border-purple-500 focus:outline-none text-sm"
                  autoFocus
                />
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center min-h-[90px]">
                  <span className="text-2xl text-purple-400 font-serif italic">
                    {typedSigText || "Your Handwritten Signature"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setIsSignatureModalOpen(false)}
                className="px-4 py-2 rounded-full hover:bg-zinc-800 text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertSignature}
                className="px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg"
              >
                Place Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
