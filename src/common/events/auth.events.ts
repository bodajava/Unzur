import type { Lang } from '../enums/http.enum.js';
import type { OtpType } from '../enums/prisma.enums.js';

export class OtpRequestedEvent {
  constructor(
    readonly email: string,
    readonly firstName: string,
    readonly type: OtpType,
    /** Plain code: in-memory only, never persisted or logged in production */
    readonly code: string,
    readonly lang: string | Lang,
  ) {}
}

export class UserRegisteredEvent {
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly referredById?: string,
  ) {}
}

export class UserEmailVerifiedEvent {
  constructor(
    readonly userId: string,
    readonly claimedOrders: number,
  ) {}
}

export class StaffCreatedEvent {
  constructor(
    readonly staffId: string,
    readonly createdById: string,
  ) {}
}
