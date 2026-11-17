import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Trim } from '../../../common/decorators/index.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../../../graphql/enums.js';

/** 4.4 GET /orders?status=&paymentStatus=&paymentMethod=&fromDate=&toDate=&search= */
@InputType('OrdersFilter')
export class OrderQueryDto extends PaginationQueryDto {
  @Field(() => OrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @Field(() => PaymentStatus, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @Field(() => PaymentMethod, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fromDate?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  toDate?: Date;
}

/** ?contact=<email|phone> proves a guest owns the order. */
export class ContactQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 254)
  contact?: string;
}

/** 4.2 contact is required */
export class TrackQueryDto {
  @Trim()
  @IsString()
  @Length(3, 254)
  contact: string;
}
