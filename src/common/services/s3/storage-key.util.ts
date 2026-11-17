import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { sniffImage } from '../../utilities/multer/multer.config.js';

/** Keeps [a-zA-Z0-9/_-], collapses "//", trims slashes. Empty -> "general". */
export function sanitizeFolder(folder?: string): string {
  const clean = (folder ?? '')
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '');
  return clean || 'general';
}

/**
 * Verifies the bytes are a real image and builds a fresh key:
 * `${folder}/${Date.now()}-${uuid}${ext}`. The client's file name is never used.
 */
export function prepareImageUpload(file: Express.Multer.File, folder?: string) {
  const kind = sniffImage(file?.buffer);
  if (!kind) {
    throw new BadRequestException('File is not a valid image (allowed: JPEG, PNG, WebP, AVIF)');
  }
  const key = `${sanitizeFolder(folder)}/${Date.now()}-${randomUUID()}${kind.ext}`;
  return { key, kind };
}
