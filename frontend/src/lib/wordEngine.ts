import mammoth from "mammoth";
import { Document as DocxDocument, Paragraph, TextRun, HeadingLevel, Packer } from "docx";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import html2canvas from "html2canvas";
import { fileToArrayBuffer } from "./pdfEngine";
import { prepareDomForHtml2Canvas, sanitizeAllCssColors } from "./colorNormalizer";

/**
 * Converts Word (.docx) file ArrayBuffer to formatted HTML content string
 */
export async function wordToHtml(file: File): Promise<string> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value || "<p>Converted Word Document</p>";
}

/**
 * Client-Side Word (.docx) to PDF conversion engine.
 * Converts DOCX semantic elements (headings, bold, italic, tables, lists, images)
 * to high-resolution A4 PDF document bytes.
 */
export async function convertWordToPdfClient(file: File): Promise<Uint8Array> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const htmlBody = result.value || "<p>[Empty Word Document]</p>";

  // Create offscreen A4 container for crisp vector/raster rendering
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.minHeight = "1123px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#111827";
  container.style.padding = "48px";
  container.style.boxSizing = "border-box";
  container.style.fontFamily = "Helvetica, Arial, sans-serif";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.6";
  container.style.zIndex = "-9999";

  // Injected typography and table styles
  const styledContent = `
    <style>
      h1 { font-size: 24px; font-weight: bold; margin-top: 16px; margin-bottom: 12px; color: #111827; text-align: center; }
      h2 { font-size: 18px; font-weight: bold; margin-top: 16px; margin-bottom: 8px; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
      h3 { font-size: 15px; font-weight: bold; margin-top: 12px; margin-bottom: 6px; color: #374151; }
      p { margin-bottom: 10px; color: #1f2937; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 13px; text-align: left; }
      th { background-color: #f3f4f6; font-weight: bold; }
      tr:nth-child(even) { background-color: #fafafa; }
      ol, ul { margin: 8px 0; padding-left: 24px; }
      li { margin-bottom: 4px; }
      img { max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px; }
      strong, b { font-weight: bold; }
      em, i { font-style: italic; }
      u { text-decoration: underline; }
    </style>
    <div>${sanitizeAllCssColors(htmlBody)}</div>
  `;

  container.innerHTML = styledContent;
  document.body.appendChild(container);

  try {
    const canvas = await (html2canvas as any)(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
        prepareDomForHtml2Canvas(clonedDoc, clonedEl);
      },
    });

    const imgDataUrl = canvas.toDataURL("image/png", 0.95);
    const base64Data = imgDataUrl.split(",")[1];
    const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const pdfDoc = await PDFDocument.create();
    const embeddedImg = await pdfDoc.embedPng(imgBytes);
    const pdfPage = pdfDoc.addPage([595.28, 841.89]); // Standard A4 dimensions in points
    pdfPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89,
    });

    return await pdfDoc.save();
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Converts a PDF file into a real editable Microsoft Word (.docx) Blob
 */
export async function pdfToWordDocx(file: File): Promise<Blob> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const docSections: any[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    const children: any[] = [];

    // Header per page
    children.push(
      new Paragraph({
        text: `--- Page ${i} ---`,
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 200 },
      })
    );

    let currentParagraphText = "";

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const str = item.str;

      if (!str || str.trim() === "") {
        if (currentParagraphText.trim() !== "") {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: currentParagraphText, size: 24 })],
              spacing: { after: 120 },
            })
          );
          currentParagraphText = "";
        }
        continue;
      }

      // Check if heading size
      const fontSize = Math.round(item.transform?.[0] || 12);
      if (fontSize > 16) {
        if (currentParagraphText.trim() !== "") {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: currentParagraphText, size: 24 })],
              spacing: { after: 120 },
            })
          );
          currentParagraphText = "";
        }
        children.push(
          new Paragraph({
            text: str,
            heading: fontSize > 22 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            spacing: { after: 160 },
          })
        );
      } else {
        currentParagraphText += (currentParagraphText ? " " : "") + str;
      }
    }

    if (currentParagraphText.trim() !== "") {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: currentParagraphText, size: 24 })],
          spacing: { after: 120 },
        })
      );
    }

    docSections.push({
      properties: {},
      children,
    });
  }

  const doc = new DocxDocument({
    sections: docSections,
  });

  return await Packer.toBlob(doc);
}

/**
 * Downloads a Blob as a Word (.docx) file
 */
export function downloadWordBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const cleanFilename = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  a.setAttribute("download", cleanFilename);
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
