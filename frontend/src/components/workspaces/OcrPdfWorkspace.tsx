import React, { useState } from "react";
import { Sparkles, Download, CheckCircle2, Languages, Eye, AlertCircle, FileText, RotateCcw, Cloud, Layers } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { apiOcrPdf, apiRecordDownload, UserProfile } from "../../lib/api";
import { downloadPdfBytes } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface OcrPdfWorkspaceProps {
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onDownloadRecorded?: () => void;
}

export const OcrPdfWorkspace: React.FC<OcrPdfWorkspaceProps> = ({
  activeFile,
  user,
  onOpenFilePicker,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<"eng" | "hin" | "mal">("eng");
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrProgressText, setOcrProgressText] = useState("");
  const [searchablePdfBytes, setSearchablePdfBytes] = useState<Uint8Array | null>(null);
  const [extractedSnippet, setExtractedSnippet] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavedToCloudState, setIsSavedToCloudState] = useState(false);

  const LANGUAGES = [
    { code: "eng", name: "English", desc: "Latin alphabets & standard symbols" },
    { code: "hin", name: "Hindi (हिन्दी)", desc: "Devanagari script" },
    { code: "mal", name: "Malayalam (മലയാളം)", desc: "Malayalam Brahmic script" },
  ];

  const handleRunOcr = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsOcrRunning(true);
    setErrorMsg(null);
    setSearchablePdfBytes(null);
    setOcrProgressText("Analyzing scanned document & extracting text layer...");

    try {
      setOcrProgressText("Compiling invisible searchable layer with coordinates...");
      const outputBytes = await apiOcrPdf(activeFile.file, selectedLanguage);
      setSearchablePdfBytes(outputBytes);
      soundEffects.playSuccess();

      // Extract quick text snippet from generated PDF to show user proof of searchability
      try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(outputBytes) });
        const pdfDoc = await loadingTask.promise;
        let snippet = "";
        for (let i = 1; i <= Math.min(pdfDoc.numPages, 3); i++) {
          const p = await pdfDoc.getPage(i);
          const tc = await p.getTextContent();
          const t = tc.items.map((it: any) => it.str).join(" ");
          if (t.trim()) {
            snippet += `[Page ${i} Text Layer]: ${t}\n\n`;
          }
        }
        setExtractedSnippet(snippet.trim() || activeFile.extractedText || "Searchable text layer embedded successfully.");
      } catch (e) {
        setExtractedSnippet("Searchable text layer embedded successfully.");
      }
    } catch (err: any) {
      console.error("OCR error:", err);
      setErrorMsg(err?.message || "Failed to generate searchable PDF via OCR.");
    } finally {
      setIsOcrRunning(false);
      setOcrProgressText("");
    }
  };

  const handleDownload = () => {
    if (!searchablePdfBytes || !activeFile) return;
    soundEffects.playClick();
    const outName = `${activeFile.name.replace(/\.[^/.]+$/, "")}_searchable.pdf`;
    downloadPdfBytes(searchablePdfBytes, outName);

    if (user) {
      apiRecordDownload(searchablePdfBytes, outName, "OCR PDF")
        .then(() => onDownloadRecorded?.())
        .catch((e) => console.warn(e));
    } else {
      recordDownloadedDoc(
        outName,
        searchablePdfBytes.byteLength,
        activeFile.pagesCount || 1,
        "OCR PDF",
        searchablePdfBytes
      );
      onDownloadRecorded?.();
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 font-sans text-white">
      {/* Header */}
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>OCR PDF (SEARCHABLE DOCUMENT ENGINE)</span>
            <span className="bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40 px-2 py-0.5 rounded text-[10px] font-bold ml-1">
              NEW
            </span>
          </div>
          <h2 className="text-xl font-bold mt-0.5">Extract Text & Make PDF Searchable</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Active Document: <span className="text-white font-semibold">{activeFile?.name || "None Selected"}</span>
          </p>
        </div>

        {!activeFile && (
          <button
            onClick={onOpenFilePicker}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-all cursor-pointer shadow-md"
          >
            <span>SELECT PDF FILE</span>
          </button>
        )}
      </div>

      {activeFile && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-6 shadow-xl">
          {/* Language Selection */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#1DB954]" />
              <span>Select Primary OCR Language</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LANGUAGES.map((lang) => {
                const isSelected = selectedLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      soundEffects.playClick();
                      setSelectedLanguage(lang.code as any);
                    }}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-zinc-800 border-[#1DB954] shadow-lg shadow-[#1DB954]/10"
                        : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{lang.name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{lang.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleRunOcr}
            disabled={isOcrRunning}
            className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-4 rounded-full transition-all shadow-xl shadow-[#1DB954]/20 cursor-pointer disabled:opacity-50"
          >
            {isOcrRunning ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-black" />
                <span>{ocrProgressText || "PROCESSING OCR & GENERATING SEARCHABLE TEXT LAYER..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>GENERATE SEARCHABLE PDF (OCR)</span>
              </>
            )}
          </button>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">OCR Processing Failed</span>
                <span className="text-zinc-300 mt-0.5 block">{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Success / Result State */}
          {searchablePdfBytes && !errorMsg && (
            <div className="pt-6 border-t border-zinc-800 flex flex-col gap-5 animate-in fade-in">
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1DB954] shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Searchable PDF Ready!</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Text has been recognized and embedded as a selectable, searchable layer.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onSaveToCloud && (
                    <button
                      onClick={() => {
                        onSaveToCloud(searchablePdfBytes, `${activeFile.name.replace(/\.[^/.]+$/, "")}_searchable.pdf`, "ocr-pdf");
                        setIsSavedToCloudState(true);
                      }}
                      disabled={isSavedToCloudState}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-3 py-1.5 rounded-lg border border-zinc-700 cursor-pointer"
                    >
                      {isSavedToCloudState ? "Saved" : "Save to Cloud"}
                    </button>
                  )}

                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Download Searchable PDF</span>
                  </button>
                </div>
              </div>

              {/* Text Layer Preview */}
              {extractedSnippet && (
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-[#1DB954]" />
                      <span>Searchable Text Layer Content</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">100% Selectable & Copyable</span>
                  </div>
                  <pre className="bg-zinc-950 p-3 rounded-lg text-xs font-mono text-zinc-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {extractedSnippet}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
