import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { memoryStorage } from 'multer';

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface MulterMemoryOptions {
  allowedMimeTypes?: readonly string[];
  maxFileSizeBytes?: number;
  /** Max files per request (multer `limits.files`). */
  maxFiles?: number;
}

/**
 * Files stay in memory (never in a temp folder) and go straight to the
 * storage driver. This first check uses the client's declared MIME type;
 * drivers then verify the real bytes with sniffImage().
 */
export function createMulterMemoryOptions(opts: MulterMemoryOptions = {}): MulterOptions {
  const allowed = opts.allowedMimeTypes ?? IMAGE_MIME_TYPES;
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: opts.maxFileSizeBytes ?? MAX_IMAGE_SIZE_BYTES,
      ...(opts.maxFiles ? { files: opts.maxFiles } : {}),
    },
    fileFilter: (_req, file, cb) => {
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`Unsupported file type. Allowed: ${allowed.join(', ')}`), false);
      }
    },
  };
}

const ascii = (buffer: Buffer, start: number, end: number) => buffer.subarray(start, end).toString('latin1');

/**
 * Real image type from the first bytes (magic numbers). Anything else,
 * SVG included (it can carry scripts), returns null.
 */
export function sniffImage(buffer: Buffer | undefined): { mime: string; ext: string } | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }
  const brand = ascii(buffer, 4, 12);
  if (brand === 'ftypavif' || brand === 'ftypavis') {
    return { mime: 'image/avif', ext: '.avif' };
  }
  return null;
}
