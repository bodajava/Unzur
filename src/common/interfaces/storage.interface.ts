/** Result of storing one file. `key` is what deleteFile/getPresignedUrl take. */
export interface IUploadedFileResult {
  key: string;
  url: string;
  /** 'local' | 'blob' */
  bucket: string;
  /** Sniffed from the bytes, not the client's claim */
  mimeType: string;
  size: number;
}

/** Contract every storage driver implements (local disk, Vercel Blob). */
export interface IStorageService {
  uploadFile(file: Express.Multer.File, folder?: string): Promise<IUploadedFileResult>;
  uploadFiles(files: Express.Multer.File[], folder?: string): Promise<IUploadedFileResult[]>;
  /** true when a file was deleted, false when there was nothing to delete */
  deleteFile(key: string): Promise<boolean>;
  /** Public URL for a key (local: `${publicBase}/${key}`, blob: the blob URL). */
  getPresignedUrl(key: string): Promise<string>;
}
