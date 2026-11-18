import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloDriver } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { RateLimitGuard } from './common/guards/rate-limit.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { CustomCacheInterceptor } from './common/interceptors/custom-cache.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor.js';
import { SharedModule } from './common/modules/shared/shared.module.js';
import { SeedersModule } from './database/seeders/seeders.module.js';
import { GraphqlConfigService } from './graphql/graphql.config.js';
import { AuthMiddleware } from './middlewares/auth.middleware.js';
import { ModelsModule } from './models/models.module.js';
import { AddressesModule } from './modules/addresses/addresses.module.js';
import { AdminToolsModule } from './modules/admin-tools/admin-tools.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AutomationModule } from './modules/automation/automation.module.js';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ContactModule } from './modules/contact/contact.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { LoyaltyModule } from './modules/loyalty/loyalty.module.js';
import { NewsletterModule } from './modules/newsletter/newsletter.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { WishlistModule } from './modules/wishlist/wishlist.module.js';
import { BrandsModule } from './modules/brands/brands.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { CouponsModule } from './modules/coupons/coupons.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { GiftCardsModule } from './modules/gift-cards/gift-cards.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { ShippingModule } from './modules/shipping/shipping.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useClass: GraphqlConfigService,
    }),
    ModelsModule, // database (Prisma) + repositories
    SharedModule, // common services
    SeedersModule,
    // feature modules
    HealthModule,
    AuthModule,
    CartModule,
    OrdersModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    CouponsModule,
    SettingsModule,
    ShippingModule,
    GiftCardsModule,
    PaymentsModule,
    AddressesModule,
    WishlistModule,
    ReviewsModule,
    NewsletterModule,
    ContactModule,
    NotificationsModule,
    LoyaltyModule,
    AnalyticsModule,
    AiModule,
    AdminToolsModule,
    AutomationModule,
    WhatsAppModule,
  ],
  providers: [
    // Guards run in this order
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Interceptors: first = outermost (cache sits inside the response envelope)
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CustomCacheInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthMiddleware).forRoutes('*path');
  }
}
