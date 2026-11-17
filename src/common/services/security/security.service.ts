import { Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Hashing primitives for tokens/codes (not passwords: see HashService). */
@Injectable()
export class SecurityService {
  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  hmacSha256(secret: string, value: string): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  /** Constant-time comparison of two hex digests. */
  safeEqualHex(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }
}
