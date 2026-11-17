import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentActor, CurrentUser, Public, RateLimit } from '../../common/decorators/index.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { GuestSessionService } from '../../common/services/guest/guest-session.service.js';
import type { GqlContext } from '../../common/utilities/execution-context.js';
import { CartService } from './cart.service.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/index.js';
import { CartModel } from './entities/cart.model.js';

/** GraphQL twin of CartController (same service, same rules). */
@Public()
@Resolver(() => CartModel)
export class CartResolver {
  constructor(
    private readonly carts: CartService,
    private readonly guests: GuestSessionService,
  ) {}

  @Query(() => CartModel, { description: '3.1 The current cart (user, else guest)' })
  cart(@CurrentActor() actor: Actor, @CurrentUser('email') email?: string) {
    return this.carts.getCart(actor, email);
  }

  @RateLimit({ limit: 60, windowSeconds: 60 })
  @Mutation(() => CartModel, { description: '3.2 Creates a guest id when the visitor has none' })
  async addToCart(
    @Args('input') input: AddCartItemDto,
    @CurrentActor() actor: Actor,
    @Context() ctx: GqlContext,
    @CurrentUser('email') email?: string,
  ) {
    const cart = await this.carts.addItem(actor, input, email);
    if (cart.guestId && cart.guestId !== actor.guestId) this.guests.writeCookie(ctx.res, cart.guestId);
    return cart;
  }

  @Mutation(() => CartModel, { description: '3.3 quantity 0 removes the line' })
  updateCartItem(
    @Args('itemId', { type: () => ID }, ParseIdPipe) itemId: string,
    @Args('input') input: UpdateCartItemDto,
    @CurrentActor() actor: Actor,
    @CurrentUser('email') email?: string,
  ) {
    return this.carts.updateItem(actor, itemId, input, email);
  }

  @Mutation(() => CartModel, { description: '3.4' })
  removeCartItem(
    @Args('itemId', { type: () => ID }, ParseIdPipe) itemId: string,
    @CurrentActor() actor: Actor,
    @CurrentUser('email') email?: string,
  ) {
    return this.carts.removeItem(actor, itemId, email);
  }

  @Mutation(() => CartModel)
  removeCartCoupon(@CurrentActor() actor: Actor, @CurrentUser('email') email?: string) {
    return this.carts.removeCoupon(actor, email);
  }

  @Mutation(() => CartModel, { description: '3.5 Removes all items and the coupon' })
  clearCart(@CurrentActor() actor: Actor) {
    return this.carts.clear(actor);
  }
}
