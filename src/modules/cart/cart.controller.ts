import { Body, Controller, Delete, Get, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentActor, CurrentUser, Public, RateLimit, ResponseMessage } from '../../common/decorators/index.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { GuestSessionService } from '../../common/services/guest/guest-session.service.js';
import { CartService } from './cart.service.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/index.js';
import type { CartModel } from './entities/cart.model.js';

/**
 * Logged-in user -> their cart. Guest -> cart of x-guest-id / guest_id cookie.
 * A first write without either creates a guest id (returned + set as cookie).
 */
@Public()
@Controller('cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly guests: GuestSessionService,
  ) {}

  /** 3.1 */
  @Get()
  get(@CurrentActor() actor: Actor, @CurrentUser('email') email?: string) {
    return this.cart.getCart(actor, email);
  }

  /** 3.2 */
  @RateLimit({ limit: 60, windowSeconds: 60 })
  @Post('items')
  @ResponseMessage('Added to cart')
  async add(
    @Body() dto: AddCartItemDto,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('email') email?: string,
  ) {
    return this.persistGuest(actor, res, await this.cart.addItem(actor, dto, email));
  }

  /** 3.3 quantity 0 removes the line */
  @Patch('items/:itemId')
  @ResponseMessage('Cart updated')
  update(
    @Param('itemId', ParseIdPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentActor() actor: Actor,
    @CurrentUser('email') email?: string,
  ) {
    return this.cart.updateItem(actor, itemId, dto, email);
  }

  /** 3.4 */
  @Delete('items/:itemId')
  @ResponseMessage('Removed from cart')
  remove(
    @Param('itemId', ParseIdPipe) itemId: string,
    @CurrentActor() actor: Actor,
    @CurrentUser('email') email?: string,
  ) {
    return this.cart.removeItem(actor, itemId, email);
  }

  /** Removes the applied coupon. */
  @Delete('coupon')
  @ResponseMessage('Coupon removed')
  removeCoupon(@CurrentActor() actor: Actor, @CurrentUser('email') email?: string) {
    return this.cart.removeCoupon(actor, email);
  }

  /** 3.5 */
  @Delete()
  @ResponseMessage('Cart cleared')
  clear(@CurrentActor() actor: Actor) {
    return this.cart.clear(actor);
  }

  private persistGuest(actor: Actor, res: Response, cart: CartModel): CartModel {
    if (cart.guestId && cart.guestId !== actor.guestId) this.guests.writeCookie(res, cart.guestId);
    return cart;
  }
}
