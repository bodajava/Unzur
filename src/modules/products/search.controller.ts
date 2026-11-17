import { Controller, Get, Query } from '@nestjs/common';
import { Cache, Public, RateLimit } from '../../common/decorators/index.js';
import { DiscoveryService } from './discovery.service.js';
import { SuggestQueryDto } from './dto/index.js';

@Controller('search')
export class SearchController {
  constructor(private readonly discovery: DiscoveryService) {}

  /** 16.1 Search-as-you-type, max 8 results. Cached 60s for anonymous requests. */
  @Public()
  @RateLimit({ limit: 120, windowSeconds: 60 })
  @Cache(60, 'suggest')
  @Get('suggest')
  suggest(@Query() query: SuggestQueryDto) {
    return this.discovery.suggest(query.q);
  }
}
