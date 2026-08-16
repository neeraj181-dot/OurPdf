import React, { useState, useRef } from "react";
import {
  FileText,
  FileCode,
  Download,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Eye,
  RotateCcw,
  Sparkles,
  Layers,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { apiConvertWordToPdf, apiRecordDownload, UserProfile } from "../../lib/api";
import { pdfToWordDocx, downloadWordBlob } from "../../lib/wordEngine";
import { downloadPdfBytes } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface WordWorkspaceProps {
  mode: "word-to-pdf" | "pdf-to-word";
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker: () => void;
  onOpenInEditor?: (html: string, filename: string) => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onDownloadRecorded?: () => void;
}

export const WordWorkspace: React.FC<WordWorkspaceProps> = ({
  mode,
  activeFile,
  user,
  onOpenFilePicker,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  // Word → PDF State
  const [selectedWordFile, setSelectedWordFile] = useState<File | null>(null);
  const [isConvertingWord, setIsConvertingWord] = useState(false);
  const [convertedPdfBytes, setConvertedPdfBytes] = useState<Uint8Array | null>(null);
  const [convertedPdfName, setConvertedPdfName] = useState<string>("");
  const [pdfPageThumbnails, setPdfPageThumbnails] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);
  const [isSavedToCloudState, setIsSavedToCloudState] = useState(false);

  // PDF → Word State
  const [isConvertingPdfToWord, setIsConvertingPdfToWord] = useState(false);
  const [generatedDocxBlob, setGeneratedDocxBlob] = useState<Blob | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle Real Word Document Conversion
  const handleWordFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    e.target.value = "";

    soundEffects.playClick();
    setSelectedWordFile(file);
    setWordError(null);
    setConvertedPdfBytes(null);
    setPdfPageThumbnails([]);
    setShowPreview(false);
    setIsConvertingWord(true);

    try {
      // 1. Call FastAPI conversion endpoint
      const pdfBytes = await apiConvertWordToPdf(file);
      const outFilename = file.name.replace(/\.[^/.]+$/, "") + ".pdf";

      setConvertedPdfBytes(pdfBytes);
      setConvertedPdfName(outFilename);
      soundEffects.playSuccess();

      // 2. Generate page preview thumbnails using pdfjs-dist
      try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
        const pdfDoc = await loadingTask.promise;
        const thumbs: string[] = [];
        const maxPages = Math.min(pdfDoc.numPages, 10);

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.8 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport } as any).promise;
            thumbs.push(canvas.toDataURL("image/jpeg", 0.85));
          }
        }
        setPdfPageThumbnails(thumbs);
      } catch (thumbErr) {
        console.warn("Could not render converted PDF thumbnails:", thumbErr);
      }
    } catch (err: any) {
      console.error("Word conversion error:", err);
      setWordError(
        err?.message || "Unable to convert this Word document. Please verify that the file is a valid .docx document."
      );
    } finally {
      setIsConvertingWord(false);
    }
  };

  // Download Converted PDF
  const handleDownloadConvertedPdf = () => {
    if (!convertedPdfBytes) return;
    soundEffects.playClick();
    downloadPdfBytes(convertedPdfBytes, convertedPdfName || "converted_document.pdf");
  };

  // PDF → Word Handler
  const handleRunPdfToWord = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsConvertingPdfToWord(true);
    setWordError(null);

    try {
      const docxBlob = await pdfToWordDocx(activeFile.file);
      setGeneratedDocxBlob(docxBlob);
      soundEffects.playSuccess();
      const outputFilename = `${activeFile.name.replace(/\.[^/.]+$/, "")}.docx`;
      downloadWordBlob(docxBlob, outputFilename);

      // Track download in backend PostgreSQL and local storage
      if (user) {
        try {
          await apiRecordDownload(docxBlob, outputFilename, "PDF to Word");
          onDownloadRecorded?.();
        } catch (backendErr) {
          console.warn("Backend download recording warning:", backendErr);
        }
      } else {
        await recordDownloadedDoc(
          outputFilename,
          docxBlob.size,
          activeFile.pagesCount || 1,
          "PDF to Word",
          docxBlob,
          activeFile.backendDocId
        );
        onDownloadRecorded?.();
      }
    } catch (err: any) {
      console.error("PDF to Word conversion error:", err);
      setWordError(err?.message || "Error converting PDF pages to Word document");
    } finally {
      setIsConvertingPdfToWord(false);
    }
  };

  const handleResetWordToPdf = () => {
    soundEffects.playClick();
    setSelectedWordFile(null);
    setConvertedPdfBytes(null);
    setPdfPageThumbnails([]);
    setShowPreview(false);
    setWordError(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 font-sans text-white">
      {/* Header */}
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            {mode === "word-to-pdf" ? <FileText className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
            <span>{mode === "word-to-pdf" ? "WORD → PDF CONVERTER" : "PDF → WORD CONVERTER"}</span>
          </div>
          <h2 className="text-xl font-bold mt-0.5">
            {mode === "word-to-pdf" ? "Convert Word (.docx) to PDF" : "Convert PDF to Editable Word (.docx)"}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {mode === "word-to-pdf"
              ? "Convert Microsoft Word documents into clean, standard A4 PDF files."
              : `Active PDF: ${activeFile?.name || "None Selected"}`}
          </p>
        </div>

        {mode === "pdf-to-word" && !activeFile && (
          <button
            onClick={onOpenFilePicker}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-all cursor-pointer shadow-md"
          >
            <span>SELECT PDF FILE</span>
          </button>
        )}
      </div>

      {/* WORKSPACE 1: WORD TO PDF */}
      {mode === "word-to-pdf" && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-6 shadow-xl">
          {/* 1. INITIAL UPLOAD STATE */}
          {!selectedWordFile && !isConvertingWord && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954] mb-2">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">Upload Microsoft Word Document</h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                Select a .docx Word document to convert paragraphs, headings, lists, tables, and images into a high-quality PDF.
              </p>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-3 rounded-full transition-all cursor-pointer shadow-lg"
              >
                <FolderOpen className="w-4 h-4 stroke-[2.5]" />
                <span>Select Word Document (.docx)</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".docx, .doc, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword"
                onChange={handleWordFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* 2. CONVERTING STATE */}
          {isConvertingWord && (
            <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-zinc-900 border border-[#1DB954]/50 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-[#1DB954] animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Converting Word document...</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Parsing {selectedWordFile?.name} and generating high-resolution PDF document
                </p>
              </div>
            </div>
          )}

          {/* 3. ERROR STATE */}
          {wordError && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Conversion Failed</span>
                  <span className="text-zinc-300 mt-0.5 block">{wordError}</span>
                </div>
              </div>

              <button
                onClick={handleResetWordToPdf}
                className="self-center flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Another Document</span>
              </button>
            </div>
          )}

          {/* 4. SUCCESS RESULT STATE */}
          {convertedPdfBytes && (
            <div className="flex flex-col gap-6">
              {/* Success Notification Banner */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1DB954] shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Word document converted successfully.</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Output PDF is ready for preview and download.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleResetWordToPdf}
                  className="text-xs text-zinc-400 hover:text-white underline font-medium cursor-pointer"
                >
                  Convert Another
                </button>
              </div>

              {/* Document Details Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1 text-xs">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Original Word Document</span>
                  <span className="font-bold text-white truncate">{selectedWordFile?.name}</span>
                  <span className="text-zinc-400 text-[11px] mt-1">{selectedWordFile ? formatBytes(selectedWordFile.size) : ""}</span>
                </div>

                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1 text-xs">
                  <span className="text-[10px] font-bold text-[#1DB954] uppercase tracking-wider">Generated PDF File</span>
                  <span className="font-bold text-white truncate">{convertedPdfName}</span>
                  <span className="text-zinc-400 text-[11px] mt-1">
                    {pdfPageThumbnails.length} Pages • {formatBytes(convertedPdfBytes.byteLength)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    setShowPreview((prev) => !prev);
                  }}
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer border border-zinc-700"
                >
                  <Eye className="w-4 h-4 text-[#1DB954]" />
                  <span>{showPreview ? "Hide Preview" : "Preview PDF"}</span>
                </button>

                {onSaveToCloud && (
                  <button
                    onClick={() => {
                      if (!convertedPdfBytes) return;
                      onSaveToCloud(convertedPdfBytes, convertedPdfName || "converted_document.pdf", "word-to-pdf");
                      setIsSavedToCloudState(true);
                    }}
                    disabled={isSavedToCloudState}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                      isSavedToCloudState
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 cursor-default"
                        : "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                    }`}
                  >
                    <span>{isSavedToCloudState ? "Saved to Cloud" : "Save to My Documents"}</span>
                  </button>
                )}

                <button
                  onClick={handleDownloadConvertedPdf}
                  className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-lg transition-colors cursor-pointer shadow-lg"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download PDF</span>
                </button>
              </div>

              {/* PDF Preview Gallery */}
              {showPreview && pdfPageThumbnails.length > 0 && (
                <div className="pt-4 border-t border-zinc-800 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                    <Layers className="w-4 h-4 text-[#1DB954]" />
                    <span>Converted Document Pages ({pdfPageThumbnails.length}):</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {pdfPageThumbnails.map((thumb, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-950 p-2 rounded-xl border border-zinc-800 flex flex-col gap-2 shadow-md"
                      >
                        <div className="aspect-[3/4] bg-white rounded overflow-hidden flex items-center justify-center p-1">
                          <img
                            src={thumb}
                            alt={`Page ${idx + 1}`}
                            className="w-full h-full object-contain"
                          />
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
        </div>
      )}

      {/* WORKSPACE 2: PDF TO WORD */}
      {mode === "pdf-to-word" && activeFile && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-6 shadow-xl">
          <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <FileCode className="w-6 h-6 text-[#1DB954]" />
              <div>
                <span className="text-xs font-bold text-white block">{activeFile.name}</span>
                <span className="text-[11px] text-zinc-400 font-semibold">
                  {activeFile.pagesCount} Pages • {formatBytes(activeFile.size)} • Ready for Word Conversion
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRunPdfToWord}
            disabled={isConvertingPdfToWord}
            className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3.5 rounded-full transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isConvertingPdfToWord ? "animate-spin" : ""}`} />
            <span>{isConvertingPdfToWord ? "CONVERTING PDF TO WORD..." : "CONVERT PDF TO WORD (.DOCX)"}</span>
          </button>

          {wordError && (
            <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Conversion Failed</span>
                <span className="text-zinc-300 mt-0.5 block">{wordError}</span>
              </div>
            </div>
          )}

          {generatedDocxBlob && !wordError && (
            <div className="bg-emerald-950/60 p-4 rounded-xl border border-emerald-500/30 flex items-center gap-3 text-xs">
              <CheckCircle2 className="w-5 h-5 text-[#1DB954] shrink-0" />
              <div>
                <span className="text-emerald-300 font-bold block">✓ Word Document (.docx) Downloaded</span>
                <span className="text-zinc-400 text-[11px]">
                  {activeFile.name.replace(/\.[^/.]+$/, "")}.docx is ready and saved to your device.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
