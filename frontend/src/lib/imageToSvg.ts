import ImageTracer from "imagetracerjs";

export interface ImageToSvgOptions {
  numberOfColors?: number;
  scale?: number;
  simplifyTolerance?: number;
}

/**
 * Converts a PNG or JPG/JPEG File into valid SVG string markup client-side using vector path tracing
 */
export async function convertImageToSvg(
  file: File,
  customOptions?: ImageToSvgOptions
): Promise<string> {
  if (!file) {
    throw new Error("No image file selected.");
  }

  const validTypes = ["image/png", "image/jpeg", "image/jpg"];
  const isExtensionValid = /\.(png|jpe?g)$/i.test(file.name);

  if (!validTypes.includes(file.type.toLowerCase()) && !isExtensionValid) {
    throw new Error("Invalid file format. Please select a valid PNG or JPG/JPEG image.");
  }

  if (file.size === 0) {
    throw new Error("Selected file is empty.");
  }

  // Load File into Data URL string
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image content."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });

  const options = {
    corsenabled: false,
    ltrsyntax: false,
    numberofcolors: customOptions?.numberOfColors || 16,
    mincolorratio: 0.02,
    colorquantcycles: 3,
    scale: customOptions?.scale || 1,
    strokewidth: 1,
    linefilter: true,
  };

  return new Promise<string>((resolve, reject) => {
    try {
      ImageTracer.imageToSVG(
        dataUrl,
        (svgString: string) => {
          if (!svgString || typeof svgString !== "string" || !svgString.includes("<svg")) {
            reject(new Error("Failed to generate valid SVG markup."));
          } else {
            resolve(svgString);
          }
        },
        options
      );
    } catch (err: any) {
      console.error("Vector tracing error:", err);
      reject(new Error(err?.message || "Error occurred during image to SVG conversion."));
    }
  });
}

/**
 * Downloads raw SVG markup as a .svg file without opening built-in browser tabs
 */
export function downloadSvgString(svgContent: string, filename: string) {
  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const cleanFilename = filename.replace(/\.(png|jpe?g|pdf)$/i, "") + ".svg";
  a.setAttribute("download", cleanFilename);
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
