import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { DiscountType } from '../../common/enums/index.js';
import { RandomService } from '../../common/services/security/random.service.js';
import { RedisService } from '../../common/utilities/caching/redis.service.js';
import { EmailService } from '../../common/utilities/email/email.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { SettingKey } from '../settings/setting-rules.js';
import { SettingsService } from '../settings/settings.service.js';
import { wheelIsLive, type WheelConfig } from '../settings/wheel-config.js';

/** What the storefront may know: no weights, no chosen winners. */
export interface PublicWheel {
  active: boolean;
  campaignId?: string;
  delaySeconds?: number;
  segments?: { label: string; labelAr: string; type: string; value: number }[];
}

export interface SpinResult {
  segment: number;
  /** null when the segment has no prize */
  code: string | null;
  expiresAt: string | null;
  /** true when this email had already spun this round (same result again) */
  repeat: boolean;
}

/** A spin result is kept for the round plus a month. */
const RESULT_TTL_SECONDS = 400 * 24 * 3600;

@Injectable()
export class WheelService {
  private readonly logger = new Logger(WheelService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly redis: RedisService,
    private readonly coupons: CouponsService,
    private readonly random: RandomService,
    private readonly email: EmailService,
  ) {}

  private config(): Promise<WheelConfig | null> {
    return this.settings.getJson<WheelConfig>(SettingKey.SPIN_WHEEL);
  }

  async publicWheel(): Promise<PublicWheel> {
    const c = await this.config();
    if (!wheelIsLive(c)) return { active: false };
    return {
      active: true,
      campaignId: c.campaignId,
      delaySeconds: c.delaySeconds,
      segments: c.segments.map(({ label, labelAr, type, value }) => ({ label, labelAr, type, value })),
    };
  }

  /** One spin per email per round. Chosen winners land where the admin set; everyone else by weight. */
  async spin(rawEmail: string): Promise<SpinResult> {
    const c = await this.config();
    if (!wheelIsLive(c)) throw new NotFoundException('The wheel is not running right now');
    const email = rawEmail.trim().toLowerCase();
    const key = `wheel:${c.campaignId}:${email}`;

    const previous = await this.redis.get<Omit<SpinResult, 'repeat'>>(key);
    if (previous) return { ...previous, repeat: true };
    // Two tabs spinning at once: only the first gets to draw.
    if (!(await this.redis.setIfAbsent(`${key}:lock`, 1, 30))) {
      throw new BadRequestException('Your spin is already in progress');
    }

    const forced = c.winners.find((w) => w.email.trim().toLowerCase() === email);
    const segment = forced ? forced.segment : this.draw(c);
    const prize = c.segments[segment];

    let code: string | null = null;
    let expiresAt: Date | null = null;
    if (prize.type !== 'NONE') {
      expiresAt = new Date(Date.now() + c.couponDays * 24 * 3600 * 1000);
      code = await this.issueCoupon(c, email, prize, expiresAt);
      const amountEn = prize.type === 'PERCENTAGE' ? `${prize.value}% off` : `EGP ${(prize.value / 100).toLocaleString('en')} off`;
      const amountAr = prize.type === 'PERCENTAGE' ? `خصم ${prize.value}%` : `خصم ${(prize.value / 100).toLocaleString('en')} ج.م`;
      this.email
        .sendCouponEmail(email, { code, discount: { en: amountEn, ar: amountAr }, expiresAt })
        .catch((e: unknown) => this.logger.warn(`Wheel coupon email to ${email} failed: ${String(e)}`));
    }

    const result = { segment, code, expiresAt: expiresAt?.toISOString() ?? null };
    await this.redis.set(key, result, RESULT_TTL_SECONDS);
    await this.redis.del(`${key}:lock`);
    return { ...result, repeat: false };
  }

  /** A fresh SPIN-XXXXXX code; retries on the rare clash with an existing code. */
  private async issueCoupon(c: WheelConfig, email: string, prize: WheelConfig['segments'][number], expiresAt: Date): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      const code = `SPIN-${this.random.hex(3).toUpperCase()}`;
      try {
        await this.coupons.issueSingleUse({
          code,
          description: `Prize wheel (${c.campaignId}) for ${email}`,
          discountType: prize.type === 'PERCENTAGE' ? DiscountType.PERCENTAGE : DiscountType.FIXED_AMOUNT,
          discountValue: prize.value,
          minOrderAmount: c.minOrder,
          expiresAt,
        });
        return code;
      } catch (error) {
        if (attempt >= 2) throw error;
      }
    }
  }

  private draw(c: WheelConfig): number {
    const total = c.segments.reduce((sum, s) => sum + s.weight, 0);
    let ticket = randomInt(total);
    for (let i = 0; i < c.segments.length; i++) {
      ticket -= c.segments[i].weight;
      if (ticket < 0) return i;
    }
    return c.segments.length - 1;
  }
}
