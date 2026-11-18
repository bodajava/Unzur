import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GuestSessionService } from '../../services/guest/guest-session.service.js';
import { NewsletterTokenService } from '../../services/security/newsletter-token.service.js';
import { MxValidatorService } from '../../services/mx/mx-validator.service.js';
import { NotificationService } from '../../services/notification/notification.service.js';
import { RateLimitService } from '../../services/rate-limit/rate-limit.service.js';
import { ConfigService } from '@nestjs/config';
import { StorageDriver } from '../../enums/storage-driver.enum.js';
import { BlobStorageService } from '../../services/s3/blob-storage.service.js';
import { LocalStorageService } from '../../services/s3/local-storage.service.js';
import { StorageService } from '../../services/s3/storage.service.js';
import { EncryptionService } from '../../services/security/encryption.service.js';
import { HashService } from '../../services/security/hash.service.js';
import { RandomService } from '../../services/security/random.service.js';
import { SecurityService } from '../../services/security/security.service.js';
import { TokenService } from '../../services/token/token.service.js';
import { CacheService } from '../../utilities/caching/cache.service.js';
import { RedisService } from '../../utilities/caching/redis.service.js';
import { EmailService } from '../../utilities/email/email.service.js';

const SHARED_SERVICES = [
  // security
  HashService,
  EncryptionService,
  RandomService,
  SecurityService,
  // token
  TokenService,
  // infra
  RedisService,
  CacheService,
  RateLimitService,
  EmailService,
  NotificationService,
  GuestSessionService,
  MxValidatorService,
  NewsletterTokenService,
];

/** STORAGE_DRIVER=local (default, VPS disk) | blob (Vercel Blob). */
const STORAGE_PROVIDER = {
  provide: StorageService,
  inject: [ConfigService],
  useFactory: (config: ConfigService): StorageService => {
    const driver = (config.get<string>('STORAGE_DRIVER') || StorageDriver.LOCAL).toLowerCase();
    if (driver === StorageDriver.BLOB) return new BlobStorageService(config);
    return new LocalStorageService(config);
  },
};

/** Every common service, available app-wide without importing anything. */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [...SHARED_SERVICES, STORAGE_PROVIDER],
  exports: [...SHARED_SERVICES, StorageService],
})
export class SharedModule {}
