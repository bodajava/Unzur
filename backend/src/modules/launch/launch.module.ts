import { Module } from '@nestjs/common';
import { LaunchResetService } from './launch-reset.service.js';

/** One-time launch reset (see LaunchResetService). */
@Module({ providers: [LaunchResetService] })
export class LaunchModule {}
