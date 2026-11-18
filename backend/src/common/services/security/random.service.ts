import { Injectable } from '@nestjs/common';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';

/** Cryptographically secure random values. */
@Injectable()
export class RandomService {
  uuid(): string {
    return randomUUID();
  }

  /** 6-digit numeric OTP (100000-999999) */
  otp(): string {
    return randomInt(100000, 1000000).toString();
  }

  hex(bytes: number): string {
    return randomBytes(bytes).toString('hex');
  }

  /** guest_<24 hex chars> */
  guestId(): string {
    return `guest_${this.hex(12)}`;
  }

  /** 10 uppercase hex chars, e.g. "9F2A4C01BE" */
  referralCode(): string {
    return this.hex(5).toUpperCase();
  }
}
