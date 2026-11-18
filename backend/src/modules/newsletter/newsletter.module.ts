import { Module } from '@nestjs/common';
import { NewsletterController } from './newsletter.controller.js';
import { NewsletterListener } from './newsletter.listener.js';
import { NewsletterResolver } from './newsletter.resolver.js';
import { NewsletterService } from './newsletter.service.js';

@Module({
  controllers: [NewsletterController],
  providers: [NewsletterService, NewsletterResolver, NewsletterListener],
})
export class NewsletterModule {}
