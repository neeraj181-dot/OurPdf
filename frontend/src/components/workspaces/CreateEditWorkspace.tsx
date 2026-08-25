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
  Lock,
  Unlock,
  Sliders,
  CornerDownRight,
  HelpCircle,
  Ban,
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

// ----------------------------------------------------------------------
// DATA TYPES & PRESET PALETTE
// ----------------------------------------------------------------------

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

export interface CanvasObject {
  id: string;
  type: "text" | "image" | "shape" | "signature";
  page: number; // 1-based page index
  x: number; // PDF point coordinates
  y: number; // PDF point coordinates
  width: number;
  height: number;
  rotation: number; // degrees
  zIndex: number;
  groupId?: string;
  locked?: boolean;
  opacity?: number;

  // Text specific
  text?: string;
  originalText?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;
  highlight?: string;
  level?: "Title" | "H1" | "H2" | "H3" | "Body";
  isEdited?: boolean;
  bbox?: number[]; // [x0, y0, x1, y1] for detected PDF text

  // Image / Signature specific
  dataUrl?: string;

  // Shape specific
  shapeType?: "rectangle" | "circle" | "line" | "arrow";
  borderColor?: string;
  fillColor?: string;
  strokeWidth?: number;
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
  objects: CanvasObject[];
  pages: DocumentPage[];
  activePageIndex: number;
  docTitle: string;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

// Professional Palette definition per specification
const PRESET_COLORS: { value: string; name: string; isWhite?: boolean }[] = [
  // Base colors
  { value: "#111111", name: "Black" },
  { value: "#FFFFFF", name: "White", isWhite: true },
  { value: "#6B7280", name: "Gray" },
  { value: "#9CA3AF", name: "Light Gray" },
  // OurPDF colors
  { value: "#20C763", name: "OurPDF Green" },
  { value: "#16A34A", name: "Forest Green" },
  { value: "#0F7A3D", name: "Dark Green" },
  // Additional colors
  { value: "#EF4444", name: "Red" },
  { value: "#F97316", name: "Orange" },
  { value: "#EAB308", name: "Yellow" },
  { value: "#3B82F6", name: "Blue" },
  { value: "#8B5CF6", name: "Purple" },
  { value: "#EC4899", name: "Pink" },
];

// ----------------------------------------------------------------------
// ONE-CLICK COLOR SWATCH ROW COMPONENT
// ----------------------------------------------------------------------

interface ColorSwatchRowProps {
  label?: string;
  currentColor?: string;
  onChange: (color: string) => void;
  allowTransparent?: boolean;
  recentCustomColors: string[];
  onAddCustomColor: (color: string) => void;
}

const ColorSwatchRow: React.FC<ColorSwatchRowProps> = ({
  label,
  currentColor = "",
  onChange,
  allowTransparent = false,
  recentCustomColors = [],
  onAddCustomColor,
}) => {
  const customInputRef = useRef<HTMLInputElement>(null);
  const normalizedCurrent = (currentColor || "").toLowerCase().trim();
  const isTransparentSelected =
    allowTransparent && (normalizedCurrent === "" || normalizedCurrent === "transparent" || normalizedCurrent === "rgba(0,0,0,0)");

  return (
    <div
      className="flex items-center gap-1.5 select-none"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {label && <span className="text-[11px] font-semibold text-[#9AA39E] shrink-0">{label}:</span>}

      {/* Transparent "No Fill" Swatch */}
      {allowTransparent && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            soundEffects.playClick();
            onChange("transparent");
          }}
          aria-label="Transparent / No fill"
          title="Transparent / No fill"
          className={`w-5 h-5 rounded-full relative flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${isTransparentSelected
              ? "ring-2 ring-[#20C763] ring-offset-1 ring-offset-[#151917]"
              : "border border-zinc-700 hover:border-zinc-500"
            }`}
          style={{
            background: "linear-gradient(45deg, #262626 25%, transparent 25%), linear-gradient(-45deg, #262626 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #262626 75%), linear-gradient(-45deg, transparent 75%, #262626 75%)",
            backgroundSize: "6px 6px",
            backgroundColor: "#171717",
          }}
        >
          <div className="w-4 h-[1.5px] bg-rose-500 -rotate-45 rounded-full" />
        </button>
      )}

      {/* Preset Swatches */}
      {PRESET_COLORS.map((c) => {
        const isSelected = !isTransparentSelected && normalizedCurrent === c.value.toLowerCase();
        return (
          <button
            key={c.value}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundEffects.playClick();
              onChange(c.value);
            }}
            aria-label={c.name}
            title={c.name}
            style={{ backgroundColor: c.value }}
            className={`w-5 h-5 rounded-full transition-all shrink-0 hover:scale-115 cursor-pointer ${c.isWhite ? "border border-zinc-400" : ""
              } ${isSelected
                ? "ring-2 ring-[#20C763] ring-offset-1 ring-offset-[#151917] scale-105"
                : "border border-black/30 hover:border-white/50"
              }`}
          />
        );
      })}

      {/* Recent Custom Colors */}
      {recentCustomColors.map((hex, idx) => {
        const isSelected = !isTransparentSelected && normalizedCurrent === hex.toLowerCase();
        return (
          <button
            key={`custom-${idx}-${hex}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundEffects.playClick();
              onChange(hex);
            }}
            aria-label={`Custom color ${hex}`}
            title={`Custom ${hex}`}
            style={{ backgroundColor: hex }}
            className={`w-5 h-5 rounded-full transition-all shrink-0 hover:scale-115 cursor-pointer ${isSelected
                ? "ring-2 ring-[#20C763] ring-offset-1 ring-offset-[#151917] scale-105"
                : "border border-black/30 hover:border-white/50"
              }`}
          />
        );
      })}

      {/* "+" Add Custom Color Button */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            customInputRef.current?.click();
          }}
          aria-label="Custom color picker"
          title="Pick custom color (+)"
          className="w-5 h-5 rounded-full bg-[#111412] hover:bg-[#1A1D1B] text-[#20C763] border border-[#252A27] hover:border-[#20C763] flex items-center justify-center text-xs font-bold transition-all hover:scale-110 cursor-pointer"
        >
          +
        </button>
        <input
          ref={customInputRef}
          type="color"
          value={normalizedCurrent && !isTransparentSelected ? normalizedCurrent : "#20C763"}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val);
            onAddCustomColor(val);
          }}
          className="opacity-0 absolute inset-0 w-0 h-0 pointer-events-none"
        />
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------

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

  // Canvas Objects Model (All text, images, shapes, signatures)
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);

  // Navigation Dock Sidebar
  const [activeDockTab, setActiveDockTab] = useState<"pages" | "elements" | "text" | "uploads" | "sign" | "outline" | null>("pages");

  // Interaction State Machine
  const [interactionState, setInteractionState] = useState<"idle" | "dragging" | "resizing" | "rotating">("idle");
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }[]>([]);
  const [rotatingAngle, setRotatingAngle] = useState<number | null>(null);

  // Drag / Resize / Rotate Session Reference Data
  const dragSessionRef = useRef<{
    startX: number;
    startY: number;
    startObjects: CanvasObject[];
    initialRotation?: number;
    centerPt?: { x: number; y: number };
    hasMoved?: boolean;
  } | null>(null);

  // Recent custom colors chosen by user
  const [recentCustomColors, setRecentCustomColors] = useState<string[]>([]);

  // Formatting State for Contextual Toolbar
  const [currentFont, setCurrentFont] = useState<string>("Inter");
  const [currentFontSize, setCurrentFontSize] = useState<number>(36);
  const [isBold, setIsBold] = useState<boolean>(true);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isUnderline, setIsUnderline] = useState<boolean>(false);
  const [isStrike, setIsStrike] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>("#111111");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right" | "justify">("left");
  const [lineHeight, setLineHeight] = useState<number>(1.2);
  const [letterSpacing, setLetterSpacing] = useState<number>(0);

  // Shape Styles
  const [shapeBorderColor, setShapeBorderColor] = useState<string>("#20C763");
  const [shapeFillColor, setShapeFillColor] = useState<string>("transparent");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2);

  // Popups & Dropdowns
  const [isFontMenuOpen, setIsFontMenuOpen] = useState<boolean>(false);
  const [isRotateMenuOpen, setIsRotateMenuOpen] = useState<boolean>(false);
  const [customAngleInput, setCustomAngleInput] = useState<string>("");
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);

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
  const [clipboard, setClipboard] = useState<CanvasObject[]>([]);

  // Processing & Loading States
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "saved_just_now">("saved");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Signature Draw Pad State
  const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
  const [typedSigText, setTypedSigText] = useState<string>("");
  const [sigPenColor, setSigPenColor] = useState<string>("#111111");
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false);

  // DOM Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);

  const currentPage = pages[activePageIndex] || pages[0];
  const currentPageNum = activePageIndex + 1;

  // Active page objects sorted by zIndex
  const activePageObjects = canvasObjects
    .filter((obj) => obj.page === currentPageNum)
    .sort((a, b) => a.zIndex - b.zIndex);

  const activeSelectedObject = activePageObjects.find(
    (obj) => selectedObjectIds.length > 0 && (obj.id === editingObjectId || obj.id === selectedObjectIds[selectedObjectIds.length - 1])
  );

  // Helper to add custom colors to recent array (max 5)
  const handleAddCustomColor = (color: string) => {
    if (!color) return;
    setRecentCustomColors((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== color.toLowerCase());
      return [color, ...filtered].slice(0, 5);
    });
  };

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setIsFontMenuOpen(false);
      setIsRotateMenuOpen(false);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // ----------------------------------------------------------------------
  // HISTORY MANAGEMENT
  // ----------------------------------------------------------------------

  const pushHistorySnapshot = useCallback(() => {
    const snapshot: HistorySnapshot = {
      objects: JSON.parse(JSON.stringify(canvasObjects)),
      pages: JSON.parse(JSON.stringify(pages)),
      activePageIndex,
      docTitle,
    };
    setUndoStack((prev) => [...prev.slice(-30), snapshot]);
    setRedoStack([]);
    setSaveStatus("unsaved");
  }, [canvasObjects, pages, activePageIndex, docTitle]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevSnapshot = undoStack[undoStack.length - 1];
    const currentSnapshot: HistorySnapshot = {
      objects: JSON.parse(JSON.stringify(canvasObjects)),
      pages: JSON.parse(JSON.stringify(pages)),
      activePageIndex,
      docTitle,
    };
    setRedoStack((prev) => [...prev, currentSnapshot]);
    setUndoStack((prev) => prev.slice(0, -1));

    setCanvasObjects(prevSnapshot.objects);
    setPages(prevSnapshot.pages);
    setActivePageIndex(prevSnapshot.activePageIndex);
    setDocTitle(prevSnapshot.docTitle);
    setSelectedObjectIds([]);
    setEditingObjectId(null);
    setEditingTextId(null);
    soundEffects.playClick();
  }, [undoStack, canvasObjects, pages, activePageIndex, docTitle]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    const currentSnapshot: HistorySnapshot = {
      objects: JSON.parse(JSON.stringify(canvasObjects)),
      pages: JSON.parse(JSON.stringify(pages)),
      activePageIndex,
      docTitle,
    };
    setUndoStack((prev) => [...prev, currentSnapshot]);
    setRedoStack((prev) => prev.slice(0, -1));

    setCanvasObjects(nextSnapshot.objects);
    setPages(nextSnapshot.pages);
    setActivePageIndex(nextSnapshot.activePageIndex);
    setDocTitle(nextSnapshot.docTitle);
    setSelectedObjectIds([]);
    setEditingObjectId(null);
    setEditingTextId(null);
    soundEffects.playClick();
  }, [redoStack, canvasObjects, pages, activePageIndex, docTitle]);

  // Sync toolbar formatting with selected / editing object
  useEffect(() => {
    if (activeSelectedObject) {
      if (activeSelectedObject.type === "text") {
        setCurrentFont(activeSelectedObject.fontFamily || "Inter");
        setCurrentFontSize(activeSelectedObject.fontSize || 36);
        setIsBold(!!activeSelectedObject.bold);
        setIsItalic(!!activeSelectedObject.italic);
        setIsUnderline(!!activeSelectedObject.underline);
        setIsStrike(!!activeSelectedObject.strikethrough);
        setTextColor(activeSelectedObject.color || "#111111");
        setTextAlign(activeSelectedObject.align || "left");
        setLineHeight(activeSelectedObject.lineHeight || 1.2);
        setLetterSpacing(activeSelectedObject.letterSpacing || 0);
      } else if (activeSelectedObject.type === "shape") {
        setShapeBorderColor(activeSelectedObject.borderColor || "#20C763");
        setShapeFillColor(activeSelectedObject.fillColor || "transparent");
        setShapeStrokeWidth(activeSelectedObject.strokeWidth || 2);
      }
    }
  }, [activeSelectedObject]);

  // ----------------------------------------------------------------------
  // PDF LOADING & RENDERING
  // ----------------------------------------------------------------------

  useEffect(() => {
    if (activeFile && activeFile.file && (!currentFile || currentFile.name !== activeFile.file.name)) {
      handleLoadPdfFile(activeFile.file);
    }
  }, [activeFile]);

  const handleLoadPdfFile = async (file: File) => {
    if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
      alert("Please select a valid PDF file.");
      return;
    }

    try {
      setIsLoadingPdf(true);
      setSaveStatus("saving");
      setStatusMessage("Reading PDF document...");
      soundEffects.playClick();
      setCurrentFile(file);

      const cleanFileName = file.name;
      setDocTitle(cleanFileName);
      setTitleDraft(cleanFileName);

      const buffer = await fileToArrayBuffer(file);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const loadedDoc = await loadingTask.promise;
      setPdfJsDoc(loadedDoc);
      const numPages = loadedDoc.numPages;

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

      // Extract existing text blocks via detection API
      try {
        const detected = await apiDetectPdfHeadings(file);
        if (detected.title && detected.title !== "Untitled Document" && detected.title !== "Document.pdf") {
          setDocTitle(detected.title);
          setTitleDraft(detected.title);
        }

        const rawElements = detected.textElements || detected.headings || [];
        const initialCanvasObjects: CanvasObject[] = rawElements.map((el, idx) => {
          const bbox = el.bbox || [50, 50, 200, 80];
          const x = bbox[0];
          const y = bbox[1];
          const width = Math.max(60, bbox[2] - bbox[0]);
          const height = Math.max(20, bbox[3] - bbox[1]);

          return {
            id: el.id || `detected-text-${idx}`,
            type: "text",
            page: el.page || 1,
            x,
            y,
            width,
            height,
            rotation: 0,
            zIndex: idx + 1,
            text: el.text,
            originalText: el.text,
            fontSize: el.fontSize || 14,
            fontFamily: "Inter",
            color: el.color || "#111111",
            bold: !!el.bold || !!el.isBold,
            italic: !!el.italic,
            align: el.align || "left",
            level: el.level,
            bbox,
            isEdited: false,
          };
        });

        setCanvasObjects(initialCanvasObjects);
      } catch (err) {
        console.warn("Text extraction fallback:", err);
      }

      setSaveStatus("saved");
      setStatusMessage(null);
    } catch (err: any) {
      console.error("PDF Load Error:", err);
      alert(`Could not load PDF: ${err?.message || "Invalid file"}`);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Render PDF Page Canvas
  useEffect(() => {
    if (!pdfJsDoc || pages.length === 0) return;

    let isMounted = true;
    const renderPage = async () => {
      try {
        const pageNum = activePageIndex + 1;
        const page = await pdfJsDoc.getPage(pageNum);
        const desiredScale = zoomLevel * 1.5;
        const viewport = page.getViewport({ scale: desiredScale });

        const canvas = pdfCanvasRef.current;
        if (!canvas || !isMounted) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        setPdfPageViewport({
          width: viewport.width / 1.5,
          height: viewport.height / 1.5,
          scale: zoomLevel,
        });

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error("Page render error:", err);
      }
    };

    renderPage();

    return () => {
      isMounted = false;
    };
  }, [pdfJsDoc, activePageIndex, zoomLevel, pages]);

  // ----------------------------------------------------------------------
  // OBJECT CREATION & INSERTION
  // ----------------------------------------------------------------------

  const handleAddTextObject = (tier: "heading" | "subheading" | "body") => {
    pushHistorySnapshot();
    const newId = `text-${Date.now()}`;
    const fontSz = tier === "heading" ? 36 : tier === "subheading" ? 24 : 14;
    const defaultText =
      tier === "heading" ? "Add a heading" : tier === "subheading" ? "Add a subheading" : "Add body text paragraph";

    const baseWidth = tier === "heading" ? 280 : tier === "subheading" ? 240 : 300;
    const baseHeight = fontSz * 1.6 + 16;

    const pageW = currentPage?.width || 595.28;
    const pageH = currentPage?.height || 841.89;
    const spawnX = Math.max(30, (pageW - baseWidth) / 2);
    const spawnY = Math.max(50, pageH / 3 + (tier === "subheading" ? 50 : tier === "body" ? 90 : 0));

    const maxZIndex = canvasObjects.reduce((max, obj) => Math.max(max, obj.zIndex), 0);

    const newObj: CanvasObject = {
      id: newId,
      type: "text",
      page: currentPageNum,
      x: spawnX,
      y: spawnY,
      width: baseWidth,
      height: baseHeight,
      rotation: 0,
      zIndex: maxZIndex + 1,
      text: defaultText,
      fontSize: fontSz,
      fontFamily: currentFont,
      color: textColor || "#111111",
      bold: tier === "heading",
      italic: false,
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 0,
      level: tier === "heading" ? "H1" : tier === "subheading" ? "H2" : "Body",
      isEdited: true,
    };

    setCanvasObjects((prev) => [...prev, newObj]);
    setSelectedObjectIds([newId]);
    setEditingObjectId(newId);
    setEditingTextId(null);
    soundEffects.playSuccess();
  };

  const handleAddShapeObject = (shapeType: "rectangle" | "circle" | "line" | "arrow") => {
    pushHistorySnapshot();
    const newId = `shape-${Date.now()}`;
    const pageW = currentPage?.width || 595.28;
    const pageH = currentPage?.height || 841.89;
    const width = shapeType === "circle" ? 120 : shapeType === "line" ? 180 : 160;
    const height = shapeType === "circle" ? 120 : shapeType === "line" ? 4 : 100;
    const maxZIndex = canvasObjects.reduce((max, obj) => Math.max(max, obj.zIndex), 0);

    const newObj: CanvasObject = {
      id: newId,
      type: "shape",
      shapeType,
      page: currentPageNum,
      x: (pageW - width) / 2,
      y: (pageH - height) / 2,
      width,
      height,
      rotation: 0,
      zIndex: maxZIndex + 1,
      borderColor: shapeBorderColor || "#20C763",
      fillColor: shapeFillColor || "transparent",
      strokeWidth: shapeStrokeWidth || 2,
      opacity: 1,
    };

    setCanvasObjects((prev) => [...prev, newObj]);
    setSelectedObjectIds([newId]);
    setEditingObjectId(newId);
    soundEffects.playSuccess();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        pushHistorySnapshot();
        const newId = `img-${Date.now()}`;
        const maxZIndex = canvasObjects.reduce((max, obj) => Math.max(max, obj.zIndex), 0);

        const newObj: CanvasObject = {
          id: newId,
          type: "image",
          page: currentPageNum,
          x: 100,
          y: 120,
          width: 240,
          height: 180,
          rotation: 0,
          zIndex: maxZIndex + 1,
          dataUrl,
          opacity: 1,
        };

        setCanvasObjects((prev) => [...prev, newObj]);
        setSelectedObjectIds([newId]);
        setEditingObjectId(newId);
        soundEffects.playSuccess();
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    }
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
      const newId = `sig-${Date.now()}`;
      const maxZIndex = canvasObjects.reduce((max, obj) => Math.max(max, obj.zIndex), 0);

      const newObj: CanvasObject = {
        id: newId,
        type: "signature",
        page: currentPageNum,
        x: 120,
        y: 200,
        width: 180,
        height: 70,
        rotation: 0,
        zIndex: maxZIndex + 1,
        dataUrl: sigDataUrl,
        opacity: 1,
      };

      setCanvasObjects((prev) => [...prev, newObj]);
      setSelectedObjectIds([newId]);
      setEditingObjectId(newId);
      setIsSignatureModalOpen(false);
      soundEffects.playSuccess();
    }
  };

  // ----------------------------------------------------------------------
  // OBJECT SELECTION, DRAGGING, RESIZING, ROTATING
  // ----------------------------------------------------------------------

  const getPdfCoords = (clientX: number, clientY: number) => {
    if (!pageContainerRef.current) return { x: 0, y: 0 };
    const rect = pageContainerRef.current.getBoundingClientRect();
    const scale = pdfPageViewport.scale;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  // Single-Click Selection Handler: Stable, Immediate, Zero Flicker
  const handleObjectMouseDown = (e: React.MouseEvent, obj: CanvasObject) => {
    if (editingTextId === obj.id) return;
    e.stopPropagation();

    const isMulti = e.shiftKey;
    let newSelected = [...selectedObjectIds];

    if (isMulti) {
      if (newSelected.includes(obj.id)) {
        newSelected = newSelected.filter((id) => id !== obj.id);
      } else {
        newSelected.push(obj.id);
      }
    } else {
      newSelected = [obj.id];
    }

    setSelectedObjectIds(newSelected);
    setEditingObjectId(obj.id);
    soundEffects.playClick();

    const { x, y } = getPdfCoords(e.clientX, e.clientY);
    const startObjects = canvasObjects.filter((o) => newSelected.includes(o.id));

    dragSessionRef.current = {
      startX: x,
      startY: y,
      startObjects: JSON.parse(JSON.stringify(startObjects)),
      hasMoved: false,
    };

    setInteractionState("dragging");

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragSessionRef.current) return;
      const current = getPdfCoords(moveEvent.clientX, moveEvent.clientY);
      const dx = current.x - dragSessionRef.current.startX;
      const dy = current.y - dragSessionRef.current.startY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragSessionRef.current.hasMoved = true;
      }

      const updatedIds = dragSessionRef.current.startObjects.map((o) => o.id);
      const startMap = new Map(dragSessionRef.current.startObjects.map((o) => [o.id, o]));

      const primaryStart = dragSessionRef.current.startObjects[0];
      const pageW = currentPage?.width || 595.28;
      const pageH = currentPage?.height || 841.89;
      const proposedX = primaryStart.x + dx;
      const proposedY = primaryStart.y + dy;

      const guides: { x?: number; y?: number }[] = [];
      let snapDx = dx;
      let snapDy = dy;

      const snapThreshold = 6 / zoomLevel;

      if (Math.abs(proposedX + primaryStart.width / 2 - pageW / 2) < snapThreshold) {
        snapDx = pageW / 2 - primaryStart.width / 2 - primaryStart.x;
        guides.push({ x: pageW / 2 });
      }

      if (Math.abs(proposedY + primaryStart.height / 2 - pageH / 2) < snapThreshold) {
        snapDy = pageH / 2 - primaryStart.height / 2 - primaryStart.y;
        guides.push({ y: pageH / 2 });
      }

      setSnapGuides(guides);

      setCanvasObjects((prev) =>
        prev.map((item) => {
          if (updatedIds.includes(item.id)) {
            const start = startMap.get(item.id)!;
            return {
              ...item,
              x: Math.round(start.x + snapDx),
              y: Math.round(start.y + snapDy),
              isEdited: true,
            };
          }
          return item;
        })
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setInteractionState("idle");
      setSnapGuides([]);
      if (dragSessionRef.current?.hasMoved) {
        pushHistorySnapshot();
      }
      dragSessionRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Double-Click Handler: Activates Inline Text Edit Mode
  const handleObjectDoubleClick = (e: React.MouseEvent, obj: CanvasObject) => {
    e.stopPropagation();
    setSelectedObjectIds([obj.id]);
    setEditingObjectId(obj.id);

    if (obj.type === "text") {
      setEditingTextId(obj.id);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 50);
    }
    soundEffects.playClick();
  };

  const handleResizeHandleMouseDown = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    if (!activeSelectedObject) return;

    soundEffects.playClick();
    const { x, y } = getPdfCoords(e.clientX, e.clientY);
    const startObj = { ...activeSelectedObject };

    dragSessionRef.current = {
      startX: x,
      startY: y,
      startObjects: [startObj],
      hasMoved: false,
    };

    setInteractionState("resizing");
    setActiveHandle(handle);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragSessionRef.current) return;
      const current = getPdfCoords(moveEvent.clientX, moveEvent.clientY);
      const dx = current.x - dragSessionRef.current.startX;
      const dy = current.y - dragSessionRef.current.startY;
      const start = dragSessionRef.current.startObjects[0];

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragSessionRef.current.hasMoved = true;
      }

      let newX = start.x;
      let newY = start.y;
      let newWidth = start.width;
      let newHeight = start.height;

      if (handle.includes("e")) {
        newWidth = Math.max(30, start.width + dx);
      } else if (handle.includes("w")) {
        const potentialW = start.width - dx;
        if (potentialW >= 30) {
          newWidth = potentialW;
          newX = start.x + dx;
        }
      }

      if (handle.includes("s")) {
        newHeight = Math.max(16, start.height + dy);
      } else if (handle.includes("n")) {
        const potentialH = start.height - dy;
        if (potentialH >= 16) {
          newHeight = potentialH;
          newY = start.y + dy;
        }
      }

      setCanvasObjects((prev) =>
        prev.map((item) =>
          item.id === start.id
            ? {
              ...item,
              x: Math.round(newX),
              y: Math.round(newY),
              width: Math.round(newWidth),
              height: Math.round(newHeight),
              isEdited: true,
            }
            : item
        )
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setInteractionState("idle");
      setActiveHandle(null);
      if (dragSessionRef.current?.hasMoved) {
        pushHistorySnapshot();
      }
      dragSessionRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Free Rotation Handle with Smooth Snapping and Live Angle Display
  const handleRotateHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeSelectedObject) return;

    soundEffects.playClick();
    const { x, y } = getPdfCoords(e.clientX, e.clientY);
    const startObj = { ...activeSelectedObject };
    const centerPt = {
      x: startObj.x + startObj.width / 2,
      y: startObj.y + startObj.height / 2,
    };

    dragSessionRef.current = {
      startX: x,
      startY: y,
      startObjects: [startObj],
      centerPt,
      initialRotation: startObj.rotation || 0,
      hasMoved: false,
    };

    setInteractionState("rotating");
    setRotatingAngle(Math.round(startObj.rotation || 0));

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragSessionRef.current || !dragSessionRef.current.centerPt) return;
      const current = getPdfCoords(moveEvent.clientX, moveEvent.clientY);
      const cp = dragSessionRef.current.centerPt;

      const angleRad = Math.atan2(current.y - cp.y, current.x - cp.x);
      let angleDeg = Math.round((angleRad * 180) / Math.PI) + 90;
      angleDeg = ((angleDeg % 360) + 360) % 360;

      // Common Snap Angles (0°, 15°, 30°, 45°, 60°, 90°, 120°, 135°, 150°, 180°, 210°, 225°, 240°, 270°, 300°, 315°, 330°, 360°)
      const snapAngles = [0, 15, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
      for (const sa of snapAngles) {
        if (Math.abs(angleDeg - sa) <= 4) {
          angleDeg = sa % 360;
          break;
        }
      }

      dragSessionRef.current.hasMoved = true;
      setRotatingAngle(angleDeg);

      setCanvasObjects((prev) =>
        prev.map((item) =>
          item.id === startObj.id ? { ...item, rotation: angleDeg, isEdited: true } : item
        )
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setInteractionState("idle");
      setRotatingAngle(null);
      if (dragSessionRef.current?.hasMoved) {
        pushHistorySnapshot();
      }
      dragSessionRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleUpdateTextContent = (id: string, newText: string) => {
    setCanvasObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, text: newText, isEdited: true } : o))
    );
  };

  // ----------------------------------------------------------------------
  // ONE-CLICK FORMATTING & COLOR APPLICATION (STAYS STABLE)
  // ----------------------------------------------------------------------

  const handleApplyFormatting = (patch: Partial<CanvasObject>) => {
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : editingObjectId ? [editingObjectId] : [];
    if (targetIds.length === 0) return;
    pushHistorySnapshot();
    setCanvasObjects((prev) =>
      prev.map((o) => (targetIds.includes(o.id) ? { ...o, ...patch, isEdited: true } : o))
    );
  };

  const handleSetShapeFill = (color: string) => {
    setShapeFillColor(color);
    handleApplyFormatting({ fillColor: color });
  };

  const handleSetShapeBorder = (color: string) => {
    setShapeBorderColor(color);
    handleApplyFormatting({ borderColor: color });
  };

  const handleSetTextColor = (color: string) => {
    setTextColor(color);
    handleApplyFormatting({ color });
  };

  const handleBringForward = () => {
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : editingObjectId ? [editingObjectId] : [];
    if (targetIds.length === 0) return;
    pushHistorySnapshot();
    setCanvasObjects((prev) =>
      prev.map((o) => (targetIds.includes(o.id) ? { ...o, zIndex: o.zIndex + 1 } : o))
    );
  };

  const handleSendBackward = () => {
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : editingObjectId ? [editingObjectId] : [];
    if (targetIds.length === 0) return;
    pushHistorySnapshot();
    setCanvasObjects((prev) =>
      prev.map((o) => (targetIds.includes(o.id) ? { ...o, zIndex: Math.max(1, o.zIndex - 1) } : o))
    );
  };

  const handleDuplicateSelected = () => {
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : editingObjectId ? [editingObjectId] : [];
    if (targetIds.length === 0) return;
    pushHistorySnapshot();
    const newItems: CanvasObject[] = [];
    const newIds: string[] = [];

    const maxZ = canvasObjects.reduce((max, o) => Math.max(max, o.zIndex), 0);

    canvasObjects.forEach((obj) => {
      if (targetIds.includes(obj.id)) {
        const newId = `${obj.type}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        newIds.push(newId);
        newItems.push({
          ...obj,
          id: newId,
          x: obj.x + 20,
          y: obj.y + 20,
          rotation: obj.rotation || 0, // Preserves exact rotation!
          zIndex: maxZ + 1,
          isEdited: true,
        });
      }
    });

    setCanvasObjects((prev) => [...prev, ...newItems]);
    setSelectedObjectIds(newIds);
    if (newIds.length > 0) setEditingObjectId(newIds[0]);
    soundEffects.playSuccess();
  };

  const handleDeleteSelected = () => {
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : editingObjectId ? [editingObjectId] : [];
    if (targetIds.length === 0) return;
    pushHistorySnapshot();
    setCanvasObjects((prev) => prev.filter((o) => !targetIds.includes(o.id)));
    setSelectedObjectIds([]);
    setEditingObjectId(null);
    setEditingTextId(null);
    soundEffects.playClick();
  };

  // ----------------------------------------------------------------------
  // KEYBOARD SHORTCUTS (INCLUDING SHIFT + ARROW ROTATION)
  // ----------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        ((e.target as HTMLElement).tagName === "TEXTAREA" && editingTextId)
      ) {
        if (e.key === "Escape") {
          setEditingTextId(null);
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
        } else if (e.key === "c" || e.key === "C") {
          if (selectedObjectIds.length > 0) {
            e.preventDefault();
            const toCopy = canvasObjects.filter((o) => selectedObjectIds.includes(o.id));
            setClipboard(toCopy);
            soundEffects.playClick();
          }
        } else if (e.key === "v" || e.key === "V") {
          if (clipboard.length > 0) {
            e.preventDefault();
            pushHistorySnapshot();
            const maxZ = canvasObjects.reduce((max, o) => Math.max(max, o.zIndex), 0);
            const pastedIds: string[] = [];
            const pastedObjs = clipboard.map((c, i) => {
              const newId = `${c.type}-paste-${Date.now()}-${i}`;
              pastedIds.push(newId);
              return {
                ...c,
                id: newId,
                page: currentPageNum,
                x: c.x + 20,
                y: c.y + 20,
                rotation: c.rotation || 0,
                zIndex: maxZ + i + 1,
                isEdited: true,
              };
            });
            setCanvasObjects((prev) => [...prev, ...pastedObjs]);
            setSelectedObjectIds(pastedIds);
            if (pastedIds.length > 0) setEditingObjectId(pastedIds[0]);
            soundEffects.playSuccess();
          }
        } else if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          handleDuplicateSelected();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          handleExportPdf();
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedObjectIds.length > 0 || editingObjectId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }

      // Escape exits editing mode first, then deselects on second escape
      if (e.key === "Escape") {
        if (editingTextId) {
          setEditingTextId(null);
        } else if (editingObjectId) {
          setEditingObjectId(null);
        } else {
          setSelectedObjectIds([]);
        }
      }

      // Keyboard Rotation: Shift + ArrowLeft / ArrowRight
      if (selectedObjectIds.length > 0) {
        if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
          const step = e.altKey ? 15 : 1;
          const delta = e.key === "ArrowRight" ? step : -step;
          setCanvasObjects((prev) =>
            prev.map((o) => {
              if (selectedObjectIds.includes(o.id)) {
                const currentRot = o.rotation || 0;
                const nextRot = (((currentRot + delta) % 360) + 360) % 360;
                return { ...o, rotation: Math.round(nextRot), isEdited: true };
              }
              return o;
            })
          );
          return;
        }

        // Nudge Movement: Arrow keys
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;

          setCanvasObjects((prev) =>
            prev.map((o) =>
              selectedObjectIds.includes(o.id)
                ? { ...o, x: o.x + dx, y: o.y + dy, isEdited: true }
                : o
            )
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedObjectIds, editingObjectId, editingTextId, clipboard, canvasObjects, handleUndo, handleRedo]);

  // ----------------------------------------------------------------------
  // PAGE MANAGEMENT
  // ----------------------------------------------------------------------

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
    const target = pages[idx];
    const newPage: DocumentPage = {
      ...target,
      id: `page-dup-${Date.now()}`,
      pageNumber: pages.length + 1,
    };
    const nextPages = [...pages.slice(0, idx + 1), newPage, ...pages.slice(idx + 1)];
    setPages(nextPages);
    setActivePageIndex(idx + 1);
    soundEffects.playSuccess();
  };

  const handleDeletePage = (idx: number) => {
    if (pages.length <= 1) {
      alert("A document must contain at least one page.");
      return;
    }
    pushHistorySnapshot();
    const nextPages = pages.filter((_, i) => i !== idx);
    setPages(nextPages);
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

  // ----------------------------------------------------------------------
  // PDF EXPORT (PRESERVES EXACT ROTATION)
  // ----------------------------------------------------------------------

  const handleExportPdf = async () => {
    soundEffects.playClick();
    setIsExporting(true);
    setSaveStatus("saving");
    setStatusMessage("Exporting document...");

    try {
      if (!currentFile && !isImportedPdfMode) {
        throw new Error("No PDF document loaded.");
      }

      const pageOrder = pages.map((p) => p.originalIndex);
      const pageRotations: Record<number, number> = {};
      pages.forEach((p, idx) => {
        if (p.rotation) pageRotations[idx + 1] = p.rotation;
      });

      const textElementsPayload = canvasObjects
        .filter((o) => o.type === "text")
        .map((o) => ({
          id: o.id,
          page: o.page,
          text: o.text || "",
          originalText: o.originalText || "",
          bbox: o.bbox || [o.x, o.y, o.x + o.width, o.y + o.height],
          fontSize: o.fontSize || 14,
          color: o.color || "#111111",
          bold: !!o.bold,
          italic: !!o.italic,
          align: o.align || "left",
          rotation: o.rotation || 0,
          isEdited: !!o.isEdited,
          highlight: o.highlight,
        }));

      const insertedElementsPayload = canvasObjects
        .filter((o) => o.type !== "text" || !o.originalText)
        .map((o) => ({
          id: o.id,
          type: o.type,
          page: o.page,
          x: o.x,
          y: o.y,
          width: o.width,
          height: o.height,
          rotation: o.rotation || 0,
          text: o.text,
          fontSize: o.fontSize,
          color: o.color,
          bold: o.bold,
          italic: o.italic,
          shapeType: o.shapeType,
          borderColor: o.borderColor,
          fillColor: o.fillColor,
          strokeWidth: o.strokeWidth,
          dataUrl: o.dataUrl,
        }));

      const exportedBytes = await apiExportOrganizedPdf(currentFile!, {
        title: docTitle,
        text_elements: textElementsPayload as any,
        inserted_elements: insertedElementsPayload as any,
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

      if (user) {
        apiRecordDownload(safeBytes, exportName, "Edit PDF")
          .then(() => onDownloadRecorded && onDownloadRecorded())
          .catch((err) => console.warn("Backend download record:", err));
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
      alert(`Export Failed: ${err?.message || "Could not generate PDF"}`);
      setSaveStatus("unsaved");
    } finally {
      setIsExporting(false);
      setStatusMessage(null);
    }
  };

  // ----------------------------------------------------------------------
  // RENDER SELECTION BOX & 8 HANDLES + ROTATION HANDLE WITH ANGLE BADGE
  // ----------------------------------------------------------------------

  const renderSelectionBox = (obj: CanvasObject) => {
    const isSelected = selectedObjectIds.includes(obj.id);
    if (!isSelected) return null;

    const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

    const handlePositions: Record<ResizeHandle, { left: string; top: string; cursor: string }> = {
      nw: { left: "-4px", top: "-4px", cursor: "nwse-resize" },
      n: { left: "calc(50% - 4px)", top: "-4px", cursor: "ns-resize" },
      ne: { left: "calc(100% - 4px)", top: "-4px", cursor: "nesw-resize" },
      e: { left: "calc(100% - 4px)", top: "calc(50% - 4px)", cursor: "ew-resize" },
      se: { left: "calc(100% - 4px)", top: "calc(100% - 4px)", cursor: "nwse-resize" },
      s: { left: "calc(50% - 4px)", top: "calc(100% - 4px)", cursor: "ns-resize" },
      sw: { left: "-4px", top: "calc(100% - 4px)", cursor: "nesw-resize" },
      w: { left: "-4px", top: "calc(50% - 4px)", cursor: "ew-resize" },
    };

    return (
      <div className="absolute inset-0 pointer-events-none border-[1.5px] border-[#20C763] select-none z-50">
        {/* Rotation Handle (Centered above top border) */}
        <div
          onMouseDown={handleRotateHandleMouseDown}
          className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing group/rot"
          title="Drag to rotate freely (Snaps to 15°, 45°, 90°)"
        >
          <div className="w-3.5 h-3.5 rounded-full bg-[#111412] border-[1.5px] border-[#20C763] flex items-center justify-center shadow-md group-hover/rot:scale-115 transition-transform">
            <div className="w-1 h-1 rounded-full bg-[#20C763]" />
          </div>
          <div className="w-[1.5px] h-3 bg-[#20C763]" />

          {/* Real-time Angle Display Badge */}
          {interactionState === "rotating" && rotatingAngle !== null && (
            <div className="absolute -top-6 bg-[#111412] border border-[#20C763] text-[#20C763] font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
              {rotatingAngle}°
            </div>
          )}
        </div>

        {/* 8 Resize Handles */}
        {handles.map((h) => {
          const pos = handlePositions[h];
          return (
            <div
              key={h}
              onMouseDown={(e) => handleResizeHandleMouseDown(e, h)}
              style={{
                left: pos.left,
                top: pos.top,
                cursor: pos.cursor,
              }}
              className="absolute w-2.5 h-2.5 bg-white border-[1.5px] border-[#20C763] rounded-xs shadow-xs pointer-events-auto hover:bg-[#20C763] transition-colors"
            />
          );
        })}
      </div>
    );
  };

  // Reusable Top Toolbar Rotation Controls Component
  const renderToolbarRotateControls = () => {
    if (!activeSelectedObject) return null;
    const currentAngle = Math.round(activeSelectedObject.rotation || 0);

    return (
      <div className="relative flex items-center shrink-0">
        <div className="flex items-center bg-[#111412] border border-[#252A27] rounded overflow-hidden">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const nextRot = (currentAngle + 90) % 360;
              handleApplyFormatting({ rotation: nextRot });
            }}
            className="flex items-center gap-1 px-2 py-1 text-zinc-300 hover:text-white hover:bg-[#151917] transition-colors cursor-pointer"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-3 h-3 text-[#20C763]" />
            <span className="font-mono text-xs font-semibold">{currentAngle}°</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsRotateMenuOpen(!isRotateMenuOpen);
              setCustomAngleInput(String(currentAngle));
            }}
            className="px-1.5 py-1 text-zinc-400 hover:text-white hover:bg-[#151917] border-l border-[#252A27] transition-colors cursor-pointer"
            title="Rotation Options"
          >
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Rotation Dropdown Menu */}
        {isRotateMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full right-0 mt-1 bg-[#151917] border border-[#252A27] rounded-md shadow-2xl p-2 w-48 flex flex-col gap-1 z-50 text-xs select-none"
          >
            <button
              onClick={() => {
                handleApplyFormatting({ rotation: (currentAngle + 90) % 360 });
                setIsRotateMenuOpen(false);
              }}
              className="w-full text-left px-2 py-1 rounded text-zinc-300 hover:bg-[#111412] hover:text-[#20C763] flex items-center justify-between cursor-pointer"
            >
              <span>Rotate 90° CW</span>
              <span className="text-[10px] text-zinc-500 font-mono">+90°</span>
            </button>
            <button
              onClick={() => {
                handleApplyFormatting({ rotation: (((currentAngle - 90) % 360) + 360) % 360 });
                setIsRotateMenuOpen(false);
              }}
              className="w-full text-left px-2 py-1 rounded text-zinc-300 hover:bg-[#111412] hover:text-[#20C763] flex items-center justify-between cursor-pointer"
            >
              <span>Rotate 90° CCW</span>
              <span className="text-[10px] text-zinc-500 font-mono">-90°</span>
            </button>
            <button
              onClick={() => {
                handleApplyFormatting({ rotation: (currentAngle + 180) % 360 });
                setIsRotateMenuOpen(false);
              }}
              className="w-full text-left px-2 py-1 rounded text-zinc-300 hover:bg-[#111412] hover:text-[#20C763] flex items-center justify-between cursor-pointer"
            >
              <span>Rotate 180°</span>
              <span className="text-[10px] text-zinc-500 font-mono">180°</span>
            </button>
            <button
              onClick={() => {
                handleApplyFormatting({ rotation: 0 });
                setIsRotateMenuOpen(false);
              }}
              className="w-full text-left px-2 py-1 rounded text-zinc-300 hover:bg-[#111412] hover:text-rose-400 flex items-center justify-between cursor-pointer"
            >
              <span>Reset rotation</span>
              <span className="text-[10px] text-zinc-500 font-mono">0°</span>
            </button>

            <div className="h-px bg-[#252A27] my-1" />

            {/* Custom Exact Angle Form */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-zinc-400 font-medium shrink-0">Angle:</span>
              <div className="flex items-center bg-[#111412] border border-[#252A27] rounded px-1.5 py-0.5 flex-1">
                <input
                  type="number"
                  value={customAngleInput}
                  onChange={(e) => setCustomAngleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const ang = ((Number(customAngleInput) % 360) + 360) % 360;
                      handleApplyFormatting({ rotation: Math.round(ang) });
                      setIsRotateMenuOpen(false);
                    }
                  }}
                  className="w-full bg-transparent text-xs text-[#F5F7F6] font-mono focus:outline-none"
                />
                <span className="text-[10px] text-zinc-500 font-bold">°</span>
              </div>
              <button
                onClick={() => {
                  const ang = ((Number(customAngleInput) % 360) + 360) % 360;
                  handleApplyFormatting({ rotation: Math.round(ang) });
                  setIsRotateMenuOpen(false);
                }}
                className="px-2 py-1 bg-[#20C763] hover:bg-[#28D66D] text-black font-semibold text-[10px] rounded cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ----------------------------------------------------------------------
  // JSX RETURN
  // ----------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-[#0B0D0C] text-[#F5F7F6] select-none overflow-hidden font-sans border-0">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP APPLICATION BAR */}
      {/* ------------------------------------------------------------- */}
      <header className="h-12 bg-[#111412] border-b border-[#252A27] px-4 flex items-center justify-between gap-3 shrink-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => onSelectTool("all")}
            className="w-7 h-7 rounded-md bg-[#151917] hover:bg-[#1A1D1B] text-[#9AA39E] hover:text-[#F5F7F6] border border-[#252A27] flex items-center justify-center transition-colors cursor-pointer"
            title="Back to All Tools"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#151917] border border-[#252A27] text-xs font-semibold text-[#F5F7F6]">
            <span className="text-[#20C763]">OurPDF</span>
            <span className="text-zinc-500 font-normal">/</span>
            <span className="text-zinc-300 font-medium">Editor</span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
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
                className="bg-[#151917] text-[#F5F7F6] text-xs font-semibold px-2 py-1 rounded-md border border-[#20C763] focus:outline-none"
                autoFocus
              />
            ) : (
              <div
                onClick={() => {
                  setTitleDraft(docTitle);
                  setIsEditingTitle(true);
                }}
                className="group flex items-center gap-1.5 cursor-pointer hover:bg-[#151917] px-2 py-1 rounded-md transition-colors"
                title="Click to rename"
              >
                <span className="text-xs font-medium text-[#F5F7F6] truncate max-w-[200px]">{docTitle}</span>
                <Edit2 className="w-3 h-3 text-[#9AA39E] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}

            <span className="text-[10px] text-[#9AA39E] font-mono ml-1 hidden sm:inline">
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved_just_now"
                  ? "Saved"
                  : statusMessage || "Ready"}
            </span>
          </div>
        </div>

        {/* Center: Undo / Redo */}
        <div className="flex items-center gap-1 bg-[#151917] border border-[#252A27] rounded-md p-0.5">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${undoStack.length > 0 ? "text-[#F5F7F6] hover:bg-[#1A1D1B] cursor-pointer" : "text-zinc-600 cursor-not-allowed"
              }`}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${redoStack.length > 0 ? "text-[#F5F7F6] hover:bg-[#1A1D1B] cursor-pointer" : "text-zinc-600 cursor-not-allowed"
              }`}
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hidden sm:flex items-center gap-1.5 bg-[#151917] hover:bg-[#1A1D1B] text-zinc-300 text-xs font-medium px-3 py-1.5 rounded-md border border-[#252A27] transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#20C763]" />
            <span>Open PDF</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 bg-[#20C763] hover:bg-[#28D66D] text-black font-semibold text-xs px-3.5 py-1.5 rounded-md transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Export PDF</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. THE ONLY CONTEXTUAL OBJECT TOOLBAR (ZERO BLINK + ROTATION) */}
      {/* ------------------------------------------------------------- */}
      <div
        className="min-h-11 bg-[#151917] border-b border-[#252A27] px-4 py-1 flex items-center justify-between text-xs shrink-0 select-none z-30 overflow-x-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Left Context Controls (Reactive to selected / editing object) */}
        <div className="flex items-center gap-2.5 shrink-0 pr-3">
          {/* ========================================================= */}
          {/* A. TEXT OBJECT CONTROLS */}
          {/* ========================================================= */}
          {activeSelectedObject?.type === "text" ? (
            <>
              {/* Font Family Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFontMenuOpen(!isFontMenuOpen);
                  }}
                  className="flex items-center justify-between w-26 px-2 py-1 rounded bg-[#111412] border border-[#252A27] hover:border-zinc-600 text-xs text-[#F5F7F6] font-medium cursor-pointer"
                >
                  <span className="truncate">{currentFont}</span>
                  <ChevronDown className="w-3 h-3 text-[#9AA39E]" />
                </button>

                {isFontMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-[#151917] border border-[#252A27] rounded-md shadow-xl p-1 w-36 flex flex-col gap-0.5 z-50">
                    {["Inter", "Helvetica", "Arial", "Times New Roman", "Georgia", "Courier New", "Roboto"].map((f) => (
                      <button
                        key={f}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentFont(f);
                          handleApplyFormatting({ fontFamily: f });
                          setIsFontMenuOpen(false);
                        }}
                        className="px-2 py-1 text-left text-xs rounded text-zinc-300 hover:bg-[#111412] hover:text-[#20C763] cursor-pointer"
                        style={{ fontFamily: f }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Font Size Stepper */}
              <div className="flex items-center bg-[#111412] border border-[#252A27] rounded px-1 py-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const prev = Math.max(8, currentFontSize - 2);
                    setCurrentFontSize(prev);
                    handleApplyFormatting({ fontSize: prev });
                  }}
                  className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white font-bold cursor-pointer"
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
                  className="w-8 text-center bg-transparent text-xs font-bold text-[#F5F7F6] focus:outline-none"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = currentFontSize + 2;
                    setCurrentFontSize(next);
                    handleApplyFormatting({ fontSize: next });
                  }}
                  className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white font-bold cursor-pointer"
                >
                  +
                </button>
              </div>

              <div className="h-4 w-px bg-[#252A27] mx-0.5" />

              {/* ONE-CLICK TEXT COLOR SWATCHES ROW */}
              <ColorSwatchRow
                label="Text"
                currentColor={activeSelectedObject.color || textColor}
                onChange={handleSetTextColor}
                recentCustomColors={recentCustomColors}
                onAddCustomColor={handleAddCustomColor}
              />

              <div className="h-4 w-px bg-[#252A27] mx-0.5" />

              {/* Bold */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const n = !isBold;
                  setIsBold(n);
                  handleApplyFormatting({ bold: n });
                }}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${isBold ? "bg-[#20C763] text-black font-bold" : "text-zinc-400 hover:text-white hover:bg-[#111412]"
                  }`}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>

              {/* Italic */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const n = !isItalic;
                  setIsItalic(n);
                  handleApplyFormatting({ italic: n });
                }}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${isItalic ? "bg-[#20C763] text-black font-bold" : "text-zinc-400 hover:text-white hover:bg-[#111412]"
                  }`}
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>

              {/* Underline */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const n = !isUnderline;
                  setIsUnderline(n);
                  handleApplyFormatting({ underline: n });
                }}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${isUnderline ? "bg-[#20C763] text-black font-bold" : "text-zinc-400 hover:text-white hover:bg-[#111412]"
                  }`}
                title="Underline"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>

              {/* Align */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const order: ("left" | "center" | "right" | "justify")[] = ["left", "center", "right", "justify"];
                  const nextAlign = order[(order.indexOf(textAlign) + 1) % order.length];
                  setTextAlign(nextAlign);
                  handleApplyFormatting({ align: nextAlign });
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title={`Alignment (${textAlign})`}
              >
                {textAlign === "left" && <AlignLeft className="w-3.5 h-3.5" />}
                {textAlign === "center" && <AlignCenter className="w-3.5 h-3.5" />}
                {textAlign === "right" && <AlignRight className="w-3.5 h-3.5" />}
                {textAlign === "justify" && <AlignJustify className="w-3.5 h-3.5" />}
              </button>

              <div className="h-4 w-px bg-[#252A27] mx-0.5" />

              {/* Complete Rotation Control */}
              {renderToolbarRotateControls()}

              <div className="h-4 w-px bg-[#252A27] mx-0.5" />

              {/* Layer Controls & Duplicate */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBringForward();
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title="Bring Forward"
              >
                <MoveUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendBackward();
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title="Send Backward"
              >
                <MoveDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateSelected();
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title="Duplicate (Ctrl+D)"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSelected();
                }}
                className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 ml-0.5 cursor-pointer"
                title="Delete (Delete)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : activeSelectedObject?.type === "shape" ? (
            <>
              {/* ========================================================= */}
              {/* B. SHAPE OBJECT CONTROLS (PRIMARY SINGLE-LOCATION) */}
              {/* ========================================================= */}
              {/* 1. ONE-CLICK FILL SWATCHES */}
              <ColorSwatchRow
                label="Fill"
                currentColor={activeSelectedObject.fillColor || "transparent"}
                onChange={handleSetShapeFill}
                allowTransparent={true}
                recentCustomColors={recentCustomColors}
                onAddCustomColor={handleAddCustomColor}
              />

              <div className="h-4 w-px bg-[#252A27] mx-1" />

              {/* 2. ONE-CLICK BORDER SWATCHES */}
              <ColorSwatchRow
                label="Border"
                currentColor={activeSelectedObject.borderColor || "#20C763"}
                onChange={handleSetShapeBorder}
                allowTransparent={false}
                recentCustomColors={recentCustomColors}
                onAddCustomColor={handleAddCustomColor}
              />

              <div className="h-4 w-px bg-[#252A27] mx-1" />

              {/* 3. BORDER WIDTH STEPPER */}
              <div className="flex items-center gap-1 bg-[#111412] border border-[#252A27] rounded px-1.5 py-0.5">
                <span className="text-[10px] text-[#9AA39E] font-medium">Width:</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const w = Math.max(1, (activeSelectedObject.strokeWidth || 2) - 1);
                    handleApplyFormatting({ strokeWidth: w });
                  }}
                  className="w-4 h-4 text-zinc-400 hover:text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  −
                </button>
                <span className="text-xs font-mono font-bold text-[#F5F7F6] w-5 text-center">
                  {activeSelectedObject.strokeWidth || 2}px
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const w = Math.min(16, (activeSelectedObject.strokeWidth || 2) + 1);
                    handleApplyFormatting({ strokeWidth: w });
                  }}
                  className="w-4 h-4 text-zinc-400 hover:text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* 4. OPACITY STEPPER */}
              <div className="flex items-center gap-1 bg-[#111412] border border-[#252A27] rounded px-1.5 py-0.5">
                <span className="text-[10px] text-[#9AA39E] font-medium">Opacity:</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const op = Math.max(0.1, ((activeSelectedObject.opacity ?? 1) - 0.15));
                    handleApplyFormatting({ opacity: Number(op.toFixed(2)) });
                  }}
                  className="w-4 h-4 text-zinc-400 hover:text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  −
                </button>
                <span className="text-xs font-mono font-bold text-[#F5F7F6] w-7 text-center">
                  {Math.round((activeSelectedObject.opacity ?? 1) * 100)}%
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const op = Math.min(1, ((activeSelectedObject.opacity ?? 1) + 0.15));
                    handleApplyFormatting({ opacity: Number(op.toFixed(2)) });
                  }}
                  className="w-4 h-4 text-zinc-400 hover:text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>

              <div className="h-4 w-px bg-[#252A27] mx-0.5" />

              {/* Complete Rotation Control */}
              {renderToolbarRotateControls()}

              <div className="h-4 w-px bg-[#252A27] mx-0.5" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBringForward();
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title="Bring Forward"
              >
                <MoveUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendBackward();
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title="Send Backward"
              >
                <MoveDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateSelected();
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title="Duplicate (Ctrl+D)"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSelected();
                }}
                className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 ml-0.5 cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : activeSelectedObject?.type === "image" || activeSelectedObject?.type === "signature" ? (
            <>
              {/* ========================================================= */}
              {/* C. IMAGE & SIGNATURE CONTROLS */}
              {/* ========================================================= */}
              <span className="text-zinc-400 text-xs font-semibold mr-1">
                {activeSelectedObject.type === "image" ? "Image" : "Signature"}:
              </span>

              {/* Opacity Control */}
              <div className="flex items-center gap-1 bg-[#111412] border border-[#252A27] rounded px-1.5 py-0.5">
                <span className="text-[10px] text-[#9AA39E] font-medium">Opacity:</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const op = Math.max(0.1, ((activeSelectedObject.opacity ?? 1) - 0.15));
                    handleApplyFormatting({ opacity: Number(op.toFixed(2)) });
                  }}
                  className="w-4 h-4 text-zinc-400 hover:text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  −
                </button>
                <span className="text-xs font-mono font-bold text-[#F5F7F6] w-7 text-center">
                  {Math.round((activeSelectedObject.opacity ?? 1) * 100)}%
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const op = Math.min(1, ((activeSelectedObject.opacity ?? 1) + 0.15));
                    handleApplyFormatting({ opacity: Number(op.toFixed(2)) });
                  }}
                  className="w-4 h-4 text-zinc-400 hover:text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Complete Rotation Control */}
              {renderToolbarRotateControls()}

              <div className="h-4 w-px bg-[#252A27] mx-0.5" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBringForward();
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title="Bring Forward"
              >
                <MoveUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendBackward();
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title="Send Backward"
              >
                <MoveDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateSelected();
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#111412] cursor-pointer"
                title="Duplicate"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSelected();
                }}
                className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 ml-0.5 cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <span className="text-zinc-500 text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#20C763]" />
              Click any shape, text, or image to open instant one-click color & rotation controls
            </span>
          )}
        </div>

        {/* Right Zoom & Page Controls */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="flex items-center bg-[#111412] border border-[#252A27] rounded px-1 py-0.5 text-xs text-zinc-300">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              className="w-5 h-5 flex items-center justify-center hover:text-[#20C763] cursor-pointer"
              title="Zoom out"
            >
              −
            </button>
            <span className="w-12 text-center font-mono text-[11px]">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.25))}
              className="w-5 h-5 flex items-center justify-center hover:text-[#20C763] cursor-pointer"
              title="Zoom in"
            >
              +
            </button>
          </div>

          <span className="text-[11px] text-zinc-500 font-mono hidden md:inline">
            Page {currentPageNum} of {pages.length}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN WORKSPACE BODY (LEFT DOCK + STAGE) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Leftmost Vertical Icon Dock */}
        <div className="w-14 bg-[#111412] border-r border-[#252A27] flex flex-col items-center py-2 gap-2 shrink-0 z-30 select-none">
          {[
            { id: "pages", label: "Pages", icon: Layers },
            { id: "text", label: "Text", icon: Type },
            { id: "elements", label: "Shapes", icon: Shapes },
            { id: "uploads", label: "Uploads", icon: ImageIcon },
            { id: "sign", label: "Sign", icon: FileSignature },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeDockTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundEffects.playClick();
                  setActiveDockTab(activeDockTab === tab.id ? null : (tab.id as any));
                }}
                className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${isActive
                    ? "bg-[#20C763]/10 text-[#20C763] border border-[#20C763]/30"
                    : "text-[#9AA39E] hover:text-[#F5F7F6] hover:bg-[#151917]"
                  }`}
                title={tab.label}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] mt-0.5 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Collapsible Left Panel Drawer (TOOLS ONLY - NO PROPERTIES/DUPLICATE COLOR CONTROLS) */}
        {activeDockTab && (
          <div className="w-64 bg-[#151917] border-r border-[#252A27] flex flex-col shrink-0 z-20 overflow-y-auto custom-scrollbar">
            {/* Drawer Header */}
            <div className="h-10 px-3.5 border-b border-[#252A27] flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                {activeDockTab === "pages" && "Document Pages"}
                {activeDockTab === "text" && "Floating Text"}
                {activeDockTab === "elements" && "Geometric Shapes"}
                {activeDockTab === "uploads" && "Image Uploads"}
                {activeDockTab === "sign" && "Sign Document"}
              </span>
              <button
                onClick={() => setActiveDockTab(null)}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Drawer Contents */}
            <div className="p-3 flex flex-col gap-3.5">
              {/* TAB 1: PAGES */}
              {activeDockTab === "pages" && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleAddBlankPage}
                    className="w-full flex items-center justify-center gap-1.5 bg-[#111412] hover:bg-[#1A1D1B] text-[#20C763] text-xs font-semibold py-2 rounded-md border border-[#252A27] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Blank Page</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {pages.map((p, idx) => {
                      const isCurrent = idx === activePageIndex;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            soundEffects.playClick();
                            setActivePageIndex(idx);
                          }}
                          className={`group relative flex flex-col rounded-md border p-1.5 cursor-pointer transition-all ${isCurrent
                              ? "border-[#20C763] bg-[#111412]"
                              : "border-[#252A27] bg-[#111412]/50 hover:border-zinc-600"
                            }`}
                        >
                          <div className="aspect-[1/1.4] bg-white rounded-xs overflow-hidden flex items-center justify-center relative">
                            {p.thumbnailUrl ? (
                              <img src={p.thumbnailUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                            ) : (
                              <FileText className="w-6 h-6 text-zinc-400" />
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-1 px-0.5">
                            <span className="text-[10px] font-mono text-zinc-400">P.{idx + 1}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRotatePage(idx);
                                }}
                                className="text-zinc-400 hover:text-white cursor-pointer"
                                title="Rotate"
                              >
                                <RotateCw className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePage(idx);
                                }}
                                className="text-zinc-400 hover:text-rose-400 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: TEXT */}
              {activeDockTab === "text" && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] text-[#9AA39E]">
                    Click a tier to add a floating text block to the canvas:
                  </p>

                  <button
                    onClick={() => handleAddTextObject("heading")}
                    className="w-full text-left p-3 rounded-md bg-[#111412] hover:bg-[#1A1D1B] border border-[#252A27] hover:border-[#20C763] transition-all cursor-pointer group"
                  >
                    <h3 className="text-lg font-bold text-[#F5F7F6] group-hover:text-[#20C763]">Heading</h3>
                    <p className="text-[10px] text-[#9AA39E] mt-0.5">36pt Bold title block</p>
                  </button>

                  <button
                    onClick={() => handleAddTextObject("subheading")}
                    className="w-full text-left p-3 rounded-md bg-[#111412] hover:bg-[#1A1D1B] border border-[#252A27] hover:border-[#20C763] transition-all cursor-pointer group"
                  >
                    <h4 className="text-sm font-semibold text-[#F5F7F6] group-hover:text-[#20C763]">Subheading</h4>
                    <p className="text-[10px] text-[#9AA39E] mt-0.5">24pt Medium section header</p>
                  </button>

                  <button
                    onClick={() => handleAddTextObject("body")}
                    className="w-full text-left p-3 rounded-md bg-[#111412] hover:bg-[#1A1D1B] border border-[#252A27] hover:border-[#20C763] transition-all cursor-pointer group"
                  >
                    <p className="text-xs text-[#F5F7F6] group-hover:text-[#20C763]">Body text paragraph</p>
                    <p className="text-[10px] text-[#9AA39E] mt-0.5">14pt Regular text block</p>
                  </button>
                </div>
              )}

              {/* TAB 3: SHAPES (INSERT TOOLS ONLY - STRICTLY NO DUPLICATE COLOR CONTROLS) */}
              {activeDockTab === "elements" && (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Insert Shapes
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAddShapeObject("rectangle")}
                      className="p-3 rounded-md bg-[#111412] hover:bg-[#1A1D1B] border border-[#252A27] flex flex-col items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer group"
                    >
                      <Square className="w-5 h-5 text-[#20C763] group-hover:scale-110 transition-transform" />
                      <span>Rectangle</span>
                    </button>
                    <button
                      onClick={() => handleAddShapeObject("circle")}
                      className="p-3 rounded-md bg-[#111412] hover:bg-[#1A1D1B] border border-[#252A27] flex flex-col items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer group"
                    >
                      <Circle className="w-5 h-5 text-[#20C763] group-hover:scale-110 transition-transform" />
                      <span>Circle</span>
                    </button>
                    <button
                      onClick={() => handleAddShapeObject("line")}
                      className="p-3 rounded-md bg-[#111412] hover:bg-[#1A1D1B] border border-[#252A27] flex flex-col items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer group"
                    >
                      <Minus className="w-5 h-5 text-[#20C763] group-hover:scale-110 transition-transform" />
                      <span>Line</span>
                    </button>
                    <button
                      onClick={() => handleAddShapeObject("arrow")}
                      className="p-3 rounded-md bg-[#111412] hover:bg-[#1A1D1B] border border-[#252A27] flex flex-col items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer group"
                    >
                      <ArrowRight className="w-5 h-5 text-[#20C763] group-hover:scale-110 transition-transform" />
                      <span>Arrow</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: UPLOADS */}
              {activeDockTab === "uploads" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] text-[#9AA39E]">Upload and place images onto the canvas:</p>
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 bg-[#20C763] hover:bg-[#28D66D] text-black font-semibold text-xs py-2 rounded-md transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Upload Image</span>
                  </button>
                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* TAB 5: SIGN */}
              {activeDockTab === "sign" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] text-[#9AA39E]">Create or draw your signature to place on documents:</p>
                  <button
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 bg-[#20C763] hover:bg-[#28D66D] text-black font-semibold text-xs py-2 rounded-md transition-colors cursor-pointer"
                  >
                    <FileSignature className="w-4 h-4" />
                    <span>Create Signature</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* 4. CANVAS ARTBOARD STAGE */}
        {/* ------------------------------------------------------------- */}
        <div
          onMouseDown={(e) => {
            // Deselect only when directly clicking the blank outer canvas backdrop
            if (e.target === e.currentTarget) {
              setSelectedObjectIds([]);
              setEditingObjectId(null);
              setEditingTextId(null);
            }
          }}
          className="flex-1 bg-[#1A1D1B] overflow-auto flex flex-col items-center justify-start p-8 custom-scrollbar relative select-none"
        >
          {/* Main Printable PDF Page Artboard */}
          <div
            ref={pageContainerRef}
            onMouseDown={(e) => {
              // Deselect only if clicking the blank background of the page itself
              if (e.target === e.currentTarget) {
                setSelectedObjectIds([]);
                setEditingObjectId(null);
                setEditingTextId(null);
              }
            }}
            className="relative bg-white shadow-[0_4px_28px_rgba(0,0,0,0.6)] rounded-xs border border-zinc-300 select-none"
            style={{
              width: pdfPageViewport.width,
              height: pdfPageViewport.height,
            }}
          >
            {/* Background PDF Render Layer */}
            <canvas ref={pdfCanvasRef} className="block w-full h-full pointer-events-none" />

            {/* Alignment Guide Snap Lines */}
            {snapGuides.map((guide, idx) => (
              <React.Fragment key={idx}>
                {guide.x !== undefined && (
                  <div
                    className="absolute top-0 bottom-0 border-l border-dashed border-[#20C763] pointer-events-none z-50"
                    style={{ left: `${guide.x * pdfPageViewport.scale}px` }}
                  />
                )}
                {guide.y !== undefined && (
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-[#20C763] pointer-events-none z-50"
                    style={{ top: `${guide.y * pdfPageViewport.scale}px` }}
                  />
                )}
              </React.Fragment>
            ))}

            {/* Interactive Canvas Objects Layer */}
            {activePageObjects.map((obj) => {
              const scale = pdfPageViewport.scale;
              const x = obj.x * scale;
              const y = obj.y * scale;
              const w = obj.width * scale;
              const h = obj.height * scale;
              const isSelected = selectedObjectIds.includes(obj.id);
              const isEditing = editingTextId === obj.id;
              const rot = obj.rotation || 0;

              return (
                <div
                  key={obj.id}
                  onMouseDown={(e) => handleObjectMouseDown(e, obj)}
                  onDoubleClick={(e) => handleObjectDoubleClick(e, obj)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={() => setHoveredObjectId(obj.id)}
                  onMouseLeave={() => setHoveredObjectId(null)}
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${w}px`,
                    height: `${h}px`,
                    transform: rot ? `rotate(${rot}deg)` : "none",
                    transformOrigin: "center center",
                    zIndex: obj.zIndex,
                    cursor: isEditing ? "text" : "move",
                  }}
                  className={`absolute transition-shadow ${isSelected ? "ring-0" : hoveredObjectId === obj.id ? "ring-1 ring-[#20C763]/50" : ""
                    }`}
                >
                  {/* TEXT OBJECT RENDER */}
                  {obj.type === "text" && (
                    <div
                      className="w-full h-full p-0.5 overflow-hidden flex items-start"
                      style={{
                        backgroundColor: obj.highlight || (obj.isEdited ? "rgba(255,255,255,0.92)" : "transparent"),
                      }}
                    >
                      {isEditing ? (
                        <textarea
                          ref={textInputRef}
                          value={obj.text || ""}
                          onChange={(e) => handleUpdateTextContent(obj.id, e.target.value)}
                          onBlur={() => setEditingTextId(null)}
                          className="w-full h-full bg-transparent border-0 focus:outline-none resize-none overflow-hidden p-0 leading-tight"
                          style={{
                            fontSize: `${(obj.fontSize || 14) * scale}px`,
                            fontFamily: obj.fontFamily || "Inter",
                            fontWeight: obj.bold ? "bold" : "normal",
                            fontStyle: obj.italic ? "italic" : "normal",
                            textDecoration: `${obj.underline ? "underline" : ""} ${obj.strikethrough ? "line-through" : ""}`.trim() || "none",
                            color: obj.color || "#111111",
                            textAlign: obj.align || "left",
                            lineHeight: obj.lineHeight || 1.2,
                            letterSpacing: `${(obj.letterSpacing || 0) * scale}px`,
                          }}
                          autoFocus
                        />
                      ) : (
                        <p
                          className="w-full h-full break-words whitespace-pre-wrap select-none leading-tight"
                          style={{
                            fontSize: `${(obj.fontSize || 14) * scale}px`,
                            fontFamily: obj.fontFamily || "Inter",
                            fontWeight: obj.bold ? "bold" : "normal",
                            fontStyle: obj.italic ? "italic" : "normal",
                            textDecoration: `${obj.underline ? "underline" : ""} ${obj.strikethrough ? "line-through" : ""}`.trim() || "none",
                            color: obj.color || "#111111",
                            textAlign: obj.align || "left",
                            lineHeight: obj.lineHeight || 1.2,
                            letterSpacing: `${(obj.letterSpacing || 0) * scale}px`,
                          }}
                        >
                          {obj.text}
                        </p>
                      )}
                    </div>
                  )}

                  {/* SHAPE OBJECT RENDER */}
                  {obj.type === "shape" && (
                    <div
                      className="w-full h-full"
                      style={{ opacity: obj.opacity ?? 1 }}
                    >
                      {obj.shapeType === "rectangle" && (
                        <div
                          className="w-full h-full"
                          style={{
                            border: `${(obj.strokeWidth || 2) * scale}px solid ${obj.borderColor || "#20C763"}`,
                            backgroundColor:
                              obj.fillColor === "transparent" || !obj.fillColor ? "transparent" : obj.fillColor,
                          }}
                        />
                      )}
                      {obj.shapeType === "circle" && (
                        <div
                          className="w-full h-full rounded-full"
                          style={{
                            border: `${(obj.strokeWidth || 2) * scale}px solid ${obj.borderColor || "#20C763"}`,
                            backgroundColor:
                              obj.fillColor === "transparent" || !obj.fillColor ? "transparent" : obj.fillColor,
                          }}
                        />
                      )}
                      {obj.shapeType === "line" && (
                        <div
                          className="w-full h-full flex items-center"
                        >
                          <div
                            className="w-full"
                            style={{
                              backgroundColor: obj.borderColor || "#20C763",
                              height: `${(obj.strokeWidth || 2) * scale}px`,
                            }}
                          />
                        </div>
                      )}
                      {obj.shapeType === "arrow" && (
                        <div className="w-full h-full flex items-center">
                          <div
                            className="flex-1"
                            style={{
                              backgroundColor: obj.borderColor || "#20C763",
                              height: `${(obj.strokeWidth || 2) * scale}px`,
                            }}
                          />
                          <div
                            className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[10px]"
                            style={{ borderLeftColor: obj.borderColor || "#20C763" }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* IMAGE / SIGNATURE OBJECT RENDER */}
                  {(obj.type === "image" || obj.type === "signature") && obj.dataUrl && (
                    <img
                      src={obj.dataUrl}
                      alt="Element"
                      className="w-full h-full object-contain pointer-events-none"
                      style={{ opacity: obj.opacity ?? 1 }}
                    />
                  )}

                  {/* 8 Resize Handles + Rotation Handle with Angle Badge */}
                  {renderSelectionBox(obj)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. SIGNATURE CREATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#151917] border border-[#252A27] rounded-lg p-5 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#252A27] pb-2">
              <h3 className="text-sm font-semibold text-[#F5F7F6]">Create Signature</h3>
              <button onClick={() => setIsSignatureModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher: Draw vs Type */}
            <div className="flex items-center gap-1 bg-[#111412] p-1 rounded-md border border-[#252A27]">
              <button
                onClick={() => setSigMode("draw")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer ${sigMode === "draw" ? "bg-[#20C763] text-black" : "text-zinc-400 hover:text-white"
                  }`}
              >
                Draw Signature
              </button>
              <button
                onClick={() => setSigMode("type")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer ${sigMode === "type" ? "bg-[#20C763] text-black" : "text-zinc-400 hover:text-white"
                  }`}
              >
                Type Signature
              </button>
            </div>

            {sigMode === "draw" ? (
              <div className="flex flex-col gap-2">
                <div className="bg-white rounded border border-zinc-300 relative h-36">
                  <canvas
                    ref={sigCanvasRef}
                    width={400}
                    height={140}
                    onMouseDown={(e) => {
                      const canvas = sigCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      ctx.beginPath();
                      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                      ctx.strokeStyle = sigPenColor;
                      ctx.lineWidth = 2.5;
                      ctx.lineCap = "round";
                      setIsDrawingSig(true);
                    }}
                    onMouseMove={(e) => {
                      if (!isDrawingSig) return;
                      const canvas = sigCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                      ctx.stroke();
                    }}
                    onMouseUp={() => setIsDrawingSig(false)}
                    className="w-full h-full cursor-crosshair block"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <button
                    onClick={() => {
                      const canvas = sigCanvasRef.current;
                      if (canvas) {
                        const ctx = canvas.getContext("2d");
                        ctx?.clearRect(0, 0, canvas.width, canvas.height);
                      }
                    }}
                    className="text-zinc-400 hover:text-rose-400 cursor-pointer"
                  >
                    Clear pad
                  </button>
                  <div className="flex items-center gap-1.5">
                    {["#111111", "#1E3A8A", "#20C763"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setSigPenColor(c)}
                        className={`w-5 h-5 rounded-full border cursor-pointer ${sigPenColor === c ? "ring-2 ring-white" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Type your name..."
                  value={typedSigText}
                  onChange={(e) => setTypedSigText(e.target.value)}
                  className="bg-[#111412] text-[#F5F7F6] text-sm px-3 py-2 rounded border border-[#252A27] focus:border-[#20C763] focus:outline-none"
                />
                <div className="p-4 bg-white rounded text-center text-2xl font-serif italic text-black min-h-[60px] flex items-center justify-center font-['Brush_Script_MT',cursive]">
                  {typedSigText || "Your Signature"}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252A27]">
              <button
                onClick={() => setIsSignatureModalOpen(false)}
                className="px-3 py-1.5 rounded bg-[#111412] text-zinc-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertSignature}
                className="px-4 py-1.5 rounded bg-[#20C763] text-black font-semibold text-xs hover:bg-[#28D66D] cursor-pointer"
              >
                Insert Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="application/pdf,.pdf"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleLoadPdfFile(e.target.files[0]);
            e.target.value = "";
          }
        }}
        className="hidden"
      />
    </div>
  );
};
