import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentActor, CurrentUser, Public, RateLimit, Roles } from '../../common/decorators/index.js';
import { DEFAULT_LIMIT, MAX_LIMIT } from '../../common/dto/pagination-query.dto.js';
import { UserRole } from '../../common/enums/index.js';
import type { Actor, AuthUser } from '../../common/interfaces/auth.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { CheckoutService } from './checkout.service.js';
import { CancelOrderDto, CheckoutDto, OrderQueryDto } from './dto/index.js';
import {
  AdminOrderDetailModel,
  AdminOrderPageModel,
  CheckoutResultModel,
  CustomerOrderModel,
  CustomerOrderPageModel,
} from './entities/order.model.js';
import { CHECKOUT_LIMIT } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

const STAFF = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] as const;
const clamp = (n: number | undefined, fallback: number, max: number) =>
  Math.min(Math.max(Math.trunc(n ?? fallback), 1), max);

@Resolver(() => CustomerOrderModel)
export class OrdersResolver {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly ordersService: OrdersService,
  ) {}

  @Public()
  @RateLimit(CHECKOUT_LIMIT)
  @Mutation(() => CheckoutResultModel, { description: '4.1 Place an order from the current cart' })
  checkout(@Args('input') input: CheckoutDto, @CurrentActor() actor: Actor) {
    return this.checkoutService.checkout(input, actor);
  }

  @Public()
  @RateLimit({ limit: 20, windowSeconds: 60 })
  @Query(() => CustomerOrderModel, { description: '4.2 Track with the order email or phone' })
  trackOrder(@Args('orderNumber') orderNumber: string, @Args('contact') contact: string) {
    return this.ordersService.track(orderNumber, contact);
  }

  @Query(() => CustomerOrderPageModel, { description: '4.3' })
  myOrders(
    @CurrentUser('id') userId: string,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.ordersService.myOrders(userId, clamp(page, 1, 1_000_000), clamp(limit, DEFAULT_LIMIT, MAX_LIMIT));
  }

  @Roles(...STAFF)
  @Query(() => AdminOrderPageModel, { description: '4.4' })
  orders(@Args('filter', { type: () => OrderQueryDto, nullable: true }) filter?: OrderQueryDto) {
    return this.ordersService.adminList(filter ?? new OrderQueryDto());
  }

  @Roles(...STAFF)
  @Query(() => AdminOrderDetailModel, { description: '4.5' })
  order(@Args('id', { type: () => ID }, ParseIdPipe) id: string) {
    return this.ordersService.adminDetail(id);
  }

  @Public()
  @RateLimit({ limit: 10, windowSeconds: 15 * 60 })
  @Mutation(() => CustomerOrderModel, { description: '14.1 Cancel before shipping' })
  cancelOrder(
    @Args('id', { type: () => ID }, ParseIdPipe) id: string,
    @Args('input', { nullable: true }) input?: CancelOrderDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.ordersService.cancelByCustomer(id, input ?? {}, user);
  }
}
