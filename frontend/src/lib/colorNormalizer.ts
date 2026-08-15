/**
 * CSS Color Normalization Utility
 * Normalizes modern CSS color functions (oklch, oklab, color(), hwb(), color-mix())
 * to standard RGB/RGBA/HEX formats supported by html2canvas and PDF rendering engines.
 */

let colorCanvasCtx: CanvasRenderingContext2D | null = null;

function getColorContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!colorCanvasCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorCanvasCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  return colorCanvasCtx;
}

/**
 * Converts any valid browser CSS color string into standard #rrggbb or rgba(...)
 */
export function cssColorToRgb(colorStr: string): string {
  if (!colorStr) return colorStr;
  const trimmed = colorStr.trim();
  if (
    trimmed === "" ||
    trimmed === "transparent" ||
    trimmed === "inherit" ||
    trimmed === "initial" ||
    trimmed === "unset" ||
    trimmed === "currentColor" ||
    trimmed === "none"
  ) {
    return trimmed;
  }

  // Fast path for standard hex or basic rgb
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return trimmed;
  }

  const ctx = getColorContext();
  if (!ctx) return trimmed;

  try {
    ctx.fillStyle = "#000000"; // reset
    ctx.fillStyle = trimmed;
    return ctx.fillStyle; // Browser parses any modern color space (oklch, etc.) into #rrggbb or rgba()
  } catch {
    return trimmed;
  }
}

/**
 * Replaces modern unsupported CSS color functions (oklch, oklab, color(), hwb(), color-mix())
 * inside any CSS string or stylesheet content with standard browser RGB/HEX colors.
 */
export function sanitizeAllCssColors(cssText: string): string {
  if (!cssText) return "";

  return cssText
    .replace(/oklch\([^)]+\)/gi, (match) => cssColorToRgb(match))
    .replace(/oklab\([^)]+\)/gi, (match) => cssColorToRgb(match))
    .replace(/color-mix\([^)]+\)/gi, (match) => cssColorToRgb(match))
    .replace(/color\([^)]+\)/gi, (match) => cssColorToRgb(match))
    .replace(/hwb\([^)]+\)/gi, (match) => cssColorToRgb(match));
}

/**
 * Prepares and normalizes a cloned DOM tree before html2canvas rendering
 */
export function prepareDomForHtml2Canvas(clonedDoc: Document, clonedEl: HTMLElement): void {
  // 1. Sanitize all <style> tags in clonedDoc
  const styles = clonedDoc.querySelectorAll("style");
  styles.forEach((style) => {
    try {
      if (style.textContent && /oklch|oklab|color-mix|color\(|hwb\(/i.test(style.textContent)) {
        style.textContent = sanitizeAllCssColors(style.textContent);
      }
    } catch (e) {
      console.warn("Could not sanitize style tag:", e);
    }
  });

  // 2. Sanitize all elements in clonedEl
  const elements = [clonedEl, ...Array.from(clonedEl.querySelectorAll("*"))];
  const colorProperties = [
    "color",
    "background-color",
    "border-color",
    "border-top-color",
    "border-bottom-color",
    "border-left-color",
    "border-right-color",
    "outline-color",
    "text-decoration-color",
    "fill",
    "stroke",
  ];

  elements.forEach((node) => {
    if (node instanceof HTMLElement) {
      // Inline styles
      const inlineStyle = node.getAttribute("style");
      if (inlineStyle && /oklch|oklab|color-mix|color\(|hwb\(/i.test(inlineStyle)) {
        node.setAttribute("style", sanitizeAllCssColors(inlineStyle));
      }

      // Computed styles
      try {
        const computed = window.getComputedStyle(node);
        for (const prop of colorProperties) {
          const val = computed.getPropertyValue(prop);
          if (val && /oklch|oklab|color-mix|color\(|hwb\(/i.test(val)) {
            const normalized = cssColorToRgb(val);
            node.style.setProperty(prop, normalized, "important");
          }
        }
      } catch {
        // Disconnected node fallback
      }
    }
  });
}
