import React, { useState, useRef, useEffect } from "react";
import {
  FileCheck,
  Type,
  CheckSquare,
  ListFilter,
  Download,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  MousePointerClick,
  FileText,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFFileItem } from "../../types";
import { apiGetFormFields, apiFillPdf, apiRecordDownload, UserProfile } from "../../lib/api";
import { downloadPdfBytes, fileToArrayBuffer } from "../../lib/pdfEngine";
import { soundEffects } from "../../lib/audio";
import { recordDownloadedDoc } from "../../lib/docStorage";

interface FillPdfWorkspaceProps {
  activeFile: PDFFileItem | null;
  user?: UserProfile | null;
  onOpenFilePicker: () => void;
  onSaveToCloud?: (fileOrBytes: Uint8Array | Blob, filename: string, op: string) => void;
  onDownloadRecorded?: () => void;
}

interface CustomTextAnnotation {
  id: string;
  page: number;
  text: string;
  x: number;
  y: number;
  font_size: number;
  color: string;
}

export const FillPdfWorkspace: React.FC<FillPdfWorkspaceProps> = ({
  activeFile,
  user,
  onOpenFilePicker,
  onSaveToCloud,
  onDownloadRecorded,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(activeFile?.pagesCount || 1);
  const [pageViewport, setPageViewport] = useState<{ width: number; height: number; scale: number }>({
    width: 595,
    height: 842,
    scale: 1,
  });

  // Form Fields detected
  const [formFields, setFormFields] = useState<any[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Custom placed texts (fallback click-to-place)
  const [isAddingTextMode, setIsAddingTextMode] = useState(false);
  const [customTexts, setCustomTexts] = useState<CustomTextAnnotation[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // Output
  const [isSaving, setIsSaving] = useState(false);
  const [filledPdfBytes, setFilledPdfBytes] = useState<Uint8Array | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavedToCloudState, setIsSavedToCloudState] = useState(false);

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load Form Fields on Mount / File Change
  useEffect(() => {
    if (!activeFile) return;
    setIsLoadingFields(true);
    setFilledPdfBytes(null);
    setCustomTexts([]);

    apiGetFormFields(activeFile.file)
      .then((res) => {
        setFormFields(res.fields || []);
        const initialVals: Record<string, any> = {};
        (res.fields || []).forEach((f: any) => {
          initialVals[f.name] = f.value || (f.type === "checkbox" ? false : "");
        });
        setFormValues(initialVals);
      })
      .catch((e) => console.warn("Form fields inspect error:", e))
      .finally(() => setIsLoadingFields(false));
  }, [activeFile]);

  // Render Page to Canvas
  useEffect(() => {
    let isCancelled = false;
    const renderPage = async () => {
      if (!activeFile) return;
      try {
        const buffer = await fileToArrayBuffer(activeFile.file);
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        setTotalPages(pdfDoc.numPages);
        const page = await pdfDoc.getPage(currentPageIndex + 1);
        if (isCancelled) return;

        const containerWidth = Math.min(window.innerWidth - 80, 580);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        setPageViewport({ width: unscaledViewport.width, height: unscaledViewport.height, scale });

        const canvas = bgCanvasRef.current;
        if (canvas) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport } as any).promise;
          }
        }
      } catch (err) {
        console.warn("Could not render page canvas:", err);
      }
    };
    renderPage();
    return () => {
      isCancelled = true;
    };
  }, [activeFile, currentPageIndex]);

  // Handle canvas click to place custom text
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingTextMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / pageViewport.scale;
    const clickY = (e.clientY - rect.top) / pageViewport.scale;

    soundEffects.playClick();
    const newText: CustomTextAnnotation = {
      id: `text-${Date.now()}`,
      page: currentPageIndex,
      text: "Sample Text",
      x: clickX,
      y: clickY,
      font_size: 11,
      color: "#000000",
    };

    setCustomTexts((prev) => [...prev, newText]);
    setSelectedTextId(newText.id);
    setIsAddingTextMode(false);
  };

  // Save / Fill PDF
  const handleSaveFilledPdf = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsSaving(true);
    setErrorMsg(null);
    setFilledPdfBytes(null);

    try {
      const outputBytes = await apiFillPdf(activeFile.file, formValues, customTexts);
      setFilledPdfBytes(outputBytes);
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error("Fill error:", err);
      setErrorMsg(err?.message || "Failed to fill and flatten PDF document.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!filledPdfBytes || !activeFile) return;
    soundEffects.playClick();
    const outName = `${activeFile.name.replace(/\.[^/.]+$/, "")}_filled.pdf`;
    downloadPdfBytes(filledPdfBytes, outName);

    if (user) {
      apiRecordDownload(filledPdfBytes, outName, "Fill PDF")
        .then(() => onDownloadRecorded?.())
        .catch((e) => console.warn(e));
    } else {
      recordDownloadedDoc(outName, filledPdfBytes.byteLength, totalPages, "Fill PDF", filledPdfBytes);
      onDownloadRecorded?.();
    }
  };

  const currentPageFormFields = formFields.filter((f) => f.page === currentPageIndex);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 font-sans text-white">
      {/* Header */}
      <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
            <FileCheck className="w-4 h-4" />
            <span>FILL PDF FORM</span>
          </div>
          <h2 className="text-xl font-bold mt-0.5">Fill PDF Forms & Annotate Fields</h2>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: FORM FIELDS & TEXT PLACEMENT (5 COLS) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  {formFields.length > 0 ? `Detected Form Fields (${formFields.length})` : "Form Input Fields"}
                </span>

                <button
                  onClick={() => {
                    soundEffects.playClick();
                    setIsAddingTextMode((prev) => !prev);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    isAddingTextMode
                      ? "bg-[#1DB954] text-black border-[#1DB954]"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>{isAddingTextMode ? "Click Page to Place" : "+ Add Text"}</span>
                </button>
              </div>

              {/* Detected AcroForm fields */}
              {formFields.length > 0 ? (
                <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                  {formFields.map((field) => (
                    <div key={field.name} className="flex flex-col gap-1.5 bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-200 truncate">{field.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">Page {field.page + 1}</span>
                      </div>

                      {field.type === "checkbox" ? (
                        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={Boolean(formValues[field.name])}
                            onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.checked }))}
                            className="accent-[#1DB954] w-4 h-4 rounded cursor-pointer"
                          />
                          <span>Checked / Active</span>
                        </label>
                      ) : field.type === "select" && field.choices?.length > 0 ? (
                        <select
                          value={formValues[field.name] || ""}
                          onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                          className="bg-zinc-950 border border-zinc-700 text-white text-xs p-2 rounded-lg"
                        >
                          <option value="">Select an option</option>
                          {field.choices.map((c: string) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={formValues[field.name] || ""}
                          onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                          placeholder="Enter value..."
                          className="bg-zinc-950 border border-zinc-700 text-white text-xs p-2 rounded-lg focus:outline-none focus:border-[#1DB954]"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 px-4 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800 text-center flex flex-col items-center justify-center gap-2 text-zinc-400">
                  <Type className="w-8 h-8 text-zinc-600" />
                  <span className="text-xs font-bold text-zinc-200">No AcroForm Fields Detected</span>
                  <span className="text-[11px] max-w-xs text-zinc-500">
                    Use the "+ Add Text" button to place custom text inputs anywhere on the document.
                  </span>
                </div>
              )}

              {/* Custom placed texts list */}
              {customTexts.length > 0 && (
                <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
                  <span className="text-xs font-bold text-zinc-300">Placed Text Annotations ({customTexts.length})</span>
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                    {customTexts.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) =>
                            setCustomTexts((prev) =>
                              prev.map((t) => (t.id === item.id ? { ...t, text: e.target.value } : t))
                            )
                          }
                          className="flex-1 bg-zinc-950 border border-zinc-700 text-white text-xs p-1.5 rounded"
                        />
                        <button
                          onClick={() => setCustomTexts((prev) => prev.filter((t) => t.id !== item.id))}
                          className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleSaveFilledPdf}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-4 rounded-full transition-all shadow-xl shadow-[#1DB954]/20 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-black" />
                    <span>SAVING & FLATTENING FORM VALUES...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>SAVE & DOWNLOAD COMPLETED PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT: INTERACTIVE PAGE CANVAS (7 COLS) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-[#18181b] p-4 rounded-2xl border border-zinc-800 flex flex-col gap-3 shadow-xl">
              {/* Pagination controls */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <Layers className="w-4 h-4 text-[#1DB954]" />
                  <span>Document Page Preview</span>
                  {isAddingTextMode && (
                    <span className="bg-[#1DB954]/20 text-[#1DB954] px-2 py-0.5 rounded text-[10px] font-bold">
                      Click anywhere on page to place text
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                    disabled={currentPageIndex === 0}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-zinc-300">
                    Page {currentPageIndex + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPageIndex >= totalPages - 1}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Interactive Page Container */}
              <div
                onClick={handleCanvasClick}
                className={`bg-zinc-950/80 p-3 rounded-xl border border-zinc-800 flex items-center justify-center overflow-auto ${
                  isAddingTextMode ? "cursor-crosshair" : "cursor-default"
                }`}
              >
                <div className="relative bg-white shadow-2xl rounded overflow-hidden">
                  <canvas ref={bgCanvasRef} className="block" />

                  {/* Render Custom Placed Texts on current page */}
                  {customTexts
                    .filter((t) => t.page === currentPageIndex)
                    .map((item) => {
                      const scaledX = item.x * pageViewport.scale;
                      const scaledY = item.y * pageViewport.scale;

                      return (
                        <div
                          key={item.id}
                          style={{
                            left: `${scaledX}px`,
                            top: `${scaledY}px`,
                          }}
                          className="absolute bg-white/95 border border-[#1DB954] px-2 py-1 rounded shadow text-black text-xs font-sans select-none flex items-center gap-1 group"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>{item.text}</span>
                          <button
                            onClick={() => setCustomTexts((prev) => prev.filter((t) => t.id !== item.id))}
                            className="text-rose-600 hover:text-rose-800 cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Success Download Banner */}
            {filledPdfBytes && (
              <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-xl flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1DB954]" />
                  <div>
                    <span className="text-xs font-bold text-white block">Form Completed & Saved!</span>
                    <span className="text-[11px] text-zinc-300">
                      All field values and annotations have been flattened into the PDF.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onSaveToCloud && (
                    <button
                      onClick={() => {
                        onSaveToCloud(filledPdfBytes, `${activeFile.name.replace(/\.[^/.]+$/, "")}_filled.pdf`, "fill-pdf");
                        setIsSavedToCloudState(true);
                      }}
                      disabled={isSavedToCloudState}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-3 py-2 rounded-lg border border-zinc-700 cursor-pointer"
                    >
                      {isSavedToCloudState ? "Saved" : "Save to Cloud"}
                    </button>
                  )}

                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Download Completed PDF</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
