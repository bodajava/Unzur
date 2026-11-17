/** npm run seed — runs every seeder once (insert-only) and exits. */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { SeederService } from './seeder.service.js';

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['log', 'warn', 'error'],
});
await app.get(SeederService).runAll();
await app.close();
