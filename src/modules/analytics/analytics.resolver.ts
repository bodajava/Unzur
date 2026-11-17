import { Args, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsRangeDto, ProductsPerformanceDto, SalesTrendDto } from './dto/index.js';
import {
  AnalyticsOverviewModel,
  CustomerAnalyticsModel,
  InsightModel,
  ProductPerformanceModel,
  SalesTrendPointModel,
} from './entities/analytics.model.js';

@Resolver()
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
export class AnalyticsResolver {
  constructor(private readonly analytics: AnalyticsService) {}

  @Query(() => AnalyticsOverviewModel, { description: '8.1' })
  analyticsOverview(@Args('range', { type: () => AnalyticsRangeDto, nullable: true }) range?: AnalyticsRangeDto) {
    return this.analytics.overview(range);
  }

  @Query(() => [SalesTrendPointModel], { description: '8.2' })
  analyticsSalesTrend(@Args('input', { type: () => SalesTrendDto, nullable: true }) input?: SalesTrendDto) {
    return this.analytics.salesTrend(input);
  }

  @Query(() => [ProductPerformanceModel], { description: '8.3' })
  analyticsProductsPerformance(
    @Args('input', { type: () => ProductsPerformanceDto, nullable: true }) input?: ProductsPerformanceDto,
  ) {
    return this.analytics.productsPerformance(input);
  }

  @Query(() => CustomerAnalyticsModel, { description: '8.4' })
  analyticsCustomers(@Args('range', { type: () => AnalyticsRangeDto, nullable: true }) range?: AnalyticsRangeDto) {
    return this.analytics.customers(range);
  }

  @Query(() => [InsightModel], { description: '8.5' })
  analyticsInsights(@Args('range', { type: () => AnalyticsRangeDto, nullable: true }) range?: AnalyticsRangeDto) {
    return this.analytics.insights(range);
  }
}
