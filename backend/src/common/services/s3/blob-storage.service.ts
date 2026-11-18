import { del, head, put } from '@vercel/blob';
import { ConfigService } from '@nestjs/config';
import type { IUploadedFileResult } from '../../interfaces/storage.interface.js';
import { prepareImageUpload } from './storage-key.util.js';
import { StorageService } from './storage.service.js';

const ONE_YEAR_SEC = 31_536_000;

/** Vercel Blob (public store). Keys are blob pathnames. */
export class BlobStorageService extends StorageService {
  readonly bucket = 'blob';
  private readonly token: string;

  constructor(config: ConfigService) {
    super();
    this.token = config.getOrThrow<string>('BLOB_READ_WRITE_TOKEN');
  }

  async uploadFile(file: Express.Multer.File, folder?: string): Promise<IUploadedFileResult> {
    const { key, kind } = prepareImageUpload(file, folder);
    const blob = await put(key, file.buffer, {
      access: 'public',
      contentType: kind.mime,
      addRandomSuffix: false,
      cacheControlMaxAge: ONE_YEAR_SEC,
      token: this.token,
    });
    return { key: blob.pathname, url: blob.url, bucket: this.bucket, mimeType: kind.mime, size: file.size };
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      await del(key, { token: this.token });
      return true;
    } catch (error) {
      this.logger.warn(`Blob delete failed for ${key}: ${(error as Error).message}`);
      return false;
    }
  }

  async getPresignedUrl(key: string): Promise<string> {
    return (await head(key, { token: this.token })).url;
  }

  keyFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith('.blob.vercel-storage.com')) return null;
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    } catch {
      return null;
    }
  }
}
