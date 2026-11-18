import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../../graphql/models/pagination.model.js';
import { JSONScalar } from '../../../graphql/scalars/json.scalar.js';

@ObjectType('LowStockItem')
export class LowStockItemModel {
  /** PRODUCT | VARIANT */
  @Field() type: string;
  @Field(() => ID) productId: string;
  @Field(() => ID, { nullable: true }) variantId: string | null;
  @Field() name: string;
  @Field(() => String, { nullable: true }) variantName: string | null;
  @Field(() => String, { nullable: true }) nameAr: string | null;
  @Field(() => String, { nullable: true }) variantNameAr: string | null;
  @Field(() => String, { nullable: true }) sku: string | null;
  @Field() slug: string;
  @Field(() => Int) stock: number;
  @Field(() => Int) threshold: number;
}

@ObjectType('AuditActor')
export class AuditActorModel {
  @Field(() => ID) id: string;
  @Field() email: string;
  @Field() firstName: string;
  @Field() lastName: string;
  @Field() role: string;
}

@ObjectType('AuditLogEntry')
export class AuditLogModel {
  @Field(() => ID) id: string;
  @Field() action: string;
  @Field() entityType: string;
  @Field(() => String, { nullable: true }) entityId: string | null;
  @Field(() => JSONScalar, { nullable: true }) oldValues: unknown;
  @Field(() => JSONScalar, { nullable: true }) newValues: unknown;
  @Field(() => String, { nullable: true }) ipAddress: string | null;
  @Field(() => AuditActorModel, { nullable: true }) actor: AuditActorModel | null;
  @Field() createdAt: Date;
}

@ObjectType('AuditLogPage')
export class AuditLogPageModel extends Paginated(AuditLogModel) {}

@ObjectType('CustomerDirectoryEntry')
export class CustomerEntryModel {
  /** user id, or the email for guests */
  @Field() identifier: string;
  @Field() name: string;
  @Field() email: string;
  @Field(() => String, { nullable: true }) phone: string | null;
  @Field() isRegistered: boolean;
  @Field(() => Int) loyaltyPoints: number;
  @Field(() => Int) ordersCount: number;
  @Field(() => Int) totalSpent: number;
  @Field(() => Date, { nullable: true }) lastOrderAt: Date | null;
  @Field() firstSeenAt: Date;
}

@ObjectType('CustomerDirectoryPage')
export class CustomerPageModel extends Paginated(CustomerEntryModel) {}
