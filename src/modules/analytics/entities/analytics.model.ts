import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

/** Money fields: Int piasters. Rates: 0..1. Deltas: % vs the previous period of equal length (null = no data). */

@ObjectType('AnalyticsDeltas')
export class AnalyticsDeltasModel {
  @Field(() => Float, { nullable: true }) revenue: number | null;
  @Field(() => Float, { nullable: true }) orders: number | null;
  @Field(() => Float, { nullable: true }) averageOrderValue: number | null;
  @Field(() => Float, { nullable: true }) customers: number | null;
}

@ObjectType('AnalyticsOverview')
export class AnalyticsOverviewModel {
  @Field() fromDate: Date;
  @Field() toDate: Date;
  @Field(() => Int) totalRevenue: number;
  @Field(() => Int) totalOrders: number;
  @Field(() => Int) averageOrderValue: number;
  @Field(() => Int) totalCustomers: number;
  @Field(() => Int) newCustomers: number;
  @Field(() => Int) returningCustomers: number;
  @Field(() => Int) guestOrdersCount: number;
  /** orders / distinct product-page visitors in the period */
  @Field(() => Float) conversionRate: number;
  @Field(() => Int) visitors: number;
  /** Open orders right now: PENDING_PAYMENT, CONFIRMED, PREPARING */
  @Field(() => Int) pendingOrdersCount: number;
  @Field(() => AnalyticsDeltasModel) deltas: AnalyticsDeltasModel;
}

@ObjectType('SalesTrendPoint')
export class SalesTrendPointModel {
  /** Bucket start, YYYY-MM-DD (Cairo time) */
  @Field() period: string;
  @Field(() => Int) revenue: number;
  @Field(() => Int) ordersCount: number;
  @Field(() => Int) averageOrderValue: number;
}

@ObjectType('ProductPerformance')
export class ProductPerformanceModel {
  @Field(() => ID) productId: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field() slug: string;
  @Field() isActive: boolean;
  @Field(() => Int) viewsCount: number;
  @Field(() => Int) unitsSold: number;
  /** unitsSold / views */
  @Field(() => Float) conversionRate: number;
  @Field(() => Int) revenue: number;
  @Field(() => Int, { nullable: true }) costPrice: number | null;
  @Field(() => Int) currentPrice: number;
  @Field(() => Int, { nullable: true }) estimatedProfit: number | null;
  @Field(() => Float, { nullable: true }) averageRating: number | null;
  @Field(() => Int) reviewCount: number;
  @Field(() => Int) refundCount: number;
  @Field(() => Int) cancellationCount: number;
  @Field(() => Int) stock: number;
  @Field(() => Int) lowStockThreshold: number;
}

@ObjectType('NewVsReturning')
export class NewVsReturningModel {
  @Field(() => Int) newCount: number;
  @Field(() => Int) returningCount: number;
}

@ObjectType('TopCustomer')
export class TopCustomerModel {
  /** user id, or the guest's email */
  @Field() identifier: string;
  @Field() name: string;
  @Field() email: string;
  @Field() isRegistered: boolean;
  @Field(() => Int) ordersCount: number;
  @Field(() => Int) totalSpent: number;
  @Field() lastOrderAt: Date;
}

@ObjectType('CustomerAnalytics')
export class CustomerAnalyticsModel {
  @Field(() => NewVsReturningModel) newVsReturning: NewVsReturningModel;
  /** Customers (all time) with 2+ purchases / all customers */
  @Field(() => Float) repeatPurchaseRate: number;
  @Field(() => [TopCustomerModel]) topCustomers: TopCustomerModel[];
}

@ObjectType('AnalyticsInsight')
export class InsightModel {
  /** HIGH | MEDIUM | INFO */
  @Field() severity: 'HIGH' | 'MEDIUM' | 'INFO';
  /** LOW_CONVERSION | REFUNDS | STOCKOUT_RISK | PROMOTE */
  @Field() category: string;
  @Field() title: string;
  @Field() description: string;
  @Field(() => ID, { nullable: true }) productId: string | null;
  @Field(() => Float) metricValue: number;
}

@ObjectType('BreakdownRow')
export class BreakdownRowModel {
  /** status, payment method, governorate, category name, or weekday 0-6 (Sunday = 0) */
  @Field() key: string;
  @Field(() => Int) orders: number;
  /** Units sold (category rows only; 0 elsewhere) */
  @Field(() => Int) units: number;
  @Field(() => Int) revenue: number;
}

@ObjectType('AnalyticsBreakdown')
export class AnalyticsBreakdownModel {
  /** Every order in the period, any status */
  @Field(() => [BreakdownRowModel]) byStatus: BreakdownRowModel[];
  /** Sales only, from here down */
  @Field(() => [BreakdownRowModel]) byPaymentMethod: BreakdownRowModel[];
  @Field(() => [BreakdownRowModel]) byGovernorate: BreakdownRowModel[];
  @Field(() => [BreakdownRowModel]) byCategory: BreakdownRowModel[];
  @Field(() => [BreakdownRowModel]) byWeekday: BreakdownRowModel[];
}
