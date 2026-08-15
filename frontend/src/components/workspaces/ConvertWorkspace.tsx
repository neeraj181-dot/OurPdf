import React, { useState } from "react";
import {
  FileImage,
  ImagePlus,
  Download,
  CheckCircle2,
  Plus,
  Trash2,
  FileCode,
  RefreshCw,
  FileText,
  ShieldCheck,
  Code,
} from "lucide-react";
import { PDFFileItem } from "../../types";
import { pdfToImages, downloadPdfBytes, fileToArrayBuffer } from "../../lib/pdfEngine";
import { convertImageToSvg, downloadSvgString } from "../../lib/imageToSvg";
import { soundEffects } from "../../lib/audio";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

interface ConvertWorkspaceProps {
  mode: "pdf-to-img" | "pdf-to-png" | "pdf-to-jpg" | "img-to-pdf" | "img-to-svg" | "pdf-to-markdown" | "pdf-to-pdfa" | "html-to-pdf";
  activeFile: PDFFileItem | null;
  onImagesToPdfRun: (files: File[]) => void;
  isProcessing: boolean;
}

export const ConvertWorkspace: React.FC<ConvertWorkspaceProps> = ({
  mode,
  activeFile,
  onImagesToPdfRun,
  isProcessing,
}) => {
  // PDF to Image State
  const [renderedImages, setRenderedImages] = useState<string[]>([]);
  const [isRendering, setIsRendering] = useState(false);

  // Image to PDF State
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  // Image to SVG State
  const [svgImageFile, setSvgImageFile] = useState<File | null>(null);
  const [isConvertingSvg, setIsConvertingSvg] = useState(false);
  const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);
  const [vectorColors, setVectorColors] = useState<number>(16);

  // Markdown State
  const [extractedMarkdown, setExtractedMarkdown] = useState<string | null>(null);
  const [isConvertingMarkdown, setIsConvertingMarkdown] = useState(false);

  // HTML to PDF State
  const [htmlInput, setHtmlInput] = useState<string>(
    "<h1>Document Title</h1>\n<p>Enter or paste formatted HTML content here to convert to PDF.</p>"
  );

  // 1. PDF TO PNG / JPG
  const handleRenderPdfToImages = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsRendering(true);
    try {
      const imgs = await pdfToImages(activeFile.file);
      setRenderedImages(imgs);
      soundEffects.playSuccess();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to render PDF pages: ${e?.message || "Operation failed"}`);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownloadSingleImage = (url: string, index: number) => {
    soundEffects.playSuccess();
    const ext = mode === "pdf-to-jpg" ? "jpg" : "png";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeFile?.name.replace(/\.[^/.]+$/, "") || "document"}_page_${index + 1}.${ext}`;
    a.click();
  };

  // 2. IMAGE TO PDF
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const arr = Array.from(e.target.files);
      setImageFiles((prev) => [...prev, ...arr]);
      soundEffects.playClick();
      e.target.value = "";
    }
  };

  // 3. IMAGE TO SVG
  const handleSvgImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      const isExtValid = /\.(png|jpe?g|webp)$/i.test(file.name);

      if (!validTypes.includes(file.type.toLowerCase()) && !isExtValid) {
        alert("Unsupported format. Please select a valid PNG or JPG/JPEG image file.");
        e.target.value = "";
        return;
      }

      if (file.size === 0) {
        alert("Selected image file is empty.");
        e.target.value = "";
        return;
      }

      setSvgImageFile(file);
      setGeneratedSvg(null);
      soundEffects.playClick();
      e.target.value = "";
    }
  };

  const handleRunImageToSvg = async () => {
    if (!svgImageFile) return;
    soundEffects.playClick();
    setIsConvertingSvg(true);
    try {
      const svgMarkup = await convertImageToSvg(svgImageFile, {
        numberOfColors: vectorColors,
      });
      setGeneratedSvg(svgMarkup);
      soundEffects.playSuccess();
    } catch (err: any) {
      console.error(err);
      alert(`Image to SVG conversion failed: ${err?.message || "Could not vector trace image."}`);
    } finally {
      setIsConvertingSvg(false);
    }
  };

  const handleDownloadSvg = () => {
    if (!generatedSvg || !svgImageFile) return;
    soundEffects.playSuccess();
    downloadSvgString(generatedSvg, `${svgImageFile.name.replace(/\.[^/.]+$/, "")}.svg`);
  };

  // 4. PDF TO MARKDOWN
  const handleConvertToMarkdown = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    setIsConvertingMarkdown(true);
    try {
      const buffer = await fileToArrayBuffer(activeFile.file);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;
      let md = `# ${activeFile.name.replace(/\.[^/.]+$/, "")}\n\n`;

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        md += `## Page ${i}\n\n${pageText}\n\n---\n\n`;
      }

      setExtractedMarkdown(md);
      soundEffects.playSuccess();
    } catch (err) {
      alert("Failed to convert PDF to Markdown.");
    } finally {
      setIsConvertingMarkdown(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!extractedMarkdown || !activeFile) return;
    soundEffects.playSuccess();
    const blob = new Blob([extractedMarkdown], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activeFile.name.replace(/\.[^/.]+$/, "")}.md`;
    a.click();
  };

  // 5. PDF TO PDF/A
  const handleConvertToPdfA = async () => {
    if (!activeFile) return;
    soundEffects.playClick();
    try {
      const buffer = await fileToArrayBuffer(activeFile.file);
      const pdfDoc = await PDFDocument.load(buffer);
      pdfDoc.setTitle(activeFile.name.replace(/\.[^/.]+$/, ""));
      pdfDoc.setProducer("EasyPDF PDF/A Archival Engine");
      pdfDoc.setCreator("EasyPDF");
      const pdfaBytes = await pdfDoc.save();
      downloadPdfBytes(pdfaBytes, `pdfa_${activeFile.name}`);
      soundEffects.playSuccess();
    } catch {
      alert("Failed to convert to PDF/A.");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 font-sans text-white">
      {/* MODE: PDF TO PNG / JPG */}
      {(mode === "pdf-to-img" || mode === "pdf-to-png" || mode === "pdf-to-jpg") && (
        <div className="flex flex-col gap-5">
          <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
                <FileImage className="w-4 h-4" />
                <span>PDF TO {mode === "pdf-to-jpg" ? "JPEG" : "PNG"} CONVERTER</span>
              </div>
              <h2 className="text-xl font-bold mt-0.5">
                Convert PDF Pages to High-Quality {mode === "pdf-to-jpg" ? "JPG" : "PNG"} Images
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Active Document: <span className="text-white font-semibold">{activeFile?.name || "None"}</span>
              </p>
            </div>

            <button
              onClick={handleRenderPdfToImages}
              disabled={isRendering || !activeFile}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              <FileImage className={`w-4 h-4 ${isRendering ? "animate-spin" : ""}`} />
              <span>{isRendering ? "CONVERTING PAGES..." : `CONVERT PDF TO ${mode === "pdf-to-jpg" ? "JPG" : "PNG"}`}</span>
            </button>
          </div>

          {renderedImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {renderedImages.map((imgUrl, idx) => (
                <div
                  key={idx}
                  className="bg-[#202020] p-3 rounded-xl border border-zinc-800 flex flex-col justify-between group"
                >
                  <div className="aspect-[3/4] bg-zinc-900 rounded overflow-hidden mb-2">
                    <img src={imgUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-400">Page {idx + 1}</span>
                    <button
                      onClick={() => handleDownloadSingleImage(imgUrl, idx)}
                      className="p-1.5 rounded bg-zinc-800 hover:bg-[#1DB954] text-white hover:text-black transition-colors cursor-pointer"
                      title="Download Image"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODE: IMAGE TO PDF */}
      {mode === "img-to-pdf" && (
        <div className="flex flex-col gap-5">
          <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
                <ImagePlus className="w-4 h-4" />
                <span>IMAGE TO PDF CONVERTER</span>
              </div>
              <h2 className="text-xl font-bold mt-0.5">Combine Photos, Scans & Images into PDF</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Upload multiple PNG, JPG, JPEG, or WebP images to compile into a consolidated PDF document.
              </p>
            </div>

            <label className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full cursor-pointer transition-colors shadow-md">
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Select Images</span>
              <input
                type="file"
                multiple
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {imageFiles.length === 0 ? (
            <div className="py-16 bg-[#181818] rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <ImagePlus className="w-12 h-12 text-zinc-600" />
              <p className="text-sm font-bold text-zinc-200">No images selected yet</p>
              <p className="text-xs text-zinc-500">Upload JPG, PNG, or WEBP photos to convert into PDF</p>
            </div>
          ) : (
            <div className="bg-[#181818] p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {imageFiles.map((file, idx) => (
                  <div key={idx} className="bg-[#202020] p-2 rounded-lg border border-zinc-800 relative group">
                    <div className="aspect-square bg-zinc-900 rounded overflow-hidden flex items-center justify-center">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="truncate max-w-[100px]">{file.name}</span>
                      <button
                        onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 rounded hover:bg-rose-950 text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  soundEffects.playClick();
                  onImagesToPdfRun(imageFiles);
                }}
                disabled={isProcessing}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3.5 rounded-full transition-all shadow-lg cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-black stroke-[3]" />
                <span>COMPILE {imageFiles.length} IMAGES INTO PDF</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODE: IMAGE TO SVG */}
      {mode === "img-to-svg" && (
        <div className="flex flex-col gap-5">
          <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
                <FileCode className="w-4 h-4" />
                <span>PNG/JPG → SVG VECTOR TRACER</span>
              </div>
              <h2 className="text-xl font-bold mt-0.5">Convert PNG & JPG to Scalable Vector SVG</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Vectorize raster bitmaps into scalable vector path graphics client-side.
              </p>
            </div>

            <label className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full cursor-pointer transition-colors shadow-md">
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{svgImageFile ? "Change Image" : "Select PNG / JPG"}</span>
              <input
                type="file"
                accept="image/png, image/jpeg, .png, .jpg, .jpeg"
                onChange={handleSvgImageSelect}
                className="hidden"
              />
            </label>
          </div>

          {!svgImageFile ? (
            <div className="py-16 bg-[#181818] rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <FileCode className="w-12 h-12 text-zinc-600" />
              <p className="text-sm font-bold text-zinc-200">No image selected</p>
              <p className="text-xs text-zinc-500">Select a PNG or JPG photo to convert to SVG</p>
            </div>
          ) : (
            <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-6 shadow-xl">
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="w-full md:w-1/2 aspect-square max-h-64 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center p-2 relative">
                  <img
                    src={URL.createObjectURL(svgImageFile)}
                    alt={svgImageFile.name}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/80 backdrop-blur border border-zinc-800 p-2 rounded-lg text-[11px] text-zinc-300 flex justify-between items-center">
                    <span className="truncate max-w-[180px] font-semibold">{svgImageFile.name}</span>
                    <span>{(svgImageFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                <div className="w-full md:w-1/2 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs font-bold text-zinc-300">
                      <span>Vector Palette (Colors)</span>
                      <span className="text-[#1DB954] font-mono">{vectorColors} colors</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[4, 16, 32, 64].map((c) => (
                        <button
                          key={c}
                          onClick={() => setVectorColors(c)}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            vectorColors === c
                              ? "bg-[#1DB954] text-black border-[#1DB954]"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                          }`}
                        >
                          {c} Palette
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleRunImageToSvg}
                    disabled={isConvertingSvg}
                    className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs py-3.5 rounded-full transition-all shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isConvertingSvg ? "animate-spin" : ""}`} />
                    <span>{isConvertingSvg ? "VECTOR TRACING IMAGE..." : "CONVERT IMAGE TO SVG"}</span>
                  </button>
                </div>
              </div>

              {generatedSvg && (
                <div className="pt-6 border-t border-zinc-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954]">
                      <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />
                      <span>SVG Vector Generated Successfully</span>
                    </div>

                    <button
                      onClick={handleDownloadSvg}
                      className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md"
                    >
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      <span>Download SVG</span>
                    </button>
                  </div>

                  <div
                    className="w-full min-h-[200px] max-h-[350px] bg-zinc-950 rounded-xl border border-zinc-800 p-4 flex items-center justify-center overflow-auto"
                    dangerouslySetInnerHTML={{ __html: generatedSvg }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE: PDF TO MARKDOWN */}
      {mode === "pdf-to-markdown" && (
        <div className="flex flex-col gap-5">
          <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954] uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>PDF TO MARKDOWN</span>
              </div>
              <h2 className="text-xl font-bold mt-0.5">Convert PDF to Clean Markdown (.md)</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Active Document: <span className="text-white font-semibold">{activeFile?.name || "None"}</span>
              </p>
            </div>

            <button
              onClick={handleConvertToMarkdown}
              disabled={isConvertingMarkdown || !activeFile}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              <span>{isConvertingMarkdown ? "Extracting Markdown..." : "Generate Markdown"}</span>
            </button>
          </div>

          {extractedMarkdown && (
            <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1DB954]">Markdown Preview</span>
                <button
                  onClick={handleDownloadMarkdown}
                  className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-black font-bold text-xs px-4 py-2 rounded-lg cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .md</span>
                </button>
              </div>
              <pre className="bg-zinc-950 p-4 rounded-xl text-xs font-mono text-zinc-300 max-h-96 overflow-y-auto whitespace-pre-wrap">
                {extractedMarkdown}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* MODE: PDF TO PDF/A */}
      {mode === "pdf-to-pdfa" && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col items-center text-center gap-4 shadow-xl max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Convert to PDF/A Standard</h2>
          <p className="text-xs text-zinc-400 max-w-md">
            Convert standard PDF files into ISO-compliant PDF/A format with standardized metadata for long-term document preservation and legal compliance.
          </p>
          <button
            onClick={handleConvertToPdfA}
            disabled={!activeFile}
            className="mt-2 flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-3 rounded-full transition-all shadow-md disabled:opacity-50 cursor-pointer"
          >
            <span>CONVERT & DOWNLOAD PDF/A</span>
          </button>
        </div>
      )}

      {/* MODE: HTML TO PDF */}
      {mode === "html-to-pdf" && (
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1DB954]">
            <Code className="w-4 h-4" />
            <span>HTML TO PDF CONVERTER</span>
          </div>
          <p className="text-xs text-zinc-400">Enter or paste HTML markup below:</p>
          <textarea
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            rows={8}
            className="w-full bg-zinc-950 text-zinc-200 font-mono text-xs p-4 rounded-xl border border-zinc-800 focus:outline-none focus:border-[#1DB954]"
          />
        </div>
      )}
    </div>
  );
};
