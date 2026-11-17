import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { parseSortParam, buildPaginationMeta } from './dto/pagination-query.dto.js';
import { LocalStorageService } from './services/s3/local-storage.service.js';
import { sanitizeFolder } from './services/s3/storage-key.util.js';
import { sniffImage } from './utilities/multer/multer.config.js';
import { EncryptionService } from './services/security/encryption.service.js';
import { slugify } from './utilities/slug/slug.js';
import { Regex } from './utilities/regex/regex.js';

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('common', () => {
  it('slugify keeps Arabic and normalizes Latin', () => {
    expect(slugify('قهوة عربية  Arabic Coffee!')).toBe('قهوة-عربية-arabic-coffee');
    expect(slugify('  Café  Crème ')).toBe('cafe-creme');
  });

  it('encryption round-trips and detects tampering', () => {
    const enc = new EncryptionService(new ConfigService({ ENCRYPTION_KEY: 'k' }));
    const cipher = enc.encrypt('secret value');
    expect(cipher).not.toContain('secret');
    expect(enc.decrypt(cipher)).toBe('secret value');
    const tampered = Buffer.from(cipher, 'base64');
    tampered[tampered.length - 1] ^= 1;
    expect(() => enc.decrypt(tampered.toString('base64'))).toThrow();
  });

  it('local storage: sniffed type, generated key, no traversal, delete by key or URL', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'uploads-'));
    const storage = new LocalStorageService(
      new ConfigService({ UPLOAD_DIR: dir, UPLOADS_PUBLIC_URL: 'http://localhost:4000/uploads/' }),
    );
    const png = { buffer: PNG, size: PNG.length, originalname: '../../evil.svg', mimetype: 'image/png' } as Express.Multer.File;

    const stored = await storage.uploadFile(png, '../products//2026/');
    expect(stored).toMatchObject({ bucket: 'local', mimeType: 'image/png', size: PNG.length });
    expect(stored.key).toMatch(/^products\/2026\/\d{13}-[0-9a-f-]{36}\.png$/); // name never comes from the client
    expect(stored.url).toBe(`http://localhost:4000/uploads/${stored.key}`);
    expect(await readFile(join(dir, stored.key))).toEqual(PNG);
    expect(await storage.getPresignedUrl(stored.key)).toBe(stored.url);
    expect(storage.keyFromUrl(stored.url)).toBe(stored.key);

    // bytes decide, not the declared MIME type
    const fake = { ...png, buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>') };
    await expect(storage.uploadFile(fake, 'x')).rejects.toThrow('not a valid image');
    await expect(storage.uploadFiles([png, fake], 'x')).rejects.toThrow('File #2');

    await expect(storage.deleteFile('../outside.txt')).rejects.toThrow('Invalid storage key');
    await expect(storage.deleteFile('products/../../outside.txt')).rejects.toThrow('Invalid storage key');
    expect(await storage.deleteFile(stored.key)).toBe(true);
    expect(await storage.deleteFile(stored.key)).toBe(false); // ENOENT
    await rm(dir, { recursive: true, force: true });
  });

  it('sniffImage reads magic bytes and rejects everything else', () => {
    const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);
    expect(sniffImage(pad([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ mime: 'image/jpeg', ext: '.jpg' });
    expect(sniffImage(PNG)).toEqual({ mime: 'image/png', ext: '.png' });
    expect(sniffImage(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'latin1'))).toEqual({ mime: 'image/webp', ext: '.webp' });
    expect(sniffImage(Buffer.from('\x00\x00\x00\x1cftypavif0000', 'latin1'))).toEqual({ mime: 'image/avif', ext: '.avif' });
    expect(sniffImage(Buffer.from('\x00\x00\x00\x1cftypavis0000', 'latin1'))?.mime).toBe('image/avif');
    expect(sniffImage(Buffer.from('<?xml version="1.0"?><svg></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImage(Buffer.from([0xff, 0xd8]))).toBeNull(); // too short
    expect(sanitizeFolder(' ../a b//c?/ ')).toBe('ab/c');
    expect(sanitizeFolder('///')).toBe('general');
  });

  it('pagination helpers', () => {
    expect(parseSortParam('-createdAt,name,passwordHash', ['createdAt', 'name'])).toEqual([
      { createdAt: 'desc' },
      { name: 'asc' },
    ]);
    expect(buildPaginationMeta(45, 2, 20)).toMatchObject({ totalPages: 3, hasNextPage: true });
  });

  it('phone regex accepts Egyptian and international numbers', () => {
    expect(Regex.PHONE.test('01012345678')).toBe(true);
    expect(Regex.PHONE.test('+201012345678')).toBe(true);
    expect(Regex.PHONE.test('12')).toBe(false);
  });
});

describe('search tsquery sanitizer', () => {
  it('keeps Arabic and English words and adds prefix matching', async () => {
    const { toPrefixTsQuery } = await import('./utilities/search/tsquery.js');
    expect(toPrefixTsQuery('قهوة Arab')).toBe('قهوة:* & arab:*');
    // tashkeel removed
    expect(toPrefixTsQuery('قَهْوَة')).toBe('قهوة:*');
  });

  it('strips every tsquery operator', async () => {
    const { toPrefixTsQuery, toLikePattern } = await import('./utilities/search/tsquery.js');
    expect(toPrefixTsQuery("coffee & ( | ! :* ' \\ <-> ")).toBe('coffee:*');
    expect(toPrefixTsQuery('&&(( ))')).toBeNull();
    expect(toLikePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });
});

describe('AllExceptionsFilter (GraphQL)', () => {
  it('returns a GraphQLError with code and statusCode instead of writing a response', async () => {
    const { AllExceptionsFilter } = await import('./filters/http-exception.filter.js');
    const { NotFoundException, BadRequestException } = await import('@nestjs/common');
    const host = { getType: () => 'graphql', switchToHttp: () => { throw new Error('no http in graphql'); } } as never;
    const filter = new AllExceptionsFilter();

    const notFound = filter.catch(new NotFoundException('Product not found'), host);
    expect(notFound).toMatchObject({ message: 'Product not found', extensions: { code: 'NOT_FOUND', statusCode: 404 } });

    const invalid = filter.catch(new BadRequestException(['quantity must be an integer']), host);
    expect(invalid).toMatchObject({ extensions: { code: 'BAD_REQUEST', errors: ['quantity must be an integer'] } });

    const crash = filter.catch(new Error('SELECT * FROM secret'), host);
    expect(crash).toMatchObject({ message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } });
  });
});
