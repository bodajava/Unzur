import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

export const BCRYPT_ROUNDS = 12;

/** Password hashing (bcryptjs: pure JS, works on serverless). */
@Injectable()
export class HashService {
  // Compared against when an account does not exist, so login timing
  // does not reveal whether an email is registered.
  private readonly dummyHash = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  compare(plain: string, hash: string | null | undefined): Promise<boolean> {
    return bcrypt.compare(plain, hash ?? this.dummyHash);
  }
}
