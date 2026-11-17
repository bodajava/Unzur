import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
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

  /** 8.4 */
  @Get('customers')
  customers(@Query() range: AnalyticsRangeDto) {
    return this.analytics.customers(range);
  }

  /** 8.5 */
  @Get('insights')
  insights(@Query() range: AnalyticsRangeDto) {
    return this.analytics.insights(range);
  }
}
