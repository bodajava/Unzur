import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { StorageDriver } from './common/enums/storage-driver.enum.js';

/**
 * HTTP pipeline shared by main.ts and e2e tests.
 * Guards, interceptors and the exception filter are registered in AppModule.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api/v1');

  // Security headers (JSON API: CSP not needed for HTML)
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  const origins = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Local storage driver: serve uploaded files
  const driver = process.env.STORAGE_DRIVER || StorageDriver.LOCAL;
  if (driver === StorageDriver.LOCAL) {
    (app as unknown as NestExpressApplication).useStaticAssets(
      resolve(process.env.UPLOAD_DIR || resolve(process.cwd(), 'uploads')),
      { prefix: '/uploads/', index: false, dotfiles: 'deny' },
    );
  }

  app.enableShutdownHooks();
  return app;
}
