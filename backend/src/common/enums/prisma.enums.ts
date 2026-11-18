/**
 * Domain enums. The database (Prisma schema) is the single source of truth;
 * they are re-exported here so the app imports them from common/enums.
 */
export {
  DiscountType,
  LoyaltyType,
  OrderStatus,
  OtpType,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from '../../generated/prisma/enums.js';
