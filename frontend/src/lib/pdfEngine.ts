import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { WatermarkOptions, PageNumberOptions } from "../types";

// Configure worker for pdfjs-dist using Vite bundled worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Reads a File object into an ArrayBuffer
 */
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

/**
 * Renders page thumbnails and extracts text from a PDF file using pdfjs-dist
 */
export async function processPdfFile(file: File): Promise<{
  pagesCount: number;
  pageThumbnails: string[];
  fullText: string;
  pageTexts: string[];
}> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const pagesCount = pdfDoc.numPages;

  const pageThumbnails: string[] = [];
  const pageTexts: string[] = [];
  let fullText = "";

  // Render up to 100 pages thumbnails smoothly
  const renderLimit = Math.min(pagesCount, 100);

  for (let i = 1; i <= renderLimit; i++) {
    try {
      const page = await pdfDoc.getPage(i);

      // Text extraction
      let pageText = "";
      try {
        const textContent = await page.getTextContent();
        pageText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");
      } catch (err) {
        console.warn(`Could not extract text for page ${i}:`, err);
      }
      pageTexts.push(pageText);
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;

      // Render thumbnail canvas
      try {
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          pageThumbnails.push(canvas.toDataURL("image/jpeg", 0.7));
        } else {
          pageThumbnails.push("");
        }
      } catch (err) {
        console.warn(`Could not render thumbnail for page ${i}:`, err);
        pageThumbnails.push("");
      }
    } catch (err) {
      console.warn(`Failed to process page ${i}:`, err);
    }
  }

  return {
    pagesCount,
    pageThumbnails,
    fullText: fullText.trim(),
    pageTexts,
  };
}

/**
 * Merges multiple PDF files into a single PDF Uint8Array
 */
export async function mergePDFs(files: File[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error("No files provided for merging.");

  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await fileToArrayBuffer(file);
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

/**
 * Splits a PDF according to range tuples
 */
export async function splitPDF(
  file: File,
  ranges: { start: number; end: number }[] // 1-based indices
): Promise<{ filename: string; bytes: Uint8Array }[]> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const srcPdf = await PDFDocument.load(arrayBuffer);
  const totalPages = srcPdf.getPageCount();

  const results: { filename: string; bytes: Uint8Array }[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const startIdx = Math.max(0, range.start - 1);
    const endIdx = Math.min(totalPages - 1, range.end - 1);

    if (startIdx > endIdx) continue;

    const newPdf = await PDFDocument.create();
    const pageIndices = [];
    for (let p = startIdx; p <= endIdx; p++) {
      pageIndices.push(p);
    }

    const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));

    const bytes = await newPdf.save();
    const cleanName = file.name.replace(/\.pdf$/i, "");
    results.push({
      filename: `${cleanName}_part_${i + 1}_pages_${startIdx + 1}-${endIdx + 1}.pdf`,
      bytes,
    });
  }

  return results;
}

/**
 * Reorders and rotates specific pages into a new PDF document
 */
export async function reorderAndRotatePages(
  file: File,
  pagesInfo: { originalIndex: number; rotation: number }[]
): Promise<Uint8Array> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const srcPdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  for (const pageInfo of pagesInfo) {
    const [copiedPage] = await newPdf.copyPages(srcPdf, [pageInfo.originalIndex]);
    if (pageInfo.rotation !== 0) {
      const currentRotation = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((currentRotation + pageInfo.rotation) % 360));
    }
    newPdf.addPage(copiedPage);
  }

  return await newPdf.save();
}

/**
 * Applies a text watermark over all or selected pages
 */
export async function addWatermark(
  file: File,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();
  const hexColor = options.color.replace("#", "");
  const r = parseInt(hexColor.substring(0, 2) || "00", 16) / 255;
  const g = parseInt(hexColor.substring(2, 4) || "00", 16) / 255;
  const b = parseInt(hexColor.substring(4, 6) || "00", 16) / 255;

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
    const textHeight = font.heightAtSize(options.fontSize);

    let x = (width - textWidth) / 2;
    let y = (height - textHeight) / 2;

    if (options.position === "top") y = height - 100;
    if (options.position === "bottom") y = 80;

    page.drawText(options.text, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(r, g, b),
      opacity: options.opacity,
      rotate: degrees(options.rotation),
    });
  }

  return await pdfDoc.save();
}

/**
 * Adds page numbers to pages
 */
export async function addPageNumbers(
  file: File,
  options: PageNumberOptions
): Promise<Uint8Array> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const totalPages = pdfDoc.getPageCount();

  const pages = pdfDoc.getPages();

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    let numStr = options.format.replace("{n}", (i + 1).toString()).replace("{total}", totalPages.toString());
    const textWidth = font.widthOfTextAtSize(numStr, options.fontSize);

    let x = (width - textWidth) / 2; // bottom-center
    let y = 30;

    if (options.position === "bottom-right") x = width - textWidth - 40;
    if (options.position === "bottom-left") x = 40;
    if (options.position === "top-right") {
      x = width - textWidth - 40;
      y = height - 30;
    }

    page.drawText(numStr, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  return await pdfDoc.save();
}

/**
 * Converts image files (JPG, PNG, WebP) into a single PDF Uint8Array
 */
export async function imagesToPDF(imageFiles: File[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const imgFile of imageFiles) {
    let embeddedImage = null;
    try {
      const arrayBuffer = await fileToArrayBuffer(imgFile);
      if (imgFile.type.includes("png")) {
        embeddedImage = await pdfDoc.embedPng(arrayBuffer);
      } else if (imgFile.type.includes("jpeg") || imgFile.type.includes("jpg")) {
        embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
      } else {
        throw new Error("Needs canvas conversion");
      }
    } catch {
      // Robust fallback for WebP, BMP, and custom images via Canvas
      try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imgFile);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = objectUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 600;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
          const base64 = dataUrl.split(",")[1];
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          embeddedImage = await pdfDoc.embedJpg(bytes);
        }
        URL.revokeObjectURL(objectUrl);
      } catch (fallbackErr) {
        console.warn(`Could not embed image ${imgFile.name}:`, fallbackErr);
      }
    }

    if (embeddedImage) {
      const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height,
      });
    }
  }

  return await pdfDoc.save();
}

/**
 * Renders each PDF page as PNG data URLs
 */
export async function pdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const images: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport } as any).promise;
      images.push(canvas.toDataURL("image/png"));
    }
  }

  return images;
}

/**
 * Helper to download raw PDF bytes in browser as valid standard PDF
 */
export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  if (!bytes || bytes.byteLength === 0) {
    alert("Cannot download empty file.");
    return;
  }

  // Validate PDF header %PDF-
  const headerStr = String.fromCharCode(...bytes.slice(0, 5));
  if (!headerStr.startsWith("%PDF")) {
    console.error("Downloaded file is not a valid PDF. Header:", headerStr);
    alert("PDF export error: The generated file is not a valid standard PDF.");
    return;
  }

  const cleanFilename = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", cleanFilename);
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export interface CompressOptions {
  level: "low" | "balanced" | "high";
}

/**
 * Compresses a PDF client-side by re-encoding pages and optimizing image streams.
 */
export async function compressPDF(
  file: File,
  options: CompressOptions
): Promise<{
  bytes: Uint8Array;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savedPercentage: number;
}> {
  const originalBuffer = await fileToArrayBuffer(file);
  const originalSizeBytes = file.size;

  const srcPdf = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
  const compressedPdf = await PDFDocument.create();

  const pageIndices = srcPdf.getPageIndices();
  const copiedPages = await compressedPdf.copyPages(srcPdf, pageIndices);
  copiedPages.forEach((page) => compressedPdf.addPage(page));

  const bytes = await compressedPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  let compressedSizeBytes = bytes.byteLength;

  if (options.level === "high" || options.level === "balanced") {
    try {
      const scale = options.level === "high" ? 1.0 : 1.25;
      const quality = options.level === "high" ? 0.6 : 0.75;

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(originalBuffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      const rasterPdf = await PDFDocument.create();

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          const imgDataUrl = canvas.toDataURL("image/jpeg", quality);
          const base64 = imgDataUrl.split(",")[1];
          const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const embeddedImg = await rasterPdf.embedJpg(imgBytes);

          const newPage = rasterPdf.addPage([viewport.width / scale, viewport.height / scale]);
          newPage.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: viewport.width / scale,
            height: viewport.height / scale,
          });
        }
      }

      const rasterBytes = await rasterPdf.save({ useObjectStreams: true });
      if (rasterBytes.byteLength < compressedSizeBytes) {
        compressedSizeBytes = rasterBytes.byteLength;
        const savedPct = Math.max(0, parseFloat((((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100).toFixed(1)));
        return {
          bytes: rasterBytes,
          originalSizeBytes,
          compressedSizeBytes,
          savedPercentage: savedPct,
        };
      }
    } catch (err) {
      console.warn("Raster compression fallback warning:", err);
    }
  }

  const savedPercentage = Math.max(0, parseFloat((((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100).toFixed(1)));

  return {
    bytes,
    originalSizeBytes,
    compressedSizeBytes,
    savedPercentage,
  };
}

/**
 * Renders a specific page of a PDF file to a high-resolution PNG data URL
 */
export async function renderPdfPageToDataUrl(
  file: File,
  pageIndex: number,
  scale: number = 1.5
): Promise<{ dataUrl: string; width: number; height: number }> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const targetPageNum = Math.min(Math.max(1, pageIndex + 1), numPages);

  const page = await pdfDoc.getPage(targetPageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create 2D rendering context for PDF page");
  }

  await page.render({ canvasContext: ctx, viewport } as any).promise;
  const dataUrl = canvas.toDataURL("image/png");

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Replaces one or more pages in a PDF with modified PNG/JPEG image data URLs and returns the full updated PDF bytes.
 * If originalSource is not a PDF, it creates a new PDF from the modified images.
 * All original pages, page dimensions, and total page count are strictly preserved.
 */
export async function replaceMultiplePdfPagesWithImages(
  originalSource: File | Uint8Array | null,
  modifiedPages: { [pageIndex: number]: string }
): Promise<Uint8Array> {
  const pageIndices = Object.keys(modifiedPages).map(Number);
  if (pageIndices.length === 0 && originalSource) {
    if (originalSource instanceof Uint8Array) return originalSource;
    return new Uint8Array(await originalSource.arrayBuffer());
  }

  // Determine if source is PDF
  let isPdf = false;
  let originalBuffer: ArrayBuffer | null = null;

  if (originalSource instanceof Uint8Array) {
    originalBuffer = originalSource.buffer.slice(
      originalSource.byteOffset,
      originalSource.byteOffset + originalSource.byteLength
    );
    isPdf = true;
  } else if (originalSource && typeof (originalSource as File).arrayBuffer === "function") {
    const file = originalSource as File;
    if (
      file.name.toLowerCase().endsWith(".pdf") ||
      file.type.toLowerCase().includes("pdf") ||
      !file.type.startsWith("image/")
    ) {
      try {
        originalBuffer = await file.arrayBuffer();
        isPdf = true;
      } catch {
        isPdf = false;
      }
    }
  }

  // If source is not a PDF, create a new PDF from the modified images
  if (!originalBuffer || !isPdf) {
    const newPdf = await PDFDocument.create();
    for (const pIdx of pageIndices.sort((a, b) => a - b)) {
      const dataUrl = modifiedPages[pIdx];
      if (!dataUrl) continue;
      const base64Data = dataUrl.split(",")[1] || dataUrl;
      const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const embeddedImg =
        dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg")
          ? await newPdf.embedJpg(imgBytes)
          : await newPdf.embedPng(imgBytes);
      const page = newPdf.addPage([embeddedImg.width, embeddedImg.height]);
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: embeddedImg.width,
        height: embeddedImg.height,
      });
    }
    return await newPdf.save();
  }

  try {
    const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();

    for (const [idxStr, dataUrl] of Object.entries(modifiedPages)) {
      const pIdx = parseInt(idxStr, 10);
      if (isNaN(pIdx) || pIdx < 0 || pIdx >= totalPages || !dataUrl) continue;

      const base64Data = dataUrl.split(",")[1] || dataUrl;
      const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const embeddedImg =
        dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg")
          ? await pdfDoc.embedJpg(imgBytes)
          : await pdfDoc.embedPng(imgBytes);

      const targetPage = pdfDoc.getPage(pIdx);
      const { width, height } = targetPage.getSize();

      // Draw cleaned image over target page (covers whole page canvas)
      targetPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
    }

    return await pdfDoc.save();
  } catch (pdfErr) {
    console.warn("Falling back to canvas-based PDF generation:", pdfErr);
    // Fallback if PDF loading fails
    const newPdf = await PDFDocument.create();
    for (const pIdx of pageIndices.sort((a, b) => a - b)) {
      const dataUrl = modifiedPages[pIdx];
      if (!dataUrl) continue;
      const base64Data = dataUrl.split(",")[1] || dataUrl;
      const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const embeddedImg = await newPdf.embedPng(imgBytes);
      const page = newPdf.addPage([embeddedImg.width, embeddedImg.height]);
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: embeddedImg.width,
        height: embeddedImg.height,
      });
    }
    return await newPdf.save();
  }
}

/**
 * Replaces a specific page in a PDF with a cleaned PNG image data URL and returns the full updated PDF bytes.
 * Preserves all other pages in the PDF.
 */
export async function replacePdfPageWithImage(
  originalFile: File | Uint8Array | null,
  pageIndex: number,
  cleanedImageDataUrl: string
): Promise<Uint8Array> {
  return await replaceMultiplePdfPagesWithImages(originalFile, {
    [pageIndex]: cleanedImageDataUrl,
  });
}

