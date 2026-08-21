import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Code,
  FileCode,
  Upload,
  Download,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Eye,
  RotateCcw,
  Sparkles,
  Layers,
  Settings,
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet,
  FileCheck,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sliders,
  Copy,
  Check,
  Cloud,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { apiConvertHtmlToPdf, apiRecordDownload, UserProfile } from "../../lib/api";
import { downloadPdfBytes } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface HtmlWorkspaceProps {
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker?: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onDownloadRecorded?: () => void;
}

const TEMPLATES: { id: string; name: string; icon: string; html: string }[] = [
  {
    id: "invoice",
    name: "Invoice / Bill",
    icon: "FileSpreadsheet",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #INV-2026-001</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; }
    .header { display: table; width: 100%; border-bottom: 2px solid #1DB954; padding-bottom: 15px; margin-bottom: 25px; }
    .header-left { display: table-cell; vertical-align: top; }
    .header-right { display: table-cell; text-align: right; vertical-align: top; }
    .logo { font-size: 24px; font-weight: bold; color: #111827; }
    .logo span { color: #1DB954; }
    .badge { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
    .info-grid { display: table; width: 100%; margin-bottom: 25px; }
    .info-col { display: table-cell; width: 50%; vertical-align: top; }
    h4 { margin: 0 0 6px 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    p { margin: 0 0 4px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
    th { background: #f3f4f6; color: #374151; font-size: 12px; font-weight: bold; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
    .text-right { text-align: right; }
    .total-box { display: table; width: 100%; margin-top: 10px; }
    .total-right { display: table-cell; text-align: right; }
    .grand-total { font-size: 18px; font-weight: bold; color: #111827; margin-top: 8px; }
    .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="logo">Our<span>PDF</span> Services</div>
      <p style="color: #6b7280; font-size: 12px;">Enterprise Cloud Solutions</p>
    </div>
    <div class="header-right">
      <span class="badge">PAID IN FULL</span>
      <h2 style="margin: 8px 0 0 0; color: #111827;">INVOICE #INV-2026-001</h2>
      <p style="color: #6b7280; font-size: 12px;">Date: August 18, 2026</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-col">
      <h4>Billed To:</h4>
      <p><strong>Acme Global Technologies Inc.</strong></p>
      <p>100 Innovation Boulevard, Suite 400</p>
      <p>San Francisco, CA 94107</p>
    </div>
    <div class="info-col" style="text-align: right;">
      <h4>Payable To:</h4>
      <p><strong>OurPDF Digital Platform</strong></p>
      <p>support@ourpdf.app</p>
      <p>Tax ID: US-987654321</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">Qty / Hrs</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>High-Performance PDF Engine Pro</strong><br><span style="color:#6b7280; font-size:11px;">Annual enterprise document processing license</span></td>
        <td class="text-right">1</td>
        <td class="text-right">$240.00</td>
        <td class="text-right">$240.00</td>
      </tr>
      <tr>
        <td><strong>OCR & AI Document Intelligence API</strong><br><span style="color:#6b7280; font-size:11px;">10,000 document processing credits</span></td>
        <td class="text-right">2</td>
        <td class="text-right">$50.00</td>
        <td class="text-right">$100.00</td>
      </tr>
      <tr>
        <td><strong>Priority Cloud Support & SLA</strong><br><span style="color:#6b7280; font-size:11px;">24/7 dedicated engineering response</span></td>
        <td class="text-right">1</td>
        <td class="text-right">$60.00</td>
        <td class="text-right">$60.00</td>
      </tr>
    </tbody>
  </table>

  <div class="total-box">
    <div class="total-right">
      <p style="color:#6b7280;">Subtotal: <strong>$400.00</strong></p>
      <p style="color:#6b7280;">Tax (0%): <strong>$0.00</strong></p>
      <div class="grand-total">Total: $400.00 USD</div>
    </div>
  </div>

  <div class="footer">
    Thank you for choosing OurPDF. Questions? Email billing@ourpdf.app.
  </div>
</body>
</html>`,
  },
  {
    id: "report",
    name: "Executive Report",
    icon: "FileText",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quarterly Performance Report</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 25px; }
    h1 { color: #0f172a; border-bottom: 3px solid #1DB954; padding-bottom: 8px; font-size: 22px; }
    h2 { color: #1e293b; font-size: 16px; margin-top: 20px; border-left: 4px solid #1DB954; padding-left: 10px; }
    .lead { font-size: 14px; color: #475569; font-weight: 500; }
    .metric-grid { display: table; width: 100%; margin: 20px 0; }
    .metric-card { display: table-cell; width: 33%; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; text-align: center; border-radius: 8px; }
    .metric-val { font-size: 22px; font-weight: bold; color: #1DB954; margin: 4px 0; }
    .metric-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 12px; }
    th { background: #f1f5f9; font-weight: 600; text-align: left; }
    blockquote { background: #f0fdf4; border-left: 4px solid #1DB954; padding: 10px 15px; margin: 15px 0; font-style: italic; color: #166534; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Q3 Executive Document Intelligence Summary</h1>
  <p class="lead">Overview of automated workflows, client-side PDF conversions, and system reliability.</p>
  
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-label">Documents Converted</div>
      <div class="metric-val">1,482,900</div>
      <div style="font-size: 10px; color: #16a34a;">+24% vs Q2</div>
    </div>
    <div class="metric-card" style="margin-left: 10px;">
      <div class="metric-label">Avg Conversion Speed</div>
      <div class="metric-val">0.38s</div>
      <div style="font-size: 10px; color: #16a34a;">99.98% SLA</div>
    </div>
    <div class="metric-card" style="margin-left: 10px;">
      <div class="metric-label">Customer Satisfaction</div>
      <div class="metric-val">99.4%</div>
      <div style="font-size: 10px; color: #16a34a;">5-star rating</div>
    </div>
  </div>

  <h2>Key Highlights</h2>
  <p>OurPDF introduced client-side document processing, zero-data-retention architecture, and instantaneous HTML-to-PDF generation.</p>

  <blockquote>
    "The new conversion pipeline delivers pixel-perfect rendering with strict enterprise SSRF isolation and blazing throughput."
  </blockquote>

  <h2>Conversion Operations Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Module</th>
        <th>Input Format</th>
        <th>Output Target</th>
        <th>Success Rate</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>HTML Engine</td>
        <td>HTML / CSS / Web</td>
        <td>Standard A4 / Letter PDF</td>
        <td>99.9%</td>
      </tr>
      <tr>
        <td>Word Converter</td>
        <td>.docx / .doc</td>
        <td>Print-ready PDF</td>
        <td>99.7%</td>
      </tr>
      <tr>
        <td>Image Pipeline</td>
        <td>PNG / JPG / WebP</td>
        <td>Consolidated PDF</td>
        <td>100.0%</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`,
  },
  {
    id: "resume",
    name: "Modern Resume",
    icon: "FileCheck",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Resume - Alex Morgan</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #334155; margin: 0; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
    .name { font-size: 26px; font-weight: bold; color: #0f172a; letter-spacing: -0.5px; }
    .title { font-size: 14px; color: #1DB954; font-weight: 600; margin-top: 4px; }
    .contact { font-size: 12px; color: #64748b; margin-top: 6px; }
    h2 { font-size: 14px; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #1DB954; padding-bottom: 4px; margin-top: 18px; margin-bottom: 10px; letter-spacing: 0.5px; }
    .job { margin-bottom: 14px; }
    .job-header { display: table; width: 100%; margin-bottom: 3px; }
    .job-title { display: table-cell; font-weight: bold; font-size: 13px; color: #1e293b; }
    .job-date { display: table-cell; text-align: right; font-size: 12px; color: #64748b; }
    .company { font-size: 12px; color: #1DB954; font-weight: 500; margin-bottom: 4px; }
    ul { margin: 4px 0 0 0; padding-left: 18px; font-size: 12px; }
    li { margin-bottom: 3px; }
    .skills { font-size: 12px; line-height: 1.7; }
    .badge { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-right: 4px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">Alex Morgan</div>
    <div class="title">Senior Full Stack & Systems Engineer</div>
    <div class="contact">alex.morgan@email.com • (555) 234-5678 • San Francisco, CA • github.com/alexmorgan</div>
  </div>

  <h2>Professional Summary</h2>
  <p style="font-size: 12px; margin: 0;">
    Accomplished software engineer with 7+ years of experience architecting high-scale web platforms, document processing engines, and cloud distributed microservices.
  </p>

  <h2>Work Experience</h2>
  <div class="job">
    <div class="job-header">
      <span class="job-title">Staff Software Architect</span>
      <span class="job-date">2023 - Present</span>
    </div>
    <div class="company">CloudScale Systems • San Francisco, CA</div>
    <ul>
      <li>Architected real-time HTML-to-PDF distributed microservice handling 5M+ daily requests with sub-second latency.</li>
      <li>Engineered sandbox security isolation and memory recycling pipelines with 99.99% uptime.</li>
    </ul>
  </div>

  <div class="job">
    <div class="job-header">
      <span class="job-title">Senior Full Stack Engineer</span>
      <span class="job-date">2020 - 2023</span>
    </div>
    <div class="company">HyperDocs Inc. • Seattle, WA</div>
    <ul>
      <li>Built responsive client-side React / TypeScript editor workflows with instant preview and PDF compilation.</li>
      <li>Optimized rendering pipelines, reducing memory overhead by 42%.</li>
    </ul>
  </div>

  <h2>Technical Skills</h2>
  <div class="skills">
    <span class="badge">TypeScript / React</span>
    <span class="badge">Python / FastAPI</span>
    <span class="badge">HTML5 / CSS3</span>
    <span class="badge">PyMuPDF / xhtml2pdf</span>
    <span class="badge">PostgreSQL</span>
    <span class="badge">Docker / K8s</span>
    <span class="badge">TailwindCSS</span>
  </div>
</body>
</html>`,
  },
  {
    id: "basic",
    name: "Minimalist Document",
    icon: "Code",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Minimal Document</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; padding: 20px; line-height: 1.5; }
    h1 { color: #111827; border-bottom: 2px solid #1DB954; padding-bottom: 6px; }
    p { margin-bottom: 12px; }
    .card { background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 15px 0; }
  </style>
</head>
<body>
  <h1>Hello from OurPDF!</h1>
  <p>This HTML document is rendered directly into a PDF.</p>
  <div class="card">
    <h3>Key Features</h3>
    <ul>
      <li>Live sandboxed preview</li>
      <li>Customizable page size (A4, Letter, Legal)</li>
      <li>Portrait & Landscape orientation</li>
      <li>Zero server data retention</li>
    </ul>
  </div>
</body>
</html>`,
  },
];

export const HtmlWorkspace: React.FC<HtmlWorkspaceProps> = ({
  activeFile,
  user,
  onOpenFilePicker,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  // Input mode: "upload" or "code"
  const [inputMode, setInputMode] = useState<"upload" | "code">("upload");

  // Uploaded HTML file state
  const [uploadedHtmlFile, setUploadedHtmlFile] = useState<File | null>(null);
  const [uploadedFileText, setUploadedFileText] = useState<string>("");

  // Code editor state
  const [htmlCode, setHtmlCode] = useState<string>(TEMPLATES[0].html);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("invoice");

  // PDF Settings
  const [pageSize, setPageSize] = useState<"A4" | "Letter" | "Legal">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margin, setMargin] = useState<"default" | "small" | "none">("default");
  const [printBackground, setPrintBackground] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Conversion & Output State
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<string>("");
  const [convertedPdfBytes, setConvertedPdfBytes] = useState<Uint8Array | null>(null);
  const [convertedPdfName, setConvertedPdfName] = useState<string>("");
  const [pdfPageThumbnails, setPdfPageThumbnails] = useState<string[]>([]);
  const [showThumbnailGallery, setShowThumbnailGallery] = useState(true);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [isSavedToCloudState, setIsSavedToCloudState] = useState(false);

  // Live preview scale state
  const [previewScale, setPreviewScale] = useState<number>(100);
  const [copiedCode, setCopiedCode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Active HTML string for preview and conversion
  const currentHtmlContent = useMemo(() => {
    if (inputMode === "upload") {
      return uploadedFileText || "";
    }
    return htmlCode || "";
  }, [inputMode, uploadedFileText, htmlCode]);

  // Handle HTML File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    e.target.value = "";

    soundEffects.playClick();
    setUploadedHtmlFile(file);
    setConversionError(null);
    setConvertedPdfBytes(null);
    setPdfPageThumbnails([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadedFileText(content || "");
    };
    reader.onerror = () => {
      setConversionError("Failed to read HTML file content.");
    };
    reader.readAsText(file);
  };

  // Drag & drop handlers for HTML file upload zone
  const handleDropHtml = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (/\.(html|htm|xhtml)$/i.test(file.name) || file.type.includes("html")) {
        soundEffects.playClick();
        setUploadedHtmlFile(file);
        setConversionError(null);
        setConvertedPdfBytes(null);
        setPdfPageThumbnails([]);

        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedFileText((event.target?.result as string) || "");
        };
        reader.readAsText(file);
      } else {
        alert("Please drop a valid .html or .htm file.");
      }
    }
  };

  // Select Template
  const handleSelectTemplate = (tpl: typeof TEMPLATES[0]) => {
    soundEffects.playClick();
    setActiveTemplateId(tpl.id);
    setHtmlCode(tpl.html);
    setConversionError(null);
  };

  // Copy HTML code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(htmlCode);
    setCopiedCode(true);
    soundEffects.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Perform HTML → PDF Conversion
  const handleRunConversion = async () => {
    const htmlToConvert = currentHtmlContent;
    if (!htmlToConvert || !htmlToConvert.trim()) {
      setConversionError("No HTML content to convert. Please select a file or paste HTML code.");
      return;
    }

    soundEffects.playClick();
    setIsConverting(true);
    setConversionError(null);
    setConvertedPdfBytes(null);
    setPdfPageThumbnails([]);
    setConversionProgress("Preparing HTML document & sanitizing tags...");

    try {
      setConversionProgress("Rendering layout & compiling PDF on server...");

      const outFilename =
        inputMode === "upload" && uploadedHtmlFile
          ? uploadedHtmlFile.name.replace(/\.[^/.]+$/, "") + ".pdf"
          : "html_converted_document.pdf";

      const pdfBytes = await apiConvertHtmlToPdf({
        file: inputMode === "upload" ? uploadedHtmlFile : undefined,
        html: inputMode === "code" ? htmlCode : undefined,
        filename: outFilename,
        pageSize,
        orientation,
        margin,
        printBackground,
      });

      setConvertedPdfBytes(pdfBytes);
      setConvertedPdfName(outFilename);
      setConversionProgress("Rendering page preview thumbnails...");
      soundEffects.playSuccess();

      // Generate thumbnails using pdfjs-dist
      try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
        const pdfDoc = await loadingTask.promise;
        const thumbs: string[] = [];
        const maxPages = Math.min(pdfDoc.numPages, 12);

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.8 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport } as any).promise;
            thumbs.push(canvas.toDataURL("image/jpeg", 0.88));
          }
        }
        setPdfPageThumbnails(thumbs);
      } catch (thumbErr) {
        console.warn("Could not generate PDF thumbnails:", thumbErr);
      }
    } catch (err: any) {
      console.error("HTML to PDF conversion error:", err);
      setConversionError(
        err?.message || "Failed to convert HTML to PDF. Please check your HTML syntax and try again."
      );
    } finally {
      setIsConverting(false);
      setConversionProgress("");
    }
  };

  // Download Generated PDF
  const handleDownloadPdf = () => {
    if (!convertedPdfBytes) return;
    soundEffects.playClick();
    downloadPdfBytes(convertedPdfBytes, convertedPdfName || "html_document.pdf");

    // Track download in backend PostgreSQL / local storage
    if (user) {
      apiRecordDownload(convertedPdfBytes, convertedPdfName || "html_document.pdf", "HTML to PDF")
        .then(() => onDownloadRecorded?.())
        .catch((e) => console.warn("Download record sync:", e));
    } else {
      recordDownloadedDoc(
        convertedPdfName || "html_document.pdf",
        convertedPdfBytes.byteLength,
        pdfPageThumbnails.length || 1,
        "HTML to PDF",
        convertedPdfBytes
      );
      onDownloadRecorded?.();
    }
  };

  // Reset conversion
  const handleReset = () => {
    soundEffects.playClick();
    setConvertedPdfBytes(null);
    setPdfPageThumbnails([]);
    setConversionError(null);
    setIsSavedToCloudState(false);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-2 sm:p-4 font-sans text-white">
      {/* 1. HEADER HERO */}
      <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800/90 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl relative overflow-hidden">
        <div className="z-10">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <Code className="w-4 h-4 stroke-[2.5]" />
            <span>HTML → PDF CONVERTER</span>
            <span className="bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40 px-2 py-0.5 rounded text-[10px] font-bold ml-1">
              PRODUCTION READY
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 mt-1 tracking-tight">
            Render HTML Code or Web Documents into PDF
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            Upload an HTML document or write custom markup with CSS styles, tables, fonts, and images. Safely preview in sandbox before generating downloadable PDFs.
          </p>
        </div>

        {/* Action Toggle / Status */}
        <div className="flex items-center gap-2 z-10 shrink-0">
          <button
            onClick={() => {
              soundEffects.playClick();
              setInputMode("upload");
              setConversionError(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              inputMode === "upload"
                ? "bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20 font-extrabold"
                : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/60"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload HTML</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setInputMode("code");
              setConversionError(null);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              inputMode === "code"
                ? "bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20 font-extrabold"
                : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/60"
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Paste / Edit HTML</span>
          </button>
        </div>
      </div>

      {/* 2. SUCCESS RESULT STATE */}
      {convertedPdfBytes && (
        <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-6 shadow-2xl animate-in fade-in">
          {/* Notification Banner */}
          <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-900/80 border border-emerald-500/50 flex items-center justify-center text-[#1DB954] shrink-0">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">PDF Ready for Download</h4>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Your HTML document was successfully compiled into a pixel-perfect standard PDF.
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white font-semibold underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Convert Another</span>
            </button>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900/90 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Source Document</span>
              <span className="font-bold text-white text-xs truncate">
                {inputMode === "upload" && uploadedHtmlFile ? uploadedHtmlFile.name : "Custom HTML Code"}
              </span>
              <span className="text-zinc-400 text-[11px]">
                {inputMode === "upload" && uploadedHtmlFile
                  ? formatBytes(uploadedHtmlFile.size)
                  : `${htmlCode.length.toLocaleString()} characters`}
              </span>
            </div>

            <div className="bg-zinc-900/90 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#1DB954] uppercase tracking-wider">Generated PDF</span>
              <span className="font-bold text-white text-xs truncate">{convertedPdfName}</span>
              <span className="text-zinc-400 text-[11px]">
                {pdfPageThumbnails.length} Pages • {formatBytes(convertedPdfBytes.byteLength)}
              </span>
            </div>

            <div className="bg-zinc-900/90 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">PDF Specifications</span>
              <span className="font-bold text-white text-xs">
                {pageSize} • {orientation.toUpperCase()} • Margins: {margin}
              </span>
              <span className="text-zinc-400 text-[11px]">Backgrounds: {printBackground ? "Included" : "Disabled"}</span>
            </div>
          </div>

          {/* Main Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setShowThumbnailGallery((prev) => !prev)}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer border border-zinc-700"
            >
              <Eye className="w-4 h-4 text-[#1DB954]" />
              <span>{showThumbnailGallery ? "Hide Page Previews" : "Show Page Previews"}</span>
            </button>

            {onSaveToCloud && (
              <button
                onClick={() => {
                  if (!convertedPdfBytes) return;
                  onSaveToCloud(convertedPdfBytes, convertedPdfName || "html_document.pdf", "html-to-pdf");
                  setIsSavedToCloudState(true);
                }}
                disabled={isSavedToCloudState}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                  isSavedToCloudState
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 cursor-default"
                    : "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                }`}
              >
                <Cloud className="w-4 h-4 text-[#1DB954]" />
                <span>{isSavedToCloudState ? "Saved to My Documents" : "Save to Cloud"}</span>
              </button>
            )}

            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-[#1DB954]/25"
            >
              <Download className="w-4 h-4 stroke-[3]" />
              <span>Download PDF</span>
            </button>
          </div>

          {/* Multi-page visual preview thumbnails */}
          {showThumbnailGallery && pdfPageThumbnails.length > 0 && (
            <div className="pt-4 border-t border-zinc-800 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                  <Layers className="w-4 h-4 text-[#1DB954]" />
                  <span>Compiled Document Pages ({pdfPageThumbnails.length}):</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {pdfPageThumbnails.map((thumb, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 flex flex-col gap-2 shadow-md hover:border-zinc-700 transition-colors"
                  >
                    <div className="aspect-[3/4] bg-white rounded overflow-hidden flex items-center justify-center p-1 shadow-inner">
                      <img src={thumb} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[10px] text-zinc-400 text-center font-mono font-bold">
                      Page {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. MAIN WORKSPACE (WHEN NOT IN RESULT STATE) */}
      {!convertedPdfBytes && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: INPUT & SETTINGS (7 COLS ON DESKTOP) */}
          <div className="lg:col-span-6 xl:col-span-6 flex flex-col gap-5">
            {/* INPUT PANEL: TAB 1 UPLOAD */}
            {inputMode === "upload" && (
              <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-5 shadow-xl">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#1DB954]" />
                    <span>Upload HTML File</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Drag and drop your .html or .htm file, or browse files from your computer.
                  </p>
                </div>

                {!uploadedHtmlFile ? (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDropHtml}
                    onClick={() => fileInputRef.current?.click()}
                    className="py-12 px-4 bg-zinc-900/60 hover:bg-zinc-900 border-2 border-dashed border-zinc-700/80 hover:border-[#1DB954] rounded-2xl flex flex-col items-center justify-center gap-3 text-center transition-all cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-[#1DB954] group-hover:scale-110 transition-transform">
                      <FolderOpen className="w-7 h-7 stroke-[2]" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-zinc-100 group-hover:text-[#1DB954] transition-colors block">
                        Select HTML File
                      </span>
                      <span className="text-xs text-zinc-400 mt-1 block">
                        Accepts .html, .htm, .xhtml documents (up to 25MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-1 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-colors shadow-md"
                    >
                      Browse Files
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html, .htm, .xhtml, text/html"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 text-[#1DB954] flex items-center justify-center shrink-0 border border-zinc-700">
                        <FileCode className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{uploadedHtmlFile.name}</span>
                        <span className="text-[11px] text-zinc-400 font-medium">
                          {formatBytes(uploadedHtmlFile.size)} • HTML Document
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-700 cursor-pointer"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => {
                          setUploadedHtmlFile(null);
                          setUploadedFileText("");
                        }}
                        className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1.5 cursor-pointer font-medium"
                      >
                        Remove
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".html, .htm, .xhtml, text/html"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INPUT PANEL: TAB 2 CODE EDITOR */}
            {inputMode === "code" && (
              <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
                {/* Template Selector Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Starter Templates
                    </span>
                    <span className="text-[11px] text-zinc-400">Click to load preset markup</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          activeTemplateId === tpl.id
                            ? "bg-emerald-950/40 border-[#1DB954] text-white"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        }`}
                      >
                        <span className="text-xs font-bold truncate">{tpl.name}</span>
                        <span className="text-[10px] text-zinc-400">Preset code</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editor Header Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
                  <div className="flex items-center gap-2 text-zinc-300 font-bold">
                    <Code className="w-4 h-4 text-[#1DB954]" />
                    <span>HTML & CSS Code Editor</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2.5 py-1 rounded text-[11px] font-medium border border-zinc-700 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-[#1DB954]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? "Copied" : "Copy"}</span>
                    </button>

                    <button
                      onClick={() => setHtmlCode(TEMPLATES[0].html)}
                      className="text-zinc-400 hover:text-white text-[11px] underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Textarea Code Editor */}
                <div className="relative rounded-xl overflow-hidden border border-zinc-800 focus-within:border-[#1DB954] transition-colors">
                  <textarea
                    value={htmlCode}
                    onChange={(e) => {
                      setHtmlCode(e.target.value);
                      setActiveTemplateId("");
                    }}
                    placeholder="<!DOCTYPE html><html><head><style>...</style></head><body><h1>Hello World</h1></body></html>"
                    rows={12}
                    className="w-full bg-[#0d0d10] text-emerald-400 font-mono text-xs p-4 leading-relaxed focus:outline-none resize-y selection:bg-[#1DB954]/30 custom-scrollbar"
                    spellCheck={false}
                  />
                  <div className="bg-[#121215] px-4 py-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>HTML5 + CSS3 Supported</span>
                    <span>{htmlCode.length.toLocaleString()} characters</span>
                  </div>
                </div>
              </div>
            )}

            {/* PDF SETTINGS ACCORDION */}
            <div className="bg-[#18181b] rounded-2xl border border-zinc-800 shadow-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[#1DB954]">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-100 block">PDF Layout & Format Settings</span>
                    <span className="text-[11px] text-zinc-400">
                      {pageSize} • {orientation} • {margin} margin • {printBackground ? "Backgrounds On" : "No Backgrounds"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold">
                  <span>{isSettingsOpen ? "Hide" : "Customize"}</span>
                  {isSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isSettingsOpen && (
                <div className="p-5 border-t border-zinc-800/80 bg-zinc-900/40 flex flex-col gap-4 text-xs">
                  {/* Page Size */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-300">Page Size:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(["A4", "Letter", "Legal"] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPageSize(size)}
                          className={`py-2 px-3 rounded-lg font-bold border transition-all cursor-pointer ${
                            pageSize === size
                              ? "bg-[#1DB954] text-black border-[#1DB954]"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Orientation */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-300">Orientation:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(["portrait", "landscape"] as const).map((orient) => (
                        <button
                          key={orient}
                          type="button"
                          onClick={() => setOrientation(orient)}
                          className={`py-2 px-3 rounded-lg font-bold capitalize border transition-all cursor-pointer ${
                            orientation === orient
                              ? "bg-[#1DB954] text-black border-[#1DB954]"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                          }`}
                        >
                          {orient}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Margins */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-300">Page Margins:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(["default", "small", "none"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMargin(m)}
                          className={`py-2 px-3 rounded-lg font-bold capitalize border transition-all cursor-pointer ${
                            margin === m
                              ? "bg-[#1DB954] text-black border-[#1DB954]"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                          }`}
                        >
                          {m === "default" ? "Default (1.8cm)" : m === "small" ? "Small (0.8cm)" : "None"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Graphics */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                    <div>
                      <span className="font-bold text-zinc-200 block">Print Background Graphics</span>
                      <span className="text-[11px] text-zinc-400">Include colors, cards & background images</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPrintBackground((prev) => !prev)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        printBackground ? "bg-[#1DB954]" : "bg-zinc-700"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          printBackground ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ERROR BANNER */}
            {conversionError && (
              <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3 shadow-lg">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Conversion Error</span>
                  <span className="text-zinc-300 mt-0.5 block leading-relaxed">{conversionError}</span>
                </div>
              </div>
            )}

            {/* MAIN CONVERT BUTTON */}
            <button
              onClick={handleRunConversion}
              disabled={isConverting || !currentHtmlContent.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-4 rounded-full transition-all shadow-xl shadow-[#1DB954]/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConverting ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-black" />
                  <span>{conversionProgress || "GENERATING PDF..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  <span>CONVERT HTML TO PDF</span>
                </>
              )}
            </button>
          </div>

          {/* RIGHT COLUMN: ISOLATED SAFE LIVE PREVIEW (6 COLS ON DESKTOP) */}
          <div className="lg:col-span-6 xl:col-span-6 flex flex-col gap-4">
            <div className="bg-[#18181b] p-4 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl h-full min-h-[500px]">
              {/* Preview Header & Controls */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#1DB954]" />
                  <span className="font-bold text-white">Live Sandboxed Preview</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">
                    Safe Isolation
                  </span>
                </div>

                {/* Zoom / Scale Control */}
                <div className="flex items-center gap-1.5">
                  {[75, 100].map((scale) => (
                    <button
                      key={scale}
                      onClick={() => setPreviewScale(scale)}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        previewScale === scale
                          ? "bg-zinc-700 text-white border-zinc-600"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                      }`}
                    >
                      {scale}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Sandboxed Safe Iframe Container */}
              <div className="flex-1 bg-zinc-950/80 rounded-xl border border-zinc-800/80 p-3 flex items-center justify-center overflow-auto custom-scrollbar">
                {currentHtmlContent ? (
                  <div
                    className="bg-white rounded-lg shadow-2xl overflow-hidden transition-transform duration-200"
                    style={{
                      width: orientation === "landscape" ? "100%" : "95%",
                      maxWidth: orientation === "landscape" ? "680px" : "480px",
                      minHeight: "480px",
                      transform: `scale(${previewScale / 100})`,
                      transformOrigin: "top center",
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      srcDoc={currentHtmlContent}
                      title="HTML Safe Preview"
                      sandbox="allow-same-origin"
                      className="w-full h-[520px] border-none bg-white"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 text-zinc-500 gap-2">
                    <Code className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                    <span className="text-xs font-bold text-zinc-400">No HTML Preview Available</span>
                    <span className="text-[11px]">Upload an HTML document or enter markup to see live rendering.</span>
                  </div>
                )}
              </div>

              {/* Preview Footer Info */}
              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                <span>Rendering Target: {pageSize} ({orientation})</span>
                <span className="text-[#1DB954] font-semibold">Zero DOM Contamination Sandbox</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
