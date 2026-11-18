import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IUploadedFileResult } from '../../interfaces/storage.interface.js';
import { prepareImageUpload } from './storage-key.util.js';
import { StorageService } from './storage.service.js';

/**
 * Files on the server's disk (VPS). UPLOAD_DIR should be a persistent folder
 * outside the app (e.g. /var/www/store-uploads). Served at /uploads by the app
 * or directly by nginx; UPLOADS_PUBLIC_URL is the URL prefix clients see.
 */
export class LocalStorageService extends StorageService {
  readonly bucket = 'local';
  readonly root: string;
  readonly publicBase: string;

  constructor(config: ConfigService) {
    super();
    this.root = resolve(config.get<string>('UPLOAD_DIR') || resolve(process.cwd(), 'uploads'));
    this.publicBase = (config.get<string>('UPLOADS_PUBLIC_URL') || '/uploads').replace(/\/+$/, '');
  }

  async uploadFile(file: Express.Multer.File, folder?: string): Promise<IUploadedFileResult> {
    const { key, kind } = prepareImageUpload(file, folder);
    const target = this.safePath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.buffer, { flag: 'wx' }); // never overwrite
    return { key, url: `${this.publicBase}/${key}`, bucket: this.bucket, mimeType: kind.mime, size: file.size };
  }

  async deleteFile(key: string): Promise<boolean> {
    const target = this.safePath(key);
    try {
      await unlink(target);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  getPresignedUrl(key: string): Promise<string> {
    this.safePath(key);
    return Promise.resolve(`${this.publicBase}/${key}`);
  }

  keyFromUrl(url: string): string | null {
    const prefix = `${this.publicBase}/`;
    return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
  }

  /** Path-traversal guard: the resolved path must stay inside UPLOAD_DIR. */
  private safePath(key: string): string {
    const target = resolve(this.root, key);
    if (!target.startsWith(this.root + sep)) throw new BadRequestException('Invalid storage key');
    return target;
  }
}
