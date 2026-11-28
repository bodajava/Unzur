import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { DiscountType } from '../../../graphql/enums.js';
import { ImageRefModel } from '../../../graphql/models/image.model.js';
import { JSONScalar } from '../../../graphql/scalars/json.scalar.js';

/** All money fields are Int piasters (100 = 1 EGP). */

@ObjectType('CartLineProduct')
export class CartLineProductModel {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field() slug: string;
  @Field(() => ImageRefModel, { nullable: true }) primaryImage: ImageRefModel | null;
}

@ObjectType('CartLineVariant')
export class CartLineVariantModel {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field() sku: string;
  @Field(() => JSONScalar, { nullable: true }) attributes: unknown;
}

@ObjectType('CartLine')
export class CartLineModel {
  @Field(() => ID) id: string;
  @Field(() => ID) productId: string;
  @Field(() => ID, { nullable: true }) variantId: string | null;
  /** The size-chart choice picked (e.g. "English") */
  @Field(() => String, { nullable: true }) choice: string | null;
  @Field(() => Int) quantity: number;
  @Field(() => CartLineProductModel) product: CartLineProductModel;
  @Field(() => CartLineVariantModel, { nullable: true }) variant: CartLineVariantModel | null;
  /** Price per unit now (sale price when set) */
  @Field(() => Int) unitPrice: number;
  /** Price per unit before the sale */
  @Field(() => Int) originalUnitPrice: number;
  @Field(() => Int) lineTotal: number;
  @Field(() => Int) availableStock: number;
  /** Product/variant still active and not deleted */
  @Field() isAvailable: boolean;
  @Field() inStock: boolean;
  @Field() hasEnoughStock: boolean;
}

@ObjectType('AppliedCoupon')
export class AppliedCouponModel {
  @Field() code: string;
  /** Re-checked live on every cart read */
  @Field() valid: boolean;
  @Field(() => DiscountType, { nullable: true }) discountType: DiscountType | null;
  @Field(() => Int, { nullable: true }) discountValue: number | null;
  @Field(() => Int) discountAmount: number;
  /** Why the coupon does not apply (when valid = false) */
  @Field(() => String, { nullable: true }) message: string | null;
}

@ObjectType('Cart')
export class CartModel {
  @Field(() => ID, { nullable: true }) id: string | null;
  /** Set for guests; the client should persist it (also sent as the guest_id cookie). */
  @Field(() => String, { nullable: true }) guestId: string | null;
  @Field(() => [CartLineModel]) items: CartLineModel[];
  /** Total units */
  @Field(() => Int) itemCount: number;
  /** Sum of available lines */
  @Field(() => Int) subtotal: number;
  @Field(() => AppliedCouponModel, { nullable: true }) coupon: AppliedCouponModel | null;
  @Field(() => Int) discountAmount: number;
  /** subtotal - discountAmount, before shipping */
  @Field(() => Int) estimatedTotal: number;
  @Field() canCheckout: boolean;
  @Field(() => [String]) issues: string[];
}
