/**
 * Helper utilities for client-side Image processing (Crop, Rotate, Flip, Resize, Compress, Format Conversion)
 */

export interface ImageCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageResizeDimensions {
  width: number;
  height: number;
  maintainAspectRatio?: boolean;
}

export interface ImageCompressOptions {
  quality: number; // 0.1 to 1.0
  format: "image/jpeg" | "image/png" | "image/webp";
}

/**
 * Loads a File or Data URL into an HTMLImageElement
 */
export function loadImageElement(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Failed to load image element."));

    if (typeof src === "string") {
      img.src = src;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(src);
    }
  });
}

/**
 * Crops an image to specific bounding box coordinates
 */
export async function cropImage(
  imageSource: string | File,
  cropRect: ImageCropRect
): Promise<string> {
  const img = await loadImageElement(imageSource);
  const canvas = document.createElement("canvas");
  canvas.width = cropRect.width;
  canvas.height = cropRect.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Could not get 2d canvas context for cropping.");

  ctx.drawImage(
    img,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height
  );

  return canvas.toDataURL("image/png");
}

/**
 * Rotates an image by 90, 180, or 270 degrees
 */
export async function rotateImage(
  imageSource: string | File,
  degrees: 90 | 180 | 270
): Promise<string> {
  const img = await loadImageElement(imageSource);
  const canvas = document.createElement("canvas");

  if (degrees === 90 || degrees === 270) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d canvas context for rotation.");

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  return canvas.toDataURL("image/png");
}

/**
 * Flips an image horizontally or vertically
 */
export async function flipImage(
  imageSource: string | File,
  direction: "horizontal" | "vertical"
): Promise<string> {
  const img = await loadImageElement(imageSource);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Could not get 2d canvas context for flipping.");

  ctx.translate(
    direction === "horizontal" ? canvas.width : 0,
    direction === "vertical" ? canvas.height : 0
  );
  ctx.scale(
    direction === "horizontal" ? -1 : 1,
    direction === "vertical" ? -1 : 1
  );
  ctx.drawImage(img, 0, 0);

  return canvas.toDataURL("image/png");
}

/**
 * Resizes an image to specified width and height
 */
export async function resizeImage(
  imageSource: string | File,
  dims: ImageResizeDimensions
): Promise<string> {
  const img = await loadImageElement(imageSource);
  const canvas = document.createElement("canvas");
  canvas.width = dims.width;
  canvas.height = dims.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d canvas context for resizing.");

  ctx.drawImage(img, 0, 0, dims.width, dims.height);
  return canvas.toDataURL("image/png");
}

/**
 * Converts image format (PNG, JPG, WEBP)
 */
export async function convertImageFormat(
  imageSource: string | File,
  targetFormat: "png" | "jpeg" | "webp",
  quality = 0.92
): Promise<Blob> {
  const img = await loadImageElement(imageSource);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d canvas context for format conversion.");

  if (targetFormat === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const mimeType = `image/${targetFormat}`;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export converted image blob."));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Compresses an image client-side and calculates exact before/after file size stats
 */
export async function compressImage(
  file: File,
  quality: number,
  outputFormat: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<{
  blob: Blob;
  dataUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savedPercentage: number;
}> {
  const originalSizeBytes = file.size;
  const img = await loadImageElement(file);

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d canvas context for image compression.");

  if (outputFormat === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Compression failed to yield image blob."));
      },
      outputFormat,
      quality
    );
  });

  const compressedSizeBytes = blob.size;
  const savedPercentage = Math.max(
    0,
    parseFloat((((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100).toFixed(1))
  );

  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  return {
    blob,
    dataUrl,
    originalSizeBytes,
    compressedSizeBytes,
    savedPercentage,
  };
}

/**
 * Converts SVG markup string to PNG or JPG blob
 */
export async function svgToImage(
  svgString: string,
  format: "png" | "jpeg" = "png"
): Promise<Blob> {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = await loadImageElement(url);
  const canvas = document.createElement("canvas");
  canvas.width = img.width || 800;
  canvas.height = img.height || 600;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context for SVG conversion.");

  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to render SVG to image blob."));
    }, `image/${format}`);
  });
}

/**
 * Downloads a Blob or DataURL image without opening browser viewer tabs
 */
export function downloadImageBlob(blobOrUrl: Blob | string, filename: string) {
  let url: string;
  let isCreated = false;

  if (typeof blobOrUrl === "string") {
    url = blobOrUrl;
  } else {
    url = URL.createObjectURL(blobOrUrl);
    isCreated = true;
  }

  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", filename);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (isCreated) {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
