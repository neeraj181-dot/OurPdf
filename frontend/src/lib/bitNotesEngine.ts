import { PDFDocument, rgb, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  BitNoteItem,
  BitNotesLayoutOptions,
  PaperSize,
  Orientation,
  CutLineStyle,
  NoteBorderStyle,
} from "../types";

// Configure worker for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Conversion constants
export const MM_TO_PT = 72 / 25.4; // 2.834645669...
export const PT_TO_MM = 25.4 / 72;

export interface PaperDimensions {
  widthMm: number;
  heightMm: number;
  widthPt: number;
  heightPt: number;
}

export interface CellLayoutInfo {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  xPt: number;
  yPt: number; // PDF coordinate (origin at bottom-left)
  widthPt: number;
  heightPt: number;
  colIndex: number;
  rowIndex: number;
}

export interface PageLayoutInfo {
  paper: PaperDimensions;
  columns: number;
  rows: number;
  notesPerPage: number;
  outerMarginMm: number;
  gapMm: number;
  cells: CellLayoutInfo[];
  cellWidthMm: number;
  cellHeightMm: number;
  totalPages: number;
}

/**
 * Returns physical dimensions in mm and PDF points for given paper size and orientation.
 */
export function getPaperDimensions(
  paperSize: PaperSize,
  orientation: Orientation,
  customWidthMm = 210,
  customHeightMm = 297
): PaperDimensions {
  let wMm = 210;
  let hMm = 297;

  switch (paperSize) {
    case "A3":
      wMm = 297;
      hMm = 420;
      break;
    case "Letter":
      wMm = 215.9;
      hMm = 279.4;
      break;
    case "Custom":
      wMm = Math.max(50, customWidthMm || 210);
      hMm = Math.max(50, customHeightMm || 297);
      break;
    case "A4":
    default:
      wMm = 210;
      hMm = 297;
      break;
  }

  // Swap if landscape
  if (orientation === "landscape") {
    if (wMm < hMm) {
      const tmp = wMm;
      wMm = hMm;
      hMm = tmp;
    }
  } else {
    // portrait
    if (wMm > hMm) {
      const tmp = wMm;
      wMm = hMm;
      hMm = tmp;
    }
  }

  return {
    widthMm: wMm,
    heightMm: hMm,
    widthPt: wMm * MM_TO_PT,
    heightPt: hMm * MM_TO_PT,
  };
}

/**
 * Resolves grid columns and rows based on preset layout and orientation.
 */
export function resolveGridDimensions(
  preset: BitNotesLayoutOptions["preset"],
  orientation: Orientation,
  customCols = 2,
  customRows = 4
): { columns: number; rows: number } {
  if (preset === "custom") {
    return {
      columns: Math.max(1, Math.min(10, customCols || 2)),
      rows: Math.max(1, Math.min(10, customRows || 4)),
    };
  }

  const isLandscape = orientation === "landscape";

  switch (preset) {
    case "12-per-page":
      return isLandscape ? { columns: 4, rows: 3 } : { columns: 3, rows: 4 };
    case "8-per-page":
      return isLandscape ? { columns: 4, rows: 2 } : { columns: 2, rows: 4 };
    case "6-per-page":
      return isLandscape ? { columns: 3, rows: 2 } : { columns: 2, rows: 3 };
    case "4-per-page":
      return { columns: 2, rows: 2 };
    default:
      return isLandscape ? { columns: 4, rows: 2 } : { columns: 2, rows: 4 };
  }
}

/**
 * Calculates page layout and cell coordinates for preview and PDF generation.
 */
export function calculatePageLayout(
  options: BitNotesLayoutOptions,
  totalNotes: number
): PageLayoutInfo {
  const paper = getPaperDimensions(
    options.paperSize,
    options.orientation,
    options.customWidthMm,
    options.customHeightMm
  );

  const { columns, rows } = resolveGridDimensions(
    options.preset,
    options.orientation,
    options.columns,
    options.rows
  );

  const notesPerPage = columns * rows;
  const totalPages = Math.max(1, Math.ceil(totalNotes / notesPerPage));

  const marginMm = Math.max(0, options.outerMarginMm);
  const gapMm = Math.max(0, options.gapMm);

  const printableWidthMm = Math.max(10, paper.widthMm - 2 * marginMm);
  const printableHeightMm = Math.max(10, paper.heightMm - 2 * marginMm);

  const totalColGapsMm = (columns - 1) * gapMm;
  const totalRowGapsMm = (rows - 1) * gapMm;

  const cellWidthMm = Math.max(5, (printableWidthMm - totalColGapsMm) / columns);
  const cellHeightMm = Math.max(5, (printableHeightMm - totalRowGapsMm) / rows);

  const cellWidthPt = cellWidthMm * MM_TO_PT;
  const cellHeightPt = cellHeightMm * MM_TO_PT;
  const gapPt = gapMm * MM_TO_PT;
  const marginPt = marginMm * MM_TO_PT;

  const cells: CellLayoutInfo[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const xMm = marginMm + c * (cellWidthMm + gapMm);
      const yMm = marginMm + r * (cellHeightMm + gapMm); // From top of sheet in UI terms

      const xPt = marginPt + c * (cellWidthPt + gapPt);
      // In PDF coordinates (0,0 is bottom-left):
      const yPt = paper.heightPt - marginPt - (r + 1) * cellHeightPt - r * gapPt;

      cells.push({
        xMm,
        yMm,
        widthMm: cellWidthMm,
        heightMm: cellHeightMm,
        xPt,
        yPt,
        widthPt: cellWidthPt,
        heightPt: cellHeightPt,
        colIndex: c,
        rowIndex: r,
      });
    }
  }

  return {
    paper,
    columns,
    rows,
    notesPerPage,
    outerMarginMm: marginMm,
    gapMm,
    cells,
    cellWidthMm,
    cellHeightMm,
    totalPages,
  };
}

/**
 * Parses uploaded image or PDF files into individual BitNoteItem objects.
 * For multi-page PDFs, each page is rendered as an independent note item.
 */
export async function parseFilesToBitNotes(
  files: File[],
  onProgress?: (loaded: number, total: number, message: string) => void
): Promise<BitNoteItem[]> {
  const result: BitNoteItem[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (onProgress) {
      onProgress(i + 1, files.length, `Processing ${file.name}...`);
    }

    if (isPdf) {
      try {
        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;

        for (let p = 1; p <= numPages; p++) {
          const page = await pdfDoc.getPage(p);
          // Render at high resolution (scale 2.0 = ~144 DPI preview / export)
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            await page.render({ canvasContext: ctx, viewport } as any).promise;
            const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
            result.push({
              id: `pdf-${file.name}-p${p}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              title: numPages > 1 ? `${file.name} (p.${p})` : file.name,
              sourceType: "pdf_page",
              file,
              dataUrl,
              width: viewport.width,
              height: viewport.height,
              aspectRatio: viewport.width / viewport.height,
              rotation: 0,
              pageIndex: p,
              originalFileName: file.name,
            });
          }
        }
      } catch (err) {
        console.error(`Failed to parse PDF ${file.name}:`, err);
      }
    } else {
      // Image file (JPG, PNG, WEBP, etc.)
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve({ width: 800, height: 600 });
          img.src = dataUrl;
        });

        result.push({
          id: `img-${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: file.name,
          sourceType: "image",
          file,
          dataUrl,
          width: dims.width,
          height: dims.height,
          aspectRatio: dims.width / dims.height,
          rotation: 0,
          originalFileName: file.name,
        });
      } catch (err) {
        console.error(`Failed to read image file ${file.name}:`, err);
      }
    }
  }

  return result;
}

/**
 * Calculates note placement bounds inside a cell, respecting autoFit, autoRotate, and manual rotation.
 */
export function calculateNoteFitInCell(
  note: BitNoteItem,
  cell: CellLayoutInfo,
  autoFit = true,
  autoRotate = true
): {
  effectiveRotation: number;
  renderWidthMm: number;
  renderHeightMm: number;
  offsetXInsideCellMm: number;
  offsetYInsideCellMm: number;
  scale: number;
} {
  let effectiveRotation = note.rotation || 0;

  // Check if auto-rotation yields better fill without distorting aspect ratio
  if (autoRotate && effectiveRotation === 0) {
    const isCellLandscape = cell.widthMm > cell.heightMm;
    const isNoteLandscape = note.aspectRatio > 1.05;
    const isNotePortrait = note.aspectRatio < 0.95;

    // If cell is portrait and note is landscape, or cell is landscape and note is portrait
    if (isCellLandscape && isNotePortrait) {
      effectiveRotation = 90;
    } else if (!isCellLandscape && isNoteLandscape) {
      effectiveRotation = 90;
    }
  }

  const isRotated90 = effectiveRotation === 90 || effectiveRotation === 270;
  const effectiveAspect = isRotated90 ? 1 / note.aspectRatio : note.aspectRatio;

  let renderWidthMm = cell.widthMm;
  let renderHeightMm = cell.heightMm;

  if (autoFit) {
    const cellAspect = cell.widthMm / cell.heightMm;
    if (effectiveAspect > cellAspect) {
      // Note is wider than cell -> constrain by width
      renderWidthMm = cell.widthMm;
      renderHeightMm = cell.widthMm / effectiveAspect;
    } else {
      // Note is taller than cell -> constrain by height
      renderHeightMm = cell.heightMm;
      renderWidthMm = cell.heightMm * effectiveAspect;
    }
  }

  const offsetXInsideCellMm = (cell.widthMm - renderWidthMm) / 2;
  const offsetYInsideCellMm = (cell.heightMm - renderHeightMm) / 2;

  const scale = renderWidthMm / (isRotated90 ? note.height : note.width);

  return {
    effectiveRotation,
    renderWidthMm,
    renderHeightMm,
    offsetXInsideCellMm,
    offsetYInsideCellMm,
    scale,
  };
}

/**
 * Smart packing recommendation: analyzes the list of notes and suggests
 * the optimal preset and orientation to maximize printable area.
 */
export function recommendSmartLayout(
  notes: BitNoteItem[],
  currentPaper: PaperSize = "A4"
): {
  recommendedOrientation: Orientation;
  recommendedPreset: BitNotesLayoutOptions["preset"];
} {
  if (notes.length === 0) {
    return { recommendedOrientation: "portrait", recommendedPreset: "8-per-page" };
  }

  const landscapeCount = notes.filter((n) => n.aspectRatio > 1.1).length;
  const portraitCount = notes.filter((n) => n.aspectRatio < 0.9).length;

  const orientation: Orientation = landscapeCount > portraitCount ? "landscape" : "portrait";

  let preset: BitNotesLayoutOptions["preset"] = "8-per-page";
  if (notes.length <= 4) {
    preset = "4-per-page";
  } else if (notes.length <= 6) {
    preset = "6-per-page";
  } else if (notes.length <= 8) {
    preset = "8-per-page";
  } else {
    preset = "12-per-page";
  }

  return {
    recommendedOrientation: orientation,
    recommendedPreset: preset,
  };
}

/**
 * Exports high-resolution vector PDF using pdf-lib.
 * - Exact physical page dimensions in points (1 mm = 2.8346 pt).
 * - High quality image embedding (PNG/JPEG).
 * - Precise vector cut lines (dashed, light solid, or crop marks).
 * - Note borders.
 */
export async function generateBitNotesPDF(
  notes: BitNoteItem[],
  options: BitNotesLayoutOptions,
  onProgress?: (page: number, totalPages: number) => void
): Promise<Uint8Array> {
  if (notes.length === 0) {
    throw new Error("No notes provided to generate Bit Notes PDF.");
  }

  const layout = calculatePageLayout(options, notes.length);
  const pdfDoc = await PDFDocument.create();

  const totalPages = layout.totalPages;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (onProgress) {
      onProgress(pageIdx + 1, totalPages);
    }

    const pdfPage = pdfDoc.addPage([layout.paper.widthPt, layout.paper.heightPt]);
    const startIndex = pageIdx * layout.notesPerPage;
    const pageNotes = notes.slice(startIndex, startIndex + layout.notesPerPage);

    // 1. Draw Cut Lines if enabled
    if (options.cutLines !== "none") {
      drawCutLinesOnPdf(pdfPage, layout, options.cutLines);
    }

    // 2. Draw each note in its cell
    for (let cIdx = 0; cIdx < pageNotes.length; cIdx++) {
      const note = pageNotes[cIdx];
      const cell = layout.cells[cIdx];
      if (!cell) continue;

      const fit = calculateNoteFitInCell(
        note,
        cell,
        options.autoFit,
        options.autoRotate
      );

      // Convert image dataUrl to bytes and embed in PDF
      try {
        let embeddedImage: any = null;
        const isPng = note.dataUrl.startsWith("data:image/png");

        const byteCharacters = atob(note.dataUrl.split(",")[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        if (isPng) {
          try {
            embeddedImage = await pdfDoc.embedPng(byteArray);
          } catch {
            embeddedImage = await pdfDoc.embedJpg(byteArray);
          }
        } else {
          try {
            embeddedImage = await pdfDoc.embedJpg(byteArray);
          } catch {
            embeddedImage = await pdfDoc.embedPng(byteArray);
          }
        }

        if (embeddedImage) {
          const drawWidthPt = fit.renderWidthMm * MM_TO_PT;
          const drawHeightPt = fit.renderHeightMm * MM_TO_PT;
          const drawXPt = cell.xPt + fit.offsetXInsideCellMm * MM_TO_PT;
          const drawYPt = cell.yPt + (cell.heightMm - fit.renderHeightMm - fit.offsetYInsideCellMm) * MM_TO_PT;

          // Note rotation handling
          if (fit.effectiveRotation === 90) {
            pdfPage.drawImage(embeddedImage, {
              x: drawXPt + drawWidthPt,
              y: drawYPt,
              width: drawHeightPt,
              height: drawWidthPt,
              rotate: degrees(90),
            });
          } else if (fit.effectiveRotation === 180) {
            pdfPage.drawImage(embeddedImage, {
              x: drawXPt + drawWidthPt,
              y: drawYPt + drawHeightPt,
              width: drawWidthPt,
              height: drawHeightPt,
              rotate: degrees(180),
            });
          } else if (fit.effectiveRotation === 270) {
            pdfPage.drawImage(embeddedImage, {
              x: drawXPt,
              y: drawYPt + drawHeightPt,
              width: drawHeightPt,
              height: drawWidthPt,
              rotate: degrees(270),
            });
          } else {
            pdfPage.drawImage(embeddedImage, {
              x: drawXPt,
              y: drawYPt,
              width: drawWidthPt,
              height: drawHeightPt,
            });
          }

          // 3. Draw Note Border if enabled
          if (options.borders !== "none") {
            const borderWidth = options.borders === "medium" ? 1.2 : 0.6;
            pdfPage.drawRectangle({
              x: drawXPt,
              y: drawYPt,
              width: drawWidthPt,
              height: drawHeightPt,
              borderColor: rgb(0.7, 0.7, 0.72),
              borderWidth,
            });
          }
        }
      } catch (err) {
        console.error(`Failed to embed note #${cIdx + 1} into PDF:`, err);
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * Draws crisp cut lines or crop tick marks across the PDF page.
 */
function drawCutLinesOnPdf(
  page: any,
  layout: PageLayoutInfo,
  cutLineStyle: CutLineStyle
) {
  const lineColor = rgb(0.65, 0.65, 0.68);
  const thickness = 0.5;
  const isDashed = cutLineStyle === "dashed";
  const dashArray = isDashed ? [4, 4] : undefined;

  if (cutLineStyle === "dashed" || cutLineStyle === "light") {
    // Draw vertical guide lines between columns
    for (let c = 1; c < layout.columns; c++) {
      const prevCell = layout.cells[c - 1];
      const currCell = layout.cells[c];
      const midXPt = (prevCell.xPt + prevCell.widthPt + currCell.xPt) / 2;

      page.drawLine({
        start: { x: midXPt, y: layout.paper.heightPt - layout.outerMarginMm * MM_TO_PT },
        end: { x: midXPt, y: layout.outerMarginMm * MM_TO_PT },
        thickness,
        color: lineColor,
        dashArray,
      });
    }

    // Draw horizontal guide lines between rows
    for (let r = 1; r < layout.rows; r++) {
      const topCell = layout.cells[(r - 1) * layout.columns];
      const bottomCell = layout.cells[r * layout.columns];
      const midYPt = (topCell.yPt + bottomCell.yPt + bottomCell.heightPt) / 2;

      page.drawLine({
        start: { x: layout.outerMarginMm * MM_TO_PT, y: midYPt },
        end: { x: layout.paper.widthPt - layout.outerMarginMm * MM_TO_PT, y: midYPt },
        thickness,
        color: lineColor,
        dashArray,
      });
    }
  } else if (cutLineStyle === "crop-marks") {
    // Draw corner crop ticks at the perimeter of every cell
    const tickLenPt = 4 * MM_TO_PT;

    layout.cells.forEach((cell) => {
      const left = cell.xPt;
      const right = cell.xPt + cell.widthPt;
      const bottom = cell.yPt;
      const top = cell.yPt + cell.heightPt;

      // Top-Left corner ticks
      page.drawLine({ start: { x: left - tickLenPt, y: top }, end: { x: left, y: top }, thickness, color: lineColor });
      page.drawLine({ start: { x: left, y: top + tickLenPt }, end: { x: left, y: top }, thickness, color: lineColor });

      // Top-Right corner ticks
      page.drawLine({ start: { x: right, y: top }, end: { x: right + tickLenPt, y: top }, thickness, color: lineColor });
      page.drawLine({ start: { x: right, y: top + tickLenPt }, end: { x: right, y: top }, thickness, color: lineColor });

      // Bottom-Left corner ticks
      page.drawLine({ start: { x: left - tickLenPt, y: bottom }, end: { x: left, y: bottom }, thickness, color: lineColor });
      page.drawLine({ start: { x: left, y: bottom - tickLenPt }, end: { x: left, y: bottom }, thickness, color: lineColor });

      // Bottom-Right corner ticks
      page.drawLine({ start: { x: right, y: bottom }, end: { x: right + tickLenPt, y: bottom }, thickness, color: lineColor });
      page.drawLine({ start: { x: right, y: bottom - tickLenPt }, end: { x: right, y: bottom }, thickness, color: lineColor });
    });
  }
}

/**
 * Triggers native browser print for the generated PDF bytes.
 */
export function printBitNotesPdf(pdfBytes: Uint8Array) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(blobUrl, "_blank");
    }
  };
}
