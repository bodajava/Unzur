import { Controller, Get, Query, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AppRequest } from '../../common/interfaces/request.interface.js';
import { requestMeta } from '../../common/utilities/request-meta.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsRangeDto, ProductsPerformanceDto, SalesTrendDto } from './dto/index.js';

@Controller('admin/analytics')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** 8.1 */
  @Get('overview')
  overview(@Query() range: AnalyticsRangeDto) {
    return this.analytics.overview(range);
  }

  /** 8.2 */
  @Get('sales-trend')
  salesTrend(@Query() dto: SalesTrendDto) {
    return this.analytics.salesTrend(dto);
  }

  /** 8.3 */
  @Get('products-performance')
  productsPerformance(@Query() dto: ProductsPerformanceDto) {
    return this.analytics.productsPerformance(dto);
  }

  /** 8.3b: where the orders come from and how they're paid */
  @Get('breakdown')
  breakdown(@Query() range: AnalyticsRangeDto) {
    return this.analytics.breakdown(range);
  }

  /** 8.4 */
  @Get('customers')
  customers(@Query() range: AnalyticsRangeDto) {
    return this.analytics.customers(range);
  }

  /** 8.5 */
  @Get('insights')
  insights(@Query() range: AnalyticsRangeDto, @Req() req: AppRequest) {
    return this.analytics.insights(range, requestMeta(req).lang);
  }
}
