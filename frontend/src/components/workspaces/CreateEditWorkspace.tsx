import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  FolderOpen,
  Download,
  Plus,
  Trash2,
  Copy,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Type,
  ImagePlus,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Table as TableIcon,
  Minus,
  CheckCircle2,
  Layers,
  Stamp,
  Hash,
  ChevronDown,
  Sparkles,
  Maximize2,
  PenTool,
  Highlighter,
  Square,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import html2canvas from "html2canvas";
import { PDFFileItem } from "../../types";
import { downloadPdfBytes, fileToArrayBuffer } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { prepareDomForHtml2Canvas, sanitizeAllCssColors } from "../../lib/colorNormalizer";

export interface DocumentPage {
  id: string;
  pageNumber: number;
  contentHtml: string;
  bgImage?: string | null;
  importedFile?: File | null;
  importedPageIndex?: number;
  rotation?: number;
}

interface CreateEditWorkspaceProps {
  activeFile: PDFFileItem | null;
  onUploadClick: () => void;
  onOpenFilePicker: () => void;
  onSelectTool: (toolId: string) => void;
}

export const CreateEditWorkspace: React.FC<CreateEditWorkspaceProps> = ({
  activeFile,
  onUploadClick,
  onOpenFilePicker,
  onSelectTool,
}) => {
  // Document Title & Mode
  const [docTitle, setDocTitle] = useState("Document.pdf");
  const [isImportedPdfMode, setIsImportedPdfMode] = useState(false);
  const [activeTabMenu, setActiveTabMenu] = useState<"File" | "Edit" | "View" | "Insert" | "Format" | "Layout" | "Pages">("Format");

  // Multi-page Document State
  const [pages, setPages] = useState<DocumentPage[]>([
    {
      id: "p-1",
      pageNumber: 1,
      contentHtml: `<h1 style="font-size: 28px; font-weight: bold; margin-bottom: 12px; color: #111827;">Document Title</h1><p style="font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 16px;">Click here and start typing your document naturally...</p>`,
    },
  ]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  // Formatting Bar Controls
  const [selectedStyle, setSelectedStyle] = useState<string>("p");
  const [fontFamily, setFontFamily] = useState<string>("Arial");
  const [fontSize, setFontSize] = useState<string>("14px");
  const [textColor, setTextColor] = useState<string>("#000000");
  const [highlightColor, setHighlightColor] = useState<string>("transparent");

  // Page Header & Footer State
  const [headerText, setHeaderText] = useState<string>("");
  const [footerText, setFooterText] = useState<string>("");
  const [showPageNumbers, setShowPageNumbers] = useState<boolean>(true);

  // Document State & Progress
  const [isSaved, setIsSaved] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Hidden Inputs & Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const editorRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const currentPage = pages[activePageIndex] || pages[0];

  // Load imported PDF file if passed via props
  useEffect(() => {
    if (activeFile && activeFile.file) {
      loadImportedPdf(activeFile.file);
    }
  }, [activeFile]);

  // Execute Rich Text Command (`document.execCommand`)
  const execCmd = (command: string, value: string | undefined = undefined) => {
    soundEffects.playClick();
    document.execCommand(command, false, value);
    setIsSaved(false);
  };

  // Load Existing PDF File via pdfjs-dist
  const loadImportedPdf = async (file: File) => {
    try {
      soundEffects.playClick();
      const buffer = await fileToArrayBuffer(file);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      const importedPages: DocumentPage[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let bgDataUrl = null;
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          bgDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        }

        importedPages.push({
          id: `imp-${Date.now()}-${i}`,
          pageNumber: i,
          contentHtml: `<p style="color: #6b7280; font-size: 13px; italic;">Annotate or add content over imported page ${i}...</p>`,
          bgImage: bgDataUrl,
          importedFile: file,
          importedPageIndex: i - 1,
          rotation: 0,
        });
      }

      setDocTitle(file.name);
      setPages(importedPages);
      setActivePageIndex(0);
      setIsImportedPdfMode(true);
      soundEffects.playSuccess();
    } catch (err) {
      console.error("Failed to import PDF into editor:", err);
      alert("Failed to load PDF file into document editor.");
    }
  };

  // Add New Page
  const handleAddPage = () => {
    soundEffects.playClick();
    const newPage: DocumentPage = {
      id: `p-${Date.now()}`,
      pageNumber: pages.length + 1,
      contentHtml: `<p style="font-size: 14px; line-height: 1.6; color: #374151;">Start typing on page ${pages.length + 1}...</p>`,
    };
    const updated = [...pages, newPage];
    setPages(updated);
    setActivePageIndex(updated.length - 1);
    setIsSaved(false);
  };

  // Page Operations
  const handleMovePage = (dir: -1 | 1) => {
    if (activePageIndex + dir < 0 || activePageIndex + dir >= pages.length) return;
    soundEffects.playClick();
    const updated = [...pages];
    const temp = updated[activePageIndex];
    updated[activePageIndex] = updated[activePageIndex + dir];
    updated[activePageIndex + dir] = temp;
    updated.forEach((p, idx) => (p.pageNumber = idx + 1));
    setPages(updated);
    setActivePageIndex(activePageIndex + dir);
    setIsSaved(false);
  };

  const handleDeletePage = () => {
    if (pages.length <= 1) {
      alert("Document must contain at least one page.");
      return;
    }
    soundEffects.playClick();
    const updated = pages.filter((_, idx) => idx !== activePageIndex);
    updated.forEach((p, idx) => (p.pageNumber = idx + 1));
    setPages(updated);
    setActivePageIndex(Math.max(0, activePageIndex - 1));
    setIsSaved(false);
  };

  const handleDuplicatePage = () => {
    soundEffects.playClick();
    const pageToDup = pages[activePageIndex];
    const dupPage: DocumentPage = {
      ...JSON.parse(JSON.stringify(pageToDup)),
      id: `dup-${Date.now()}`,
    };
    const updated = [...pages];
    updated.splice(activePageIndex + 1, 0, dupPage);
    updated.forEach((p, idx) => (p.pageNumber = idx + 1));
    setPages(updated);
    setActivePageIndex(activePageIndex + 1);
    setIsSaved(false);
  };

  // Insert Image into Document Flow
  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        soundEffects.playSuccess();
        const imgHtml = `<div style="margin: 16px 0; text-align: center;"><img src="${reader.result}" style="max-width: 90%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" /></div><p><br></p>`;
        execCmd("insertHTML", imgHtml);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Insert Formatted Table
  const handleInsertTable = (rows = 3, cols = 3) => {
    soundEffects.playClick();
    let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;"><tbody>`;
    for (let r = 0; r < rows; r++) {
      tableHtml += `<tr>`;
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td style="border: 1px solid #d1d5db; padding: 8px 12px; min-width: 80px; background-color: ${r === 0 ? "#f9fafb" : "#ffffff"}; font-weight: ${r === 0 ? "bold" : "normal"};">Cell ${r + 1}-${c + 1}</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br></p>`;
    execCmd("insertHTML", tableHtml);
  };

  // Merge Additional PDF File (Appends pages to current document)
  const handleMergeAdditionalPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      soundEffects.playClick();
      const buffer = await fileToArrayBuffer(file);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      const additionalPages: DocumentPage[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let bgDataUrl = null;
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          bgDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        }

        additionalPages.push({
          id: `imp-${Date.now()}-${pages.length + i}`,
          pageNumber: pages.length + i,
          contentHtml: `<p style="color: #6b7280; font-size: 13px; italic;">Annotate or add content over imported page ${pages.length + i}...</p>`,
          bgImage: bgDataUrl,
          importedFile: file,
          importedPageIndex: i - 1,
          rotation: 0,
        });
      }

      setPages((prev) => [...prev, ...additionalPages]);
      soundEffects.playSuccess();
    } catch (err) {
      console.error("Failed to append PDF pages:", err);
      alert("Failed to append PDF pages.");
    }
    e.target.value = "";
  };

  // Export PDF Engine: Captures all A4 document pages using html2canvas & pdf-lib with color normalization
  const handleExportPdf = async () => {
    soundEffects.playClick();
    setIsExporting(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < pages.length; i++) {
        const pageData = pages[i];

        // Create a dedicated offscreen A4 container for pristine rendering
        const offscreenContainer = document.createElement("div");
        offscreenContainer.style.position = "fixed";
        offscreenContainer.style.left = "-9999px";
        offscreenContainer.style.top = "0";
        offscreenContainer.style.width = "794px";
        offscreenContainer.style.minHeight = "1123px";
        offscreenContainer.style.backgroundColor = "#ffffff";
        offscreenContainer.style.color = "#111827";
        offscreenContainer.style.padding = "48px";
        offscreenContainer.style.boxSizing = "border-box";
        offscreenContainer.style.fontFamily = fontFamily || "Arial, sans-serif";
        offscreenContainer.style.display = "flex";
        offscreenContainer.style.flexDirection = "column";
        offscreenContainer.style.justifyContent = "space-between";
        offscreenContainer.style.zIndex = "-9999";

        // 1. Optional Header
        if (headerText) {
          const headerEl = document.createElement("div");
          headerEl.style.paddingBottom = "12px";
          headerEl.style.marginBottom = "16px";
          headerEl.style.borderBottom = "1px solid #e5e7eb";
          headerEl.style.fontSize = "12px";
          headerEl.style.fontWeight = "600";
          headerEl.style.color = "#6b7280";
          headerEl.style.display = "flex";
          headerEl.style.justifyContent = "space-between";
          headerEl.innerHTML = `<span>${headerText}</span><span>${docTitle}</span>`;
          offscreenContainer.appendChild(headerEl);
        }

        // 2. Background Image if Imported PDF
        if (pageData.bgImage) {
          const bgImg = document.createElement("img");
          bgImg.src = pageData.bgImage;
          bgImg.style.position = "absolute";
          bgImg.style.inset = "0";
          bgImg.style.width = "100%";
          bgImg.style.height = "100%";
          bgImg.style.objectFit = "cover";
          bgImg.style.opacity = "0.9";
          bgImg.style.pointerEvents = "none";
          offscreenContainer.appendChild(bgImg);
        }

        // 3. Main Content HTML
        const contentEl = document.createElement("div");
        contentEl.style.flex = "1";
        contentEl.style.fontSize = "14px";
        contentEl.style.lineHeight = "1.6";
        contentEl.style.color = "#111827";
        contentEl.style.fontFamily = fontFamily || "Arial, sans-serif";
        contentEl.innerHTML = sanitizeAllCssColors(pageData.contentHtml || "");
        offscreenContainer.appendChild(contentEl);

        // 4. Optional Footer & Page Numbering
        if (footerText || showPageNumbers) {
          const footerEl = document.createElement("div");
          footerEl.style.paddingTop = "16px";
          footerEl.style.marginTop = "24px";
          footerEl.style.borderTop = "1px solid #e5e7eb";
          footerEl.style.fontSize = "12px";
          footerEl.style.color = "#6b7280";
          footerEl.style.display = "flex";
          footerEl.style.alignItems = "center";
          footerEl.style.justifyContent = "space-between";
          footerEl.innerHTML = `
            <span>${footerText || ""}</span>
            <span>${showPageNumbers ? `Page ${i + 1} of ${pages.length}` : ""}</span>
          `;
          offscreenContainer.appendChild(footerEl);
        }

        document.body.appendChild(offscreenContainer);

        // Render page container to high-res canvas (scale 2.0 = 300 DPI quality)
        const canvas = await (html2canvas as any)(offscreenContainer, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
            prepareDomForHtml2Canvas(clonedDoc, clonedEl);
          },
        });

        document.body.removeChild(offscreenContainer);

        const imgDataUrl = canvas.toDataURL("image/png", 0.95);
        const base64Data = imgDataUrl.split(",")[1];
        const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

        const embeddedImg = await pdfDoc.embedPng(imgBytes);
        const pdfPage = pdfDoc.addPage([595.28, 841.89]); // Standard A4 dimensions in points
        pdfPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: 595.28,
          height: 841.89,
        });
      }

      const compiledPdfBytes = await pdfDoc.save();
      soundEffects.playSuccess();
      downloadPdfBytes(compiledPdfBytes, docTitle || "Document.pdf");
      setIsSaved(true);
    } catch (err: any) {
      console.error("Failed to export PDF document:", err);
      alert(`Export Failed: ${err?.message || "Error rendering document pages."}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-7xl mx-auto p-2 font-sans text-white select-none">
      {/* 1. TOP HEADER BAR */}
      <div className="bg-[#121215] px-4 py-3 rounded-xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1DB954] text-black flex items-center justify-center font-bold shrink-0">
            <FileText className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={docTitle}
                onChange={(e) => {
                  setDocTitle(e.target.value);
                  setIsSaved(false);
                }}
                className="bg-transparent text-base font-extrabold text-white focus:outline-none border-b border-transparent focus:border-[#1DB954]"
              />
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  isSaved ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30" : "bg-amber-950 text-amber-400 border border-amber-500/30"
                }`}
              >
                {isSaved ? "Saved" : "Unsaved changes"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Microsoft Word-Style PDF Processor & Document Workspace</p>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddPage}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#1DB954]" />
            <span>New Page</span>
          </button>

          <button
            onClick={() => onSelectTool("word-to-pdf")}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#1DB954]" />
            <span>Word → PDF</span>
          </button>

          <button
            onClick={() => onSelectTool("pdf-to-word")}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-[#1DB954]" />
            <span>PDF → Word</span>
          </button>

          <button
            onClick={() => pdfInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <span>Import PDF</span>
          </button>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => e.target.files && e.target.files[0] && loadImportedPdf(e.target.files[0])}
            className="hidden"
          />

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2 rounded-full transition-all shadow-[0_0_15px_rgba(29,185,84,0.3)] disabled:opacity-50 cursor-pointer"
          >
            <Download className={`w-4 h-4 ${isExporting ? "animate-spin" : ""}`} />
            <span>{isExporting ? "EXPORTING PDF..." : "EXPORT PDF"}</span>
          </button>
        </div>
      </div>

      {/* 2. WORD-STYLE TOP MENU STRIP */}
      <div className="bg-[#181818] rounded-xl border border-zinc-800 flex flex-col shadow-lg overflow-hidden">
        {/* Menu Tabs: File | Edit | View | Insert | Format | Layout | Pages */}
        <div className="flex items-center gap-1 px-3 pt-2 border-b border-zinc-800/80 bg-[#141416]">
          {(["File", "Edit", "View", "Insert", "Format", "Layout", "Pages"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                soundEffects.playClick();
                setActiveTabMenu(tab);
              }}
              className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all cursor-pointer ${
                activeTabMenu === tab ? "bg-[#181818] text-[#1DB954] border-t border-x border-zinc-800" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Dynamic Contextual Toolbar Ribbon */}
        <div className="p-2.5 flex flex-wrap items-center justify-between gap-3 bg-[#181818]">
          {/* History & Font Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Undo / Redo */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => execCmd("undo")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCmd("redo")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Paragraph Format Style (Title, H1, H2, H3, Paragraph) */}
            <select
              value={selectedStyle}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStyle(val);
                execCmd("formatBlock", val);
              }}
              className="bg-zinc-900 text-xs font-bold text-white px-3 py-1.5 rounded-lg border border-zinc-700 focus:outline-none cursor-pointer"
            >
              <option value="p">Normal Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>

            {/* Font Family */}
            <select
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                execCmd("fontName", e.target.value);
              }}
              className="bg-zinc-900 text-xs font-bold text-white px-3 py-1.5 rounded-lg border border-zinc-700 focus:outline-none cursor-pointer"
            >
              <option value="Arial">Arial (Sans-serif)</option>
              <option value="Times New Roman">Times New Roman (Serif)</option>
              <option value="Courier New">Courier New (Monospace)</option>
              <option value="Georgia">Georgia</option>
              <option value="Trebuchet MS">Trebuchet MS</option>
            </select>

            {/* Font Size */}
            <select
              value={fontSize}
              onChange={(e) => {
                setFontSize(e.target.value);
                execCmd("fontSize", "3");
              }}
              className="bg-zinc-900 text-xs font-bold text-white px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:outline-none cursor-pointer"
            >
              {["12px", "14px", "16px", "18px", "24px", "32px", "48px"].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>

          {/* Formatting Buttons (Bold, Italic, Underline, Strikethrough, Colors) */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => execCmd("bold")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer font-bold"
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCmd("italic")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer italic"
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCmd("underline")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer underline"
                title="Underline (Ctrl+U)"
              >
                <Underline className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCmd("strikeThrough")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer line-through"
                title="Strikethrough"
              >
                <Strikethrough className="w-4 h-4" />
              </button>
            </div>

            {/* Text Color Picker */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              {["#000000", "#1DB954", "#ef4444", "#3b82f6", "#eab308", "#8b5cf6"].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setTextColor(c);
                    execCmd("foreColor", c);
                  }}
                  className={`w-4 h-4 rounded-full border ${textColor === c ? "border-white scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  title={`Color ${c}`}
                />
              ))}
            </div>

            {/* Alignment Group */}
            <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => execCmd("justifyLeft")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Align Left"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCmd("justifyCenter")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Align Center"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCmd("justifyRight")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Align Right"
              >
                <AlignRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCmd("justifyFull")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Justify"
              >
                <AlignJustify className="w-4 h-4" />
              </button>
            </div>

            {/* Lists Group */}
            <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => execCmd("insertUnorderedList")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Bulleted List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCmd("insertOrderedList")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
            </div>

            {/* Insert Elements Group */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 text-xs text-zinc-300 font-semibold cursor-pointer"
                title="Insert Image"
              >
                <ImagePlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Image</span>
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleInsertImage}
                className="hidden"
              />

              <button
                onClick={() => handleInsertTable(3, 3)}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 text-xs text-zinc-300 font-semibold cursor-pointer"
                title="Insert Table"
              >
                <TableIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Table</span>
              </button>

              <button
                onClick={() => execCmd("insertHorizontalRule")}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                title="Insert Line"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN EDITOR STAGE & SIDEBAR LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-[700px]">
        {/* COMPACT PAGE NAVIGATION SIDEBAR (2 cols) */}
        <div className="lg:col-span-2 bg-[#181818] p-3 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Pages ({pages.length})
            </span>
            <button
              onClick={handleAddPage}
              className="p-1 rounded bg-zinc-800 hover:bg-[#1DB954] text-white hover:text-black transition-colors cursor-pointer"
              title="Add Page"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Compact Page Number Pills */}
          <div className="flex flex-col gap-2 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar">
            {pages.map((p, idx) => {
              const isActive = activePageIndex === idx;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    soundEffects.playClick();
                    setActivePageIndex(idx);
                  }}
                  className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-xs ${
                    isActive ? "bg-[#1DB954] text-black font-extrabold border-[#1DB954]" : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800"
                  }`}
                >
                  <span className="truncate">Page {p.pageNumber}</span>

                  {isActive && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePage();
                        }}
                        className="p-0.5 rounded hover:bg-rose-950 text-rose-950 hover:text-white"
                        title="Delete Page"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-zinc-800 flex flex-col gap-1.5">
            <button
              onClick={() => handleMovePage(-1)}
              disabled={activePageIndex === 0}
              className="flex items-center justify-center gap-1 p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-semibold disabled:opacity-30 cursor-pointer"
            >
              <ArrowUp className="w-3 h-3" />
              <span>Move Up</span>
            </button>
            <button
              onClick={() => handleMovePage(1)}
              disabled={activePageIndex === pages.length - 1}
              className="flex items-center justify-center gap-1 p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-semibold disabled:opacity-30 cursor-pointer"
            >
              <ArrowDown className="w-3 h-3" />
              <span>Move Down</span>
            </button>
            <button
              onClick={handleDuplicatePage}
              className="flex items-center justify-center gap-1 p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-semibold cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>Duplicate</span>
            </button>
          </div>
        </div>

        {/* WORD-STYLE DOCUMENT CANVAS SURFACE (8 cols) */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center py-4 bg-[#09090b] rounded-2xl border border-zinc-900/80 shadow-2xl min-h-[750px] relative overflow-y-auto">
          {/* Centered A4 / Letter Document Page */}
          <div
            key={`page-container-${currentPage.id}`}
            ref={(el) => {
              editorRefs.current[`page-${activePageIndex}`] = el;
            }}
            className="w-[650px] min-h-[842px] bg-white text-zinc-900 p-12 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded border border-zinc-300 flex flex-col justify-between relative transition-all"
          >
            {/* Optional Header */}
            {headerText && (
              <div className="pb-3 mb-4 border-b border-zinc-200 text-xs font-semibold text-zinc-400 flex justify-between">
                <span>{headerText}</span>
                <span>{docTitle}</span>
              </div>
            )}

            {/* Background Image if Imported PDF */}
            {currentPage.bgImage && (
              <img
                src={currentPage.bgImage}
                alt="Imported Page"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-90"
              />
            )}

            {/* Continuous Rich Text Editable Surface */}
            <div
              key={`editable-${currentPage.id}`}
              contentEditable
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: currentPage.contentHtml }}
              onInput={(e) => {
                const target = e.currentTarget;
                const updated = [...pages];
                updated[activePageIndex].contentHtml = target.innerHTML;
                setPages(updated);
                setIsSaved(false);
              }}
              className="flex-1 text-sm font-sans text-zinc-900 focus:outline-none leading-relaxed custom-scrollbar prose max-w-none"
              style={{
                fontFamily,
                minHeight: "700px",
              }}
            />

            {/* Document Footer & Page Numbering */}
            <div className="pt-4 mt-6 border-t border-zinc-200 text-xs text-zinc-400 flex items-center justify-between">
              <span>{footerText || "Easy PDF Document"}</span>
              {showPageNumbers && (
                <span className="font-semibold text-zinc-600">
                  Page {currentPage.pageNumber} of {pages.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CONTEXTUAL PROPERTIES & TOOLS SIDEBAR (2 cols) */}
        <div className="lg:col-span-2 bg-[#181818] p-3 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl text-xs">
          <span className="font-bold text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-2">
            Document Settings
          </span>

          {/* Header / Footer Setup */}
          <div className="flex flex-col gap-2 bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
            <span className="font-bold text-[#1DB954]">Header & Footer</span>
            <input
              type="text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Document Header..."
              className="bg-zinc-950 text-white p-1.5 rounded border border-zinc-800 text-[11px]"
            />
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Document Footer..."
              className="bg-zinc-950 text-white p-1.5 rounded border border-zinc-800 text-[11px]"
            />

            <label className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={showPageNumbers}
                onChange={(e) => setShowPageNumbers(e.target.checked)}
                className="accent-[#1DB954]"
              />
              <span>Show Page Numbers</span>
            </label>
          </div>

          {/* Integrated Engine Tools */}
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
            <span className="font-bold text-zinc-400 mb-1">PDF Engine Tools:</span>

            <button
              onClick={() => mergeInputRef.current?.click()}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#1DB954]" />
                <span className="text-[11px]">Merge Additional PDF</span>
              </div>
            </button>
            <input
              ref={mergeInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleMergeAdditionalPdf}
              className="hidden"
            />

            <button
              onClick={() => onSelectTool("watermark")}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Stamp className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px]">Watermark PDF</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTool("page-numbers")}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px]">Page Numbers</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
