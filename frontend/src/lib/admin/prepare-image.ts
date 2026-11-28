import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "./types";

/** Longest side kept for product photos: sharp on any screen, light to download. */
export const MAX_SIDE = 2400;

/** The browser couldn't open the file as a picture (e.g. HEIC outside Safari, a PDF). */
export class UnreadableImageError extends Error {}

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new UnreadableImageError(file.name));
    };
    img.src = url;
  });
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Makes any photo the store can take: phone photos (often 6–12 MB, or HEIC
 * on iPhone) are opened by the browser, scaled down to MAX_SIDE and saved as
 * JPEG (WebP for PNGs, which keeps transparency) under the 5 MB limit.
 * Photos that already fit are returned untouched.
 */
export async function prepareImage(file: File): Promise<File> {
  const img = await load(file);
  const side = Math.max(img.naturalWidth, img.naturalHeight);
  if (IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES && side <= MAX_SIDE) return file;

  const scale = Math.min(1, MAX_SIDE / side);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UnreadableImageError(file.name);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const type = file.type === "image/png" ? "image/webp" : "image/jpeg";
  let blob: Blob | null = null;
  for (const quality of [0.86, 0.78, 0.7, 0.6, 0.5]) {
    blob = await toBlob(canvas, type, quality);
    if (blob && blob.size <= MAX_IMAGE_BYTES) break;
  }
  if (!blob || blob.size > MAX_IMAGE_BYTES) throw new UnreadableImageError(file.name);

  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type, lastModified: Date.now() });
}
