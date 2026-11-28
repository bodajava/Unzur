import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '../../../graphql/enums.js';
import { Paginated } from '../../../graphql/models/pagination.model.js';
import { JSONScalar } from '../../../graphql/scalars/json.scalar.js';
import { PaymentModel, PaymentSessionModel } from '../../payments/entities/payment.model.js';

/** Money fields are Int piasters. */

@ObjectType('OrderItem')
export class OrderItemModel {
  @Field(() => ID) id: string;
  @Field(() => ID) productId: string;
  @Field(() => ID, { nullable: true }) variantId: string | null;
  @Field() productName: string;
  @Field(() => String, { nullable: true }) variantName: string | null;
  @Field(() => String, { nullable: true }) productNameAr: string | null;
  @Field(() => String, { nullable: true }) variantNameAr: string | null;
  @Field(() => Int) priceAtPurchase: number;
  @Field(() => String, { nullable: true }) imageUrl: string | null;
  /** Size-chart choice picked (e.g. "عربي") */
  @Field(() => String, { nullable: true }) choice: string | null;
  @Field(() => Int) quantity: number;
}

@ObjectType('OrderEvent')
export class OrderEventModel {
  @Field(() => ID) id: string;
  @Field(() => OrderStatus, { nullable: true }) fromStatus: OrderStatus | null;
  @Field(() => OrderStatus) toStatus: OrderStatus;
  @Field(() => String, { nullable: true }) note: string | null;
  @Field() createdAt: Date;
}

@ObjectType({ isAbstract: true })
abstract class OrderCoreModel {
  @Field(() => ID) id: string;
  @Field() orderNumber: string;
  @Field(() => OrderStatus) status: OrderStatus;
  @Field(() => PaymentStatus) paymentStatus: PaymentStatus;
  @Field(() => PaymentMethod) paymentMethod: PaymentMethod;
  @Field(() => Int) subtotal: number;
  @Field(() => Int) shippingCost: number;
  @Field(() => Int) discountAmount: number;
  @Field(() => Int) giftCardAmount: number;
  @Field(() => Int) loyaltyDiscount: number;
  @Field(() => Int) totalAmount: number;
  @Field(() => String, { nullable: true }) couponCode: string | null;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}

/** Customer view (my orders, tracking, checkout result). */
@ObjectType('CustomerOrder')
export class CustomerOrderModel extends OrderCoreModel {
  @Field() customerName: string;
  /** Tracking shows only governorate/city */
  @Field(() => JSONScalar) shippingAddress: unknown;
  @Field(() => String, { nullable: true }) notes: string | null;
  @Field(() => String, { nullable: true }) cancelOrRefundReason: string | null;
  @Field(() => [OrderItemModel]) items: OrderItemModel[];
  @Field(() => [OrderEventModel]) statusHistory: OrderEventModel[];
}

@ObjectType('CustomerOrderPage')
export class CustomerOrderPageModel extends Paginated(CustomerOrderModel) {}

@ObjectType('AdminOrderListItem')
export class AdminOrderListItemModel extends OrderCoreModel {
  @Field(() => ID, { nullable: true }) userId: string | null;
  @Field(() => String, { nullable: true }) guestId: string | null;
  @Field() customerName: string;
  @Field() customerEmail: string;
  @Field() customerPhone: string;
  @Field(() => JSONScalar) shippingAddress: unknown;
  @Field(() => Int) itemCount: number;
}

@ObjectType('AdminOrderPage')
export class AdminOrderPageModel extends Paginated(AdminOrderListItemModel) {}

@ObjectType('OrderActor')
export class OrderActorModel {
  @Field(() => ID) id: string;
  @Field() firstName: string;
  @Field() lastName: string;
  @Field(() => UserRole) role: UserRole;
}

@ObjectType('AdminOrderEvent')
export class AdminOrderEventModel extends OrderEventModel {
  @Field(() => OrderActorModel, { nullable: true }) changedBy: OrderActorModel | null;
}

@ObjectType('OrderCustomerAccount')
export class OrderCustomerAccountModel {
  @Field(() => ID) id: string;
  @Field() email: string;
  @Field() firstName: string;
  @Field() lastName: string;
  @Field(() => String, { nullable: true }) phone: string | null;
}

@ObjectType('AdminOrderDetail')
export class AdminOrderDetailModel extends AdminOrderListItemModel {
  @Field(() => String, { nullable: true }) notes: string | null;
  @Field(() => String, { nullable: true }) cancelOrRefundReason: string | null;
  @Field(() => ID, { nullable: true }) shippingZoneId: string | null;
  @Field(() => ID, { nullable: true }) giftCardId: string | null;
  @Field(() => [OrderItemModel]) items: OrderItemModel[];
  @Field(() => [PaymentModel]) payments: PaymentModel[];
  @Field(() => [AdminOrderEventModel]) statusHistory: AdminOrderEventModel[];
  @Field(() => OrderCustomerAccountModel, { nullable: true }) user: OrderCustomerAccountModel | null;
}

@ObjectType('CheckoutResult')
export class CheckoutResultModel {
  @Field(() => CustomerOrderModel) order: CustomerOrderModel;
  /** Online payment session (card/wallet with something to pay) */
  @Field(() => PaymentSessionModel, { nullable: true }) payment: PaymentSessionModel | null;
  /** Set when the order was created but the payment could not start; retry via initiate */
  @Field(() => String, { nullable: true }) paymentError: string | null;
  @Field(() => Int) loyaltyPointsUsed: number;
}
