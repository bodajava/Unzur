import { registerEnumType } from '@nestjs/graphql';
import { DiscountType, OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '../common/enums/index.js';

/** Prisma enums exposed in the GraphQL schema. Import this file before using them in @Field. */
registerEnumType(DiscountType, { name: 'DiscountType' });
registerEnumType(UserRole, { name: 'UserRole' });
registerEnumType(OrderStatus, { name: 'OrderStatus' });
registerEnumType(PaymentStatus, { name: 'PaymentStatus' });
registerEnumType(PaymentMethod, { name: 'PaymentMethod' });

export { DiscountType, OrderStatus, PaymentMethod, PaymentStatus, UserRole };
