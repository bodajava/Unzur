import { Injectable, Logger } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';
import { CacheService } from '../../utilities/caching/cache.service.js';

const TIMEOUT_MS = 3000;
const CACHE_TTL_SEC = 24 * 60 * 60;
/** DNS answers that mean "this domain cannot receive mail". */
const NO_MAIL_CODES = new Set(['ENOTFOUND', 'ENODATA', 'ENOTIMP', 'EBADNAME']);

export type MxResult = 'valid' | 'invalid' | 'unknown';

/**
 * Checks that an email domain has MX records (7.1). Answers are cached for a
 * day. Timeouts and DNS server errors give 'unknown', which callers accept
 * (a slow resolver must not block real subscribers).
 */
@Injectable()
export class MxValidatorService {
  private readonly logger = new Logger(MxValidatorService.name);

  constructor(private readonly cache: CacheService) {}

  async check(email: string): Promise<MxResult> {
    const domain = email.split('@')[1]?.trim().toLowerCase();
    if (!domain || !domain.includes('.')) return 'invalid';

    const cached = await this.cache.get<MxResult>(`mx:${domain}`);
    if (cached) return cached;

    const result = await this.lookup(domain);
    if (result !== 'unknown') await this.cache.set(`mx:${domain}`, result, CACHE_TTL_SEC);
    return result;
  }

  private async lookup(domain: string): Promise<MxResult> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), TIMEOUT_MS);
    });
    try {
      const answer = await Promise.race([resolveMx(domain), timeout]);
      if (answer === 'timeout') {
        this.logger.warn(`MX lookup for ${domain} timed out`);
        return 'unknown';
      }
      return answer.some((r) => r.exchange && r.exchange !== '.') ? 'valid' : 'invalid';
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (NO_MAIL_CODES.has(code)) return 'invalid';
      this.logger.warn(`MX lookup for ${domain} failed: ${code}`);
      return 'unknown';
    } finally {
      clearTimeout(timer);
    }
  }
}
