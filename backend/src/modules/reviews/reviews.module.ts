import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsResolver } from './reviews.resolver.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsResolver],
})
export class ReviewsModule {}
