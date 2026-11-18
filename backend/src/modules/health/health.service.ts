import { Injectable } from '@nestjs/common';
import { RedisService } from '../../common/utilities/caching/redis.service.js';
import { SystemRepository } from '../../models/repositories/system.repository.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly system: SystemRepository,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const [db, cache] = await Promise.allSettled([this.system.ping(), this.redis.ping()]);
    return {
      database: db.status === 'fulfilled' ? 'up' : 'down',
      redis: cache.status === 'fulfilled' ? 'up' : 'down',
    };
  }
}
