import { PDFTool } from "../types";

export const PDF_TOOLS: PDFTool[] = [
  // Popular
  {
    id: "merge",
    title: "Merge PDF",
    description: "Combine multiple PDF files into a single unified document in your preferred order.",
    category: "popular",
    iconName: "Layers",
    badge: "POPULAR",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "split",
    title: "Split PDF",
    description: "Separate pages or extract custom page ranges into individual PDF documents.",
    category: "popular",
    iconName: "Scissors",
    badge: "FAST",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "organize",
    title: "Organize & Rotate",
    description: "Visual page editor. Reorder, rotate pages 90°, delete unwanted pages, or duplicate.",
    category: "popular",
    iconName: "Grid",
    badge: "POPULAR",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "watermark",
    title: "Add Watermark",
    description: "Apply text or logo watermarks with precise opacity, positioning, and rotation control.",
    category: "edit",
    iconName: "Stamp",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "remove-watermark",
    title: "Remove Watermark",
    description: "Mark and remove unwanted marks, stamps, or watermarks from your authorized documents or images.",
    category: "edit",
    iconName: "Eraser",
    badge: "NEW",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },

  // Read & Smart Document Tools
  {
    id: "ai-summary",
    title: "Executive Summary",
    description: "Generate structured document briefs, key takeaways, action items, and reading estimates.",
    category: "read",
    iconName: "FileText",
    badge: "POPULAR",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "ai-chat",
    title: "Document Search & Q&A",
    description: "Query document contents directly to retrieve clauses, figures, dates, and answers.",
    category: "read",
    iconName: "Search",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "ai-ocr",
    title: "OCR Text Formatter",
    description: "Digitize scanned pages and raw text into clean, structured Markdown text.",
    category: "read",
    iconName: "ScanText",
    badge: "NEW",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "ai-translate",
    title: "Document Translator",
    description: "Translate document text into over 25 languages while preserving paragraph structure.",
    category: "read",
    iconName: "Languages",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "ai-extract",
    title: "Extract Key Data",
    description: "Extract structured tables, invoice totals, key dates, and signees into structured tables.",
    category: "read",
    iconName: "TableProperties",
    badge: "NEW",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },

  // Edit & Markup
  {
    id: "page-numbers",
    title: "Add Page Numbers",
    description: "Insert clean, customizable page numbers with positioning, font, and layout options.",
    category: "edit",
    iconName: "Hash",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "annotate",
    title: "Edit & Sign PDF",
    description: "Add digital signatures, text overlays, rubber stamps, and custom highlights.",
    category: "edit",
    iconName: "PenTool",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },

  // Convert
  {
    id: "pdf-to-img",
    title: "PDF to Images",
    description: "Export every page of your PDF into high-resolution PNG image files.",
    category: "convert",
    iconName: "FileImage",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "img-to-pdf",
    title: "Images to PDF",
    description: "Convert photos, image scans, and PNGs into a consolidated PDF document.",
    category: "convert",
    iconName: "ImagePlus",
    badge: "FAST",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },

  // Security
  {
    id: "lock",
    title: "Protect PDF",
    description: "Encrypt and restrict document access with strong digital password protection.",
    category: "security",
    iconName: "Lock",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
  {
    id: "compress",
    title: "Compress PDF",
    description: "Reduce file size efficiently while maintaining document readability.",
    category: "security",
    iconName: "FileArchive",
    accentBg: "bg-zinc-800/80 border-zinc-700/50",
  },
];
