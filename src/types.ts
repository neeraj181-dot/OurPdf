export type ToolCategory = "all" | "popular" | "read" | "edit" | "convert" | "security";

export interface PDFTool {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  iconName: string;
  badge?: "POPULAR" | "NEW" | "FAST";
  accentBg?: string; // Subtle neutral/muted backdrop for icon box
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

export type PlanType = "free" | "pro";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: PlanType;
  aiCredits: number;
  maxAiCredits: number;
  joinDate: string;
}

export type AuthMode = "login" | "signup" | "forgot";

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: UserProfile;
}

