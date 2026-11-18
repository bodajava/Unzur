import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  // rawBody: webhook signatures (WhatsApp X-Hub-Signature-256) are computed over the exact bytes.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.set('trust proxy', 1); // correct req.ip behind Vercel/reverse proxies
  configureApp(app);
  await app.listen(process.env.PORT ?? 4000);
}

// No top-level await: Hostinger's LiteSpeed runner loads this file with
// require(), which refuses an ES module graph that awaits at the top level.
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
