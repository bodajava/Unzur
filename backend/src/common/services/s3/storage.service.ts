import { BadRequestException, Logger } from '@nestjs/common';
import type { IStorageService, IUploadedFileResult } from '../../interfaces/storage.interface.js';
import { sniffImage } from '../../utilities/multer/multer.config.js';

/**
 * DI token and base class for storage drivers (STORAGE_DRIVER=local|blob,
 * chosen in SharedModule). Inject it as `private readonly storage: StorageService`.
 */
export abstract class StorageService implements IStorageService {
  protected readonly logger = new Logger(StorageService.name);
  abstract readonly bucket: string;

  abstract uploadFile(file: Express.Multer.File, folder?: string): Promise<IUploadedFileResult>;
  abstract deleteFile(key: string): Promise<boolean>;
  abstract getPresignedUrl(key: string): Promise<string>;

  /** Storage key for a URL this driver returned earlier, or null if it is not ours. */
  abstract keyFromUrl(url: string): string | null;

  /**
   * All-or-nothing: every file is checked first (nothing is written if one is
   * not an image), and files already stored are removed if a later one fails.
   */
  async uploadFiles(files: Express.Multer.File[], folder?: string): Promise<IUploadedFileResult[]> {
    const invalid = files.findIndex((f) => !sniffImage(f?.buffer));
    if (invalid !== -1) {
      throw new BadRequestException(`File #${invalid + 1} is not a valid image (allowed: JPEG, PNG, WebP, AVIF)`);
    }
    const stored: IUploadedFileResult[] = [];
    try {
      for (const file of files) stored.push(await this.uploadFile(file, folder));
      return stored;
    } catch (error) {
      await this.deleteFiles(stored.map((f) => f.key));
      throw error;
    }
  }

  /** Best-effort cleanup by key or by stored URL; failures are logged, never thrown. */
  async deleteFiles(keysOrUrls: string[]): Promise<void> {
    await Promise.all(
      keysOrUrls.map(async (value) => {
        const key = /^https?:\/\//.test(value) || value.startsWith('/') ? this.keyFromUrl(value) : value;
        if (!key) {
          this.logger.warn(`Not deleting ${value}: not a ${this.bucket} file`);
          return;
        }
        try {
          await this.deleteFile(key);
        } catch (error) {
          this.logger.warn(`Could not delete ${key}: ${(error as Error).message}`);
        }
      }),
    );
  }
}
