import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import { GuestSessionService } from '../../common/services/guest/guest-session.service.js';
import { isUniqueViolation } from '../../models/prisma-errors.js';
import { CartItemRepository } from '../../models/repositories/cart-item.repository.js';
import { CartRepository } from '../../models/repositories/cart.repository.js';
import { ProductVariantRepository } from '../../models/repositories/product-variant.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { CartDetailRow, CartOwner } from '../../models/schemas/cart.schema.js';
import { CouponEvaluator } from '../coupons/coupon-evaluator.service.js';
import { priceCartLines } from './cart-pricing.js';
import { type AddCartItemDto, MAX_LINE_QUANTITY, type UpdateCartItemDto } from './dto/index.js';
import type { AppliedCouponModel, CartModel } from './entities/cart.model.js';

/** Cart domain: CRUD (3.1–3.5), live pricing and guest-cart merge on login. */
@Injectable()
export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly cartItems: CartItemRepository,
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
    private readonly tx: TransactionManager,
    private readonly guests: GuestSessionService,
    private readonly coupons: CouponEvaluator,
  ) {}

  // ───────────── 3.1 ─────────────

  async getCart(actor: Actor, email?: string): Promise<CartModel> {
    const owner = this.ownerOf(actor);
    if (!owner) return this.emptyCart(null);
    return this.view(owner, await this.carts.findDetailByOwner(owner), email);
  }

  // ───────────── 3.2 ─────────────

  async addItem(actor: Actor, dto: AddCartItemDto, email?: string): Promise<CartModel> {
    const owner = await this.ensureOwner(actor);
    const variantId = dto.variantId ?? null;
    const stock = await this.availableStock(dto.productId, variantId);

    const write = () =>
      this.tx.run(async (tx) => {
        const cart = await this.carts.withTx(tx).upsertForOwner(owner);
        const items = this.cartItems.withTx(tx);
        const line = await items.lockLine(cart.id, dto.productId, variantId);
        const total = (line?.quantity ?? 0) + dto.quantity;
        this.assertQuantity(total, stock);
        if (line) await items.updateById(line.id, { quantity: total });
        else await items.create({ cartId: cart.id, productId: dto.productId, variantId, quantity: dto.quantity });
      });

    try {
      await write();
    } catch (error) {
      // Two first-adds of the same line raced: the row exists now, so retry once as an increment.
      if (!isUniqueViolation(error)) throw error;
      await write();
    }
    return this.view(owner, await this.carts.findDetailByOwner(owner), email);
  }

  // ───────────── 3.3 ─────────────

  async updateItem(actor: Actor, itemId: string, dto: UpdateCartItemDto, email?: string): Promise<CartModel> {
    const { owner, item } = await this.ownedItem(actor, itemId);
    if (dto.quantity === 0) {
      await this.cartItems.delete({ id: item.id });
    } else {
      this.assertQuantity(dto.quantity, await this.availableStock(item.productId, item.variantId));
      await this.cartItems.updateById(item.id, { quantity: dto.quantity });
    }
    return this.view(owner, await this.carts.findDetailByOwner(owner), email);
  }

  // ───────────── 3.4 ─────────────

  async removeItem(actor: Actor, itemId: string, email?: string): Promise<CartModel> {
    const { owner, item } = await this.ownedItem(actor, itemId);
    await this.cartItems.delete({ id: item.id });
    return this.view(owner, await this.carts.findDetailByOwner(owner), email);
  }

  // ───────────── 3.5 ─────────────

  async clear(actor: Actor): Promise<CartModel> {
    const owner = this.ownerOf(actor);
    if (!owner) return this.emptyCart(null);
    const cart = await this.carts.findByOwner(owner);
    if (cart) {
      await this.tx.run(async (tx) => {
        await this.cartItems.withTx(tx).deleteMany({ cartId: cart.id });
        await this.carts.withTx(tx).updateById(cart.id, { couponCode: null });
      });
    }
    return this.view(owner, await this.carts.findDetailByOwner(owner));
  }

  /** Removes the coupon from the cart (items stay). */
  async removeCoupon(actor: Actor, email?: string): Promise<CartModel> {
    const owner = this.ownerOf(actor);
    if (!owner) return this.emptyCart(null);
    const cart = await this.carts.findByOwner(owner);
    if (cart?.couponCode) await this.carts.updateById(cart.id, { couponCode: null });
    return this.view(owner, await this.carts.findDetailByOwner(owner), email);
  }

  // ───────────── Login merge (used by AuthService) ─────────────

  /**
   * Moves a guest cart into the user's cart. Lines for the same
   * (product, variant) are summed, so the NULLS NOT DISTINCT unique index
   * on cart_items is never violated. Returns the number of guest lines merged.
   */
  mergeGuestCart(guestId: string, userId: string): Promise<number> {
    return this.tx.run(async (tx) => {
      const carts = this.carts.withTx(tx);
      const items = this.cartItems.withTx(tx);

      const guestCart = await carts.findByGuestIdWithItems(guestId);
      if (!guestCart || guestCart.userId) return 0;

      const userCart = await carts.findByUserId(userId);
      if (!userCart) {
        await carts.updateById(guestCart.id, { userId, guestId: null });
        return guestCart.items.length;
      }

      for (const item of guestCart.items) {
        const existing = await items.findLine(userCart.id, item.productId, item.variantId);
        if (existing) {
          await items.updateById(existing.id, {
            quantity: Math.min(existing.quantity + item.quantity, MAX_LINE_QUANTITY),
          });
        } else {
          await items.moveToCart(item.id, userCart.id);
        }
      }

      if (!userCart.couponCode && guestCart.couponCode) {
        await carts.updateById(userCart.id, { couponCode: guestCart.couponCode });
      }

      // Lines already summed into the user cart cascade-delete with it.
      await carts.delete({ id: guestCart.id });
      return guestCart.items.length;
    });
  }

  // ───────────── Internals ─────────────

  /** user -> their cart; else guest -> guest cart; else nobody. */
  private ownerOf(actor: Actor): CartOwner | null {
    if (actor.userId) return { userId: actor.userId };
    if (actor.guestId) return { guestId: actor.guestId };
    return null;
  }

  /** On a write, a visitor without a guest id gets a new guest session. */
  private async ensureOwner(actor: Actor): Promise<CartOwner> {
    return this.ownerOf(actor) ?? { guestId: (await this.guests.ensure()).guestId };
  }

  private async ownedItem(actor: Actor, itemId: string) {
    const owner = this.ownerOf(actor);
    const cart = owner ? await this.carts.findByOwner(owner) : null;
    // Same 404 whether the item does not exist or belongs to someone else.
    const item = cart ? await this.cartItems.findInCart(itemId, cart.id) : null;
    if (!owner || !item) throw new NotFoundException('Cart item not found');
    return { owner, item };
  }

  /** Validates product/variant and returns the stock that applies. */
  private async availableStock(productId: string, variantId: string | null): Promise<number> {
    const product = await this.products.findPublicById(productId);
    if (!product) throw new NotFoundException('Product not found');

    if (!variantId) {
      if (await this.variants.exists({ productId, isActive: true })) {
        throw new BadRequestException('Please choose a variant of this product');
      }
      return product.stock;
    }
    const variant = await this.variants.findById(variantId);
    if (!variant || variant.productId !== productId || !variant.isActive) {
      throw new NotFoundException('Variant not found');
    }
    return variant.stock;
  }

  private assertQuantity(quantity: number, stock: number): void {
    if (quantity > MAX_LINE_QUANTITY) {
      throw new BadRequestException(`You can add at most ${MAX_LINE_QUANTITY} of one item`);
    }
    if (quantity > stock) {
      throw new BadRequestException(
        stock <= 0 ? 'This item is out of stock' : `Only ${stock} left in stock`,
      );
    }
  }

  /** Prices the cart and re-checks its coupon against the live subtotal. */
  private async view(owner: CartOwner, cart: CartDetailRow | null, email?: string): Promise<CartModel> {
    if (!cart) return this.emptyCart(owner.guestId ?? null);
    const { lines, subtotal, itemCount, issues } = priceCartLines(cart.items);

    let coupon: AppliedCouponModel | null = null;
    if (cart.couponCode) {
      const result = await this.coupons.evaluate(cart.couponCode, subtotal, { ...owner, email });
      coupon = {
        code: cart.couponCode,
        valid: result.ok,
        discountType: result.coupon?.discountType ?? null,
        discountValue: result.coupon?.discountValue ?? null,
        discountAmount: result.ok ? result.discountAmount : 0,
        message: result.ok ? null : result.reason,
      };
    }
    const discountAmount = coupon?.discountAmount ?? 0;
    return {
      id: cart.id,
      guestId: cart.userId ? null : cart.guestId,
      items: lines,
      itemCount,
      subtotal,
      coupon,
      discountAmount,
      estimatedTotal: subtotal - discountAmount,
      canCheckout: lines.length > 0 && issues.length === 0,
      issues,
    };
  }

  private emptyCart(guestId: string | null): CartModel {
    return {
      id: null,
      guestId,
      items: [],
      itemCount: 0,
      subtotal: 0,
      coupon: null,
      discountAmount: 0,
      estimatedTotal: 0,
      canCheckout: false,
      issues: [],
    };
  }
}
