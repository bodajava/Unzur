import { Controller, ForbiddenException, Headers, HttpCode, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../../common/decorators/index.js';
import { AUTOMATION_JOBS, AutomationService, type AutomationJob } from './automation.service.js';

/**
 * Lets an external scheduler run the jobs (shared hosting doesn't guarantee
 * in-process timers). Protected by CRON_SECRET in the x-cron-secret header:
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://api.example.com/api/v1/automation/run/expire-unpaid
 */
@Controller('automation')
export class AutomationController {
  private readonly secret: string;

  constructor(
    private readonly automation: AutomationService,
    config: ConfigService,
  ) {
    this.secret = config.get<string>('CRON_SECRET') ?? '';
  }

  @Public()
  @Post('run/:job')
  @HttpCode(HttpStatus.OK)
  run(@Param('job') job: string, @Headers('x-cron-secret') given?: string) {
    if (!this.authorized(given)) throw new ForbiddenException('Invalid cron secret');
    if (!(AUTOMATION_JOBS as readonly string[]).includes(job)) throw new NotFoundException('Unknown job');
    return this.automation.runNow(job as AutomationJob);
  }

  /** Off unless CRON_SECRET is set (≥ 24 chars); constant-time compare. */
  private authorized(given?: string): boolean {
    if (this.secret.length < 24 || !given) return false;
    const a = Buffer.from(given);
    const b = Buffer.from(this.secret);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
