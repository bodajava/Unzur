import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

/**
 * Which proxies may set X-Forwarded-For. Default: the one proxy in front of
 * the app. TRUSTED_PROXIES (comma-separated IPs, or loopback/linklocal/
 * uniquelocal) is for when the storefront proxies /api/v1 to us, so the
 * visitor's real IP (rate limits, audit log) survives the extra hop.
 */
function trustProxy(): number | string[] {
  const list = process.env.TRUSTED_PROXIES?.split(',').map((s) => s.trim()).filter(Boolean);
  return list?.length ? ['loopback', 'linklocal', 'uniquelocal', ...list] : 1;
}

async function bootstrap() {
  // rawBody: webhook signatures (WhatsApp X-Hub-Signature-256) are computed over the exact bytes.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.set('trust proxy', trustProxy()); // correct req.ip behind reverse proxies
  configureApp(app);
  await app.listen(process.env.PORT ?? 4000);
}

// No top-level await: Hostinger's LiteSpeed runner loads this file with
// require(), which refuses an ES module graph that awaits at the top level.
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
