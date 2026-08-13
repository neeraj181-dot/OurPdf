import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { WatermarkOptions, PageNumberOptions } from "../types";

// Configure worker for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

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
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pagesCount = pdfDoc.numPages;

  const pageThumbnails: string[] = [];
  const pageTexts: string[] = [];
  let fullText = "";

  // Render max 30 pages to prevent memory overflow on huge PDFs
  const renderLimit = Math.min(pagesCount, 30);

  for (let i = 1; i <= renderLimit; i++) {
    const page = await pdfDoc.getPage(i);

    // Text extraction
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || "")
      .join(" ");
    pageTexts.push(pageText);
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;

    // Render thumbnail canvas
    const viewport = page.getViewport({ scale: 0.35 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      pageThumbnails.push(canvas.toDataURL("image/jpeg", 0.7));
    } else {
      pageThumbnails.push("");
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
 * Converts image files (JPG, PNG) into a single PDF Uint8Array
 */
export async function imagesToPDF(imageFiles: File[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const imgFile of imageFiles) {
    const arrayBuffer = await fileToArrayBuffer(imgFile);
    let image;
    if (imgFile.type.includes("png")) {
      image = await pdfDoc.embedPng(arrayBuffer);
    } else {
      image = await pdfDoc.embedJpg(arrayBuffer);
    }

    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  return await pdfDoc.save();
}

/**
 * Renders each PDF page as PNG data URLs
 */
export async function pdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      images.push(canvas.toDataURL("image/png"));
    }
  }

  return images;
}

/**
 * Helper to download raw PDF bytes in browser
 */
export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
