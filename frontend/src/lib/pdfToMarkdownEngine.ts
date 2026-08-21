import * as pdfjsLib from "pdfjs-dist";
import { fileToArrayBuffer } from "./pdfEngine";
import { apiConvertPdfToMarkdown } from "./api";

export interface PdfMarkdownResult {
  markdown: string;
  isScanned: boolean;
  pageCount: number;
  headingsCount: number;
  tablesCount: number;
  wordCount: number;
  error?: string;
}

interface TextItemInfo {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
  linkUrl?: string;
}

interface LineInfo {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  items: TextItemInfo[];
}

/**
 * Robust PDF to Clean Markdown Conversion Engine
 * Parses structure, title, headings (H1-H3), lists, tables, links, and paragraphs across all pages.
 */
export async function convertPdfToMarkdown(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<PdfMarkdownResult> {
  // 1. Try high-precision backend converter
  try {
    const serverRes = await apiConvertPdfToMarkdown(file);
    if (serverRes && serverRes.markdown) {
      return {
        markdown: serverRes.markdown,
        isScanned: serverRes.isScanned,
        pageCount: serverRes.pageCount,
        headingsCount: serverRes.headings,
        tablesCount: serverRes.tables,
        wordCount: serverRes.words,
      };
    }
  } catch (err) {
    console.warn("Backend Markdown endpoint unavailable, using client-side conversion:", err);
  }

  // 2. Client-side conversion fallback
  try {
    const buffer = await fileToArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    if (pageCount === 0) {
      return {
        markdown: "",
        isScanned: false,
        pageCount: 0,
        headingsCount: 0,
        tablesCount: 0,
        wordCount: 0,
        error: "PDF contains no pages.",
      };
    }

    const allPagesLines: LineInfo[][] = [];
    let totalTextChars = 0;

    // 1. Extract text items, positions, fonts, and annotations for every page
    for (let pno = 1; pno <= pageCount; pno++) {
      if (onProgress) {
        onProgress(pno, pageCount);
      }

      const page = await pdfDoc.getPage(pno);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      // Extract hyperlinks if available
      let annotations: any[] = [];
      try {
        annotations = await page.getAnnotations();
      } catch {
        annotations = [];
      }

      const links = annotations
        .filter((ann) => ann.subtype === "Link" && (ann.url || ann.dest))
        .map((ann) => ({
          rect: ann.rect as number[], // [x1, y1, x2, y2]
          url: ann.url || (typeof ann.dest === "string" ? ann.dest : "#"),
        }));

      const rawItems: TextItemInfo[] = [];

      for (const item of textContent.items as any[]) {
        const textStr = (item.str || "").trim();
        if (!textStr) continue;

        totalTextChars += textStr.length;
        const tx = item.transform; // [scaleX, skewY, skewX, scaleY, transX, transY]
        const x = Math.round(tx[4]);
        const y = Math.round(tx[5]);
        const fontSize = Math.round(Math.hypot(tx[2], tx[3]) || item.height || 12);
        const fontName = (item.fontName || "").toLowerCase();
        const isBold =
          fontName.includes("bold") ||
          fontName.includes("black") ||
          fontName.includes("heavy") ||
          fontName.includes("hebo") ||
          fontName.includes("goth");
        const isItalic =
          fontName.includes("italic") ||
          fontName.includes("oblique");

        // Check if item intersects any hyperlink
        let linkUrl: string | undefined = undefined;
        for (const l of links) {
          if (l.rect && x >= l.rect[0] - 5 && x <= l.rect[2] + 5 && y >= l.rect[1] - 5 && y <= l.rect[3] + 5) {
            linkUrl = l.url;
            break;
          }
        }

        rawItems.push({
          str: item.str,
          x,
          y,
          width: item.width || 0,
          height: item.height || fontSize,
          fontSize,
          fontName,
          isBold,
          isItalic,
          linkUrl,
        });
      }

      // Group raw items into visual lines (based on vertical y coordinates)
      // Note: PDF y increases upwards, so higher y is higher on the page.
      rawItems.sort((a, b) => b.y - a.y || a.x - b.x);

      const pageLines: LineInfo[] = [];
      let currentLineItems: TextItemInfo[] = [];
      let currentY: number | null = null;

      for (const item of rawItems) {
        if (currentY === null || Math.abs(item.y - currentY) <= 4.0) {
          currentLineItems.push(item);
          if (currentY === null) currentY = item.y;
        } else {
          // Finish previous line
          currentLineItems.sort((a, b) => a.x - b.x);
          const lineText = assembleLineText(currentLineItems);
          if (lineText.trim()) {
            pageLines.push({
              text: lineText.trim(),
              x: currentLineItems[0].x,
              y: currentY,
              width: (currentLineItems[currentLineItems.length - 1].x + currentLineItems[currentLineItems.length - 1].width) - currentLineItems[0].x,
              height: Math.max(...currentLineItems.map((i) => i.height)),
              fontSize: Math.round(currentLineItems.reduce((acc, i) => acc + i.fontSize, 0) / currentLineItems.length),
              isBold: currentLineItems.some((i) => i.isBold),
              isItalic: currentLineItems.some((i) => i.isItalic),
              items: currentLineItems,
            });
          }
          currentLineItems = [item];
          currentY = item.y;
        }
      }

      if (currentLineItems.length > 0 && currentY !== null) {
        currentLineItems.sort((a, b) => a.x - b.x);
        const lineText = assembleLineText(currentLineItems);
        if (lineText.trim()) {
          pageLines.push({
            text: lineText.trim(),
            x: currentLineItems[0].x,
            y: currentY,
            width: (currentLineItems[currentLineItems.length - 1].x + currentLineItems[currentLineItems.length - 1].width) - currentLineItems[0].x,
            height: Math.max(...currentLineItems.map((i) => i.height)),
            fontSize: Math.round(currentLineItems.reduce((acc, i) => acc + i.fontSize, 0) / currentLineItems.length),
            isBold: currentLineItems.some((i) => i.isBold),
            isItalic: currentLineItems.some((i) => i.isItalic),
            items: currentLineItems,
          });
        }
      }

      allPagesLines.push(pageLines);
    }

    // 2. Check for scanned / image-only PDFs
    if (totalTextChars < 20) {
      return {
        markdown: `# ${file.name.replace(/\.[^/.]+$/, "")}\n\n> **Notice**: This PDF contains scanned or image-only pages without selectable text layers.\n> OCR (Optical Character Recognition) is required to extract text from scanned documents.`,
        isScanned: true,
        pageCount,
        headingsCount: 0,
        tablesCount: 0,
        wordCount: 0,
      };
    }

    // 3. Compute Body Font Size Baseline across document
    const fontSizeCounts = new Map<number, number>();
    for (const pageLines of allPagesLines) {
      for (const line of pageLines) {
        if (line.text.length > 15) {
          fontSizeCounts.set(line.fontSize, (fontSizeCounts.get(line.fontSize) || 0) + line.text.length);
        }
      }
    }

    let bodyFontSize = 11;
    let maxCount = 0;
    fontSizeCounts.forEach((count, sz) => {
      if (count > maxCount) {
        maxCount = count;
        bodyFontSize = sz;
      }
    });

    // 4. Filter repetitive running headers and footers across pages
    const headerFooterTexts = new Set<string>();
    if (pageCount > 1) {
      const topBottomOccurrences = new Map<string, number>();
      for (const pageLines of allPagesLines) {
        if (pageLines.length > 0) {
          const firstLine = pageLines[0].text.trim();
          const lastLine = pageLines[pageLines.length - 1].text.trim();
          if (firstLine.length < 60) topBottomOccurrences.set(firstLine, (topBottomOccurrences.get(firstLine) || 0) + 1);
          if (lastLine.length < 60) topBottomOccurrences.set(lastLine, (topBottomOccurrences.get(lastLine) || 0) + 1);
        }
      }
      topBottomOccurrences.forEach((count, text) => {
        if (count >= Math.max(2, Math.floor(pageCount * 0.6))) {
          headerFooterTexts.add(text);
        }
      });
    }

    // 5. Build Structured Markdown document
    const markdownSections: string[] = [];
    let detectedDocTitle: string | null = null;
    let headingsCount = 0;
    let tablesCount = 0;

    for (let pno = 0; pno < pageCount; pno++) {
      const rawLines = allPagesLines[pno];
      if (!rawLines || rawLines.length === 0) continue;

      // Filter header/footers and pure page numbers like "Page 1", "1 / 2"
      const lines = rawLines.filter((l, idx) => {
        const t = l.text.trim();
        if (headerFooterTexts.has(t)) return false;
        if (/^(Page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+|\d+)$/i.test(t) && (idx === 0 || idx === rawLines.length - 1)) {
          return false;
        }
        return true;
      });

      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const text = line.text;

        // Check if this line is part of a table
        const tableBlock = tryExtractTable(lines, i);
        if (tableBlock) {
          markdownSections.push(tableBlock.markdown);
          tablesCount++;
          i = tableBlock.nextIndex;
          continue;
        }

        // Check Document Title (Page 1 first prominent line)
        if (
          pno === 0 &&
          !detectedDocTitle &&
          i < 3 &&
          (line.fontSize >= bodyFontSize * 1.35 || line.isBold) &&
          text.length < 120 &&
          !/^\d+\.?\s+/.test(text)
        ) {
          detectedDocTitle = text;
          markdownSections.push(`# ${text}`);
          headingsCount++;
          i++;
          continue;
        }

        // Check Headings (H1, H2, H3)
        const isNumH1 = /^\d+\.?\s+[A-Za-z]/.test(text) || /^(Chapter|Section|Part|Unit|Appendix)\s+\d+[:\.]?\s*/i.test(text);
        const isNumH2 = /^\d+\.\d+\.?\s+[A-Za-z]/.test(text);
        const isNumH3 = /^\d+\.\d+\.\d+\.?\s+[A-Za-z]/.test(text);
        const isAllCaps = /^[A-Z0-9\s\-_:]{3,60}$/.test(text) && text.split(" ").length <= 7 && !text.match(/^\d+$/);

        if (text.length <= 130 && (isNumH3 || (line.fontSize >= bodyFontSize * 1.05 && line.isBold && isAllCaps))) {
          markdownSections.push(`#### ${cleanHeadingText(text)}`);
          headingsCount++;
          i++;
          continue;
        } else if (text.length <= 130 && (isNumH2 || (line.fontSize >= bodyFontSize * 1.15 && (line.isBold || isAllCaps)))) {
          markdownSections.push(`### ${cleanHeadingText(text)}`);
          headingsCount++;
          i++;
          continue;
        } else if (text.length <= 130 && (isNumH1 || line.fontSize >= bodyFontSize * 1.35 || (line.fontSize >= bodyFontSize * 1.18 && line.isBold))) {
          markdownSections.push(`## ${cleanHeadingText(text)}`);
          headingsCount++;
          i++;
          continue;
        }

        // Check Lists (Unordered Bullet list)
        if (/^[\s•\-\*▪▫–—\u2022\u25cf]\s+/.test(text)) {
          const itemText = text.replace(/^[\s•\-\*▪▫–—\u2022\u25cf]+\s*/, "").trim();
          markdownSections.push(`- ${itemText}`);
          i++;
          continue;
        }

        // Check Lists (Ordered list items: 1., 2., 3., (1), (a))
        const orderedMatch = text.match(/^(\(\d+\)|\d+\))\s+(.*)$/) || text.match(/^(\d+)\.\s+([A-Za-z].*)$/);
        if (orderedMatch && !isNumH1 && text.length > 5) {
          markdownSections.push(`1. ${orderedMatch[2] || orderedMatch[1]}`);
          i++;
          continue;
        }

        // Regular Paragraph - Merge consecutive continuation lines cleanly
        const paragraphLines: string[] = [text];
        let nextIdx = i + 1;

        while (nextIdx < lines.length) {
          const nextL = lines[nextIdx];
          const nextT = nextL.text;

          // Stop paragraph merge if next line is heading, list item, or table
          const isNextH =
            /^\d+\.?\s+[A-Za-z]/.test(nextT) ||
            /^\d+\.\d+\.?\s+[A-Za-z]/.test(nextT) ||
            nextL.fontSize >= bodyFontSize * 1.2 ||
            /^[\s•\-\*▪▫–—\u2022\u25cf]\s+/.test(nextT) ||
            tryExtractTable(lines, nextIdx) !== null;

          if (isNextH) break;

          // Check for vertical paragraph gap (large gap indicates new paragraph)
          const verticalGap = Math.abs(lines[nextIdx - 1].y - nextL.y);
          if (verticalGap > nextL.height * 2.2) break;

          paragraphLines.push(nextT);
          nextIdx++;
        }

        // Assemble paragraph and de-hyphenate broken words
        const mergedParagraph = assembleParagraph(paragraphLines);
        if (mergedParagraph) {
          markdownSections.push(mergedParagraph);
        }

        i = nextIdx;
      }
    }

    // Fallback: If no document title was detected, prepend file name as H1
    let finalMarkdown = markdownSections.join("\n\n").trim();
    if (!detectedDocTitle && !finalMarkdown.startsWith("# ")) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      finalMarkdown = `# ${cleanName}\n\n${finalMarkdown}`;
      headingsCount++;
    }

    const wordCount = finalMarkdown.split(/\s+/).filter(Boolean).length;

    return {
      markdown: finalMarkdown,
      isScanned: false,
      pageCount,
      headingsCount,
      tablesCount,
      wordCount,
    };
  } catch (err: any) {
    console.error("Error converting PDF to Markdown:", err);
    return {
      markdown: "",
      isScanned: false,
      pageCount: 0,
      headingsCount: 0,
      tablesCount: 0,
      wordCount: 0,
      error: err?.message || "Failed to parse and convert PDF to Markdown.",
    };
  }
}

/**
 * Assembles items into a single line string, embedding markdown links where present
 */
function assembleLineText(items: TextItemInfo[]): string {
  const parts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let str = item.str;

    if (item.linkUrl) {
      str = `[${str}](${item.linkUrl})`;
    }

    parts.push(str);
  }
  return parts.join(" ").replace(/\s{2,}/g, " ");
}

/**
 * Cleans heading text formatting
 */
function cleanHeadingText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Merges multi-line paragraph items and resolves split hyphenations
 */
function assembleParagraph(lines: string[]): string {
  let result = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (result.endsWith("-") && !result.endsWith(" -")) {
      // De-hyphenate word split across lines (e.g. "document-\nprocessing" -> "document-processing")
      result = result.slice(0, -1) + line;
    } else if (result.length > 0) {
      result += " " + line;
    } else {
      result = line;
    }
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

/**
 * Attempts to detect and extract a tabular structure starting at lines[startIndex]
 */
function tryExtractTable(
  lines: LineInfo[],
  startIndex: number
): { markdown: string; nextIndex: number } | null {
  const startLine = lines[startIndex];
  if (!startLine || !startLine.items || startLine.items.length < 2) {
    // Check if single line has pipe delimiter
    if (startLine && startLine.text.includes("|") && startLine.text.split("|").length >= 3) {
      const tableLines: string[] = [startLine.text];
      let k = startIndex + 1;
      while (k < lines.length && lines[k].text.includes("|")) {
        tableLines.push(lines[k].text);
        k++;
      }
      if (tableLines.length >= 2) {
        return formatPipedTable(tableLines, k);
      }
    }
    return null;
  }

  // Check multi-item column alignment across consecutive lines
  const potentialRows: string[][] = [];
  let currIdx = startIndex;

  while (currIdx < lines.length) {
    const line = lines[currIdx];
    const items = line.items.filter((item) => item.str.trim().length > 0);

    if (items.length >= 2 && items.length <= 8) {
      potentialRows.push(items.map((i) => i.str.trim()));
      currIdx++;
    } else {
      break;
    }
  }

  // Need at least 2 rows and consistent column counts to qualify as table
  if (potentialRows.length >= 2) {
    const colCount = Math.max(...potentialRows.map((r) => r.length));
    if (colCount >= 2 && colCount <= 8) {
      const headerRow = potentialRows[0];
      while (headerRow.length < colCount) headerRow.push("");

      const headerMd = `| ${headerRow.join(" | ")} |`;
      const sepMd = `| ${Array(colCount).fill("---").join(" | ")} |`;
      const dataRowsMd = potentialRows.slice(1).map((row) => {
        while (row.length < colCount) row.push("");
        return `| ${row.join(" | ")} |`;
      });

      const tableMd = [headerMd, sepMd, ...dataRowsMd].join("\n");
      return {
        markdown: tableMd,
        nextIndex: currIdx,
      };
    }
  }

  return null;
}

function formatPipedTable(rawPipedLines: string[], nextIndex: number) {
  const rows = rawPipedLines.map((l) =>
    l
      .split("|")
      .map((c) => c.trim())
      .filter((c, idx, arr) => (idx > 0 && idx < arr.length - 1) || c.length > 0)
  );

  const colCount = Math.max(...rows.map((r) => r.length));
  if (colCount < 2) return null;

  const header = rows[0];
  while (header.length < colCount) header.push("");
  const headerMd = `| ${header.join(" | ")} |`;
  const sepMd = `| ${Array(colCount).fill("---").join(" | ")} |`;
  const dataMd = rows.slice(1).map((r) => {
    while (r.length < colCount) r.push("");
    return `| ${r.join(" | ")} |`;
  });

  return {
    markdown: [headerMd, sepMd, ...dataMd].join("\n"),
    nextIndex,
  };
}
