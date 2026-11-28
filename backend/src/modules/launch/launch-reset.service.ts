import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LaunchResetRepository } from '../../models/repositories/launch-reset.repository.js';

/**
 * The store went live: test orders, customers and dashboard data are cleared
 * once, on the first production start after this deploy. Products and
 * marketing (coupons, gift cards, wheel, scrolling text, settings) stay.
 * Everything deleted is first copied to the launch_backup schema. A marker in
 * settings makes it run once per database; it never runs outside production.
 */
export const LAUNCH_RESET_ID = '2026-11-28-launch';

@Injectable()
export class LaunchResetService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LaunchResetService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly reset: LaunchResetRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') !== 'production') return;
    try {
      const result = await this.reset.runOnce(LAUNCH_RESET_ID);
      if (result.ran) this.logger.warn(`Launch reset done (backup in launch_backup): ${JSON.stringify(result.counts)}`);
      else this.logger.log(`Launch reset skipped: ${result.reason}`);
    } catch (error) {
      // Rolled back as a whole; the store keeps running.
      this.logger.error(`Launch reset failed, nothing was deleted: ${(error as Error).message}`);
    }
  }
}
