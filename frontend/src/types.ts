export type ToolCategory = "all" | "create" | "edit" | "pages" | "enhance" | "convert" | "security";

export interface PDFTool {
  id: string;
  title: string;
  description: string;
  category: "edit" | "merge-split" | "security" | "convert" | "pages" | "create" | "optimize";
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
