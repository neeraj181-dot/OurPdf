export type ToolCategory = "all" | "create" | "edit" | "pages" | "enhance" | "convert" | "security";

export interface PDFTool {
  id: string;
  title: string;
  description: string;
  category: "edit" | "merge-split" | "security" | "convert" | "pages" | "create" | "optimize" | "enhance";
  iconName: string;
  badge?: "POPULAR" | "NEW" | "FAST" | "READY";
  accentBg: string;
}

export interface PDFFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pagesCount: number;
  previewUrl?: string;
  pageThumbnails: string[];
  extractedText?: string;
  pageTexts?: string[];
  backendDocId?: number;
}

export interface PageOrderInfo {
  id: string;
  originalIndex: number; // 0-based
  rotation: number; // 0, 90, 180, 270
  thumbnailUrl: string;
}

export interface WatermarkOptions {
  text: string;
  color: string; // hex
  opacity: number; // 0.1 - 1
  fontSize: number;
  rotation: number; // degrees e.g. -45
  position: "center" | "top" | "bottom" | "tile";
}

export interface RemoveWatermarkOptions {
  mode: "brush" | "rectangle";
  brushRadius: number;
  maskDataUrl?: string;
}

export interface PageNumberOptions {
  format: "Page {n}" | "{n} of {total}" | "- {n} -";
  position: "bottom-center" | "bottom-right" | "top-right" | "bottom-left";
  fontSize: number;
  color: string;
}

export interface AISummaryResult {
  title?: string;
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
  documentCategory?: string;
  readingTimeMinutes?: number;
  keyTopics?: string[];
}

export interface ExtractedField {
  label: string;
  value: string;
  category: "date" | "financial" | "contact" | "legal" | "other";
  confidence: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface BitNoteItem {
  id: string;
  title: string;
  sourceType: "image" | "pdf_page";
  file?: File;
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  rotation: number; // 0, 90, 180, 270 degrees
  pageIndex?: number;
  originalFileName: string;
}

export type PaperSize = "A4" | "A3" | "Letter" | "Custom";
export type Orientation = "portrait" | "landscape";
export type CutLineStyle = "none" | "light" | "dashed" | "crop-marks";
export type NoteBorderStyle = "none" | "thin" | "medium";
export type PresetLayout = "12-per-page" | "8-per-page" | "6-per-page" | "4-per-page" | "custom";

export interface BitNotesLayoutOptions {
  paperSize: PaperSize;
  customWidthMm?: number;
  customHeightMm?: number;
  orientation: Orientation;
  preset: PresetLayout;
  columns: number;
  rows: number;
  outerMarginMm: number; // e.g. 5, 10, 15, 20
  gapMm: number; // e.g. 0, 2, 4, 5, 10
  autoFit: boolean; // Maintain aspect ratio without distorting
  autoRotate: boolean; // Auto-rotate notes to best fit cell orientation
  cutLines: CutLineStyle; // dashed, light, crop-marks, none
  borders: NoteBorderStyle; // thin, medium, none
  smartPacking?: boolean;
}

