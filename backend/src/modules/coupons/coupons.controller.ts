import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  Audit,
  CurrentActor,
  CurrentUser,
  Public,
  RateLimit,
  ResponseMessage,
  Roles,
} from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { CouponsService } from './coupons.service.js';
import { CouponQueryDto, CreateCouponDto, SendCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/index.js';

const WRITERS = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;
/** Limits code guessing: 10 tries per minute per IP. */
export const COUPON_VALIDATE_LIMIT = { limit: 10, windowSeconds: 60 };

@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  /** 6.1 */
  @Public()
  @RateLimit(COUPON_VALIDATE_LIMIT)
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Coupon is valid')
  validate(
    @Body() dto: ValidateCouponDto,
    @CurrentActor() actor: Actor,
    @CurrentUser('email') email?: string,
  ) {
    return this.coupons.validate(dto, actor, email);
  }

  /** 6.4 */
  @Roles(...WRITERS)
  @Post('send-to-buyers')
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Coupon emails are being sent')
  send(@Body() dto: SendCouponDto, @Audit() audit: AuditContext) {
    return this.coupons.sendToBuyers(dto, audit);
  }

  /** 6.2 */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @Get()
  list(@Query() query: CouponQueryDto) {
    return this.coupons.list(query);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @Get(':id')
  findOne(@Param('id', ParseIdPipe) id: string) {
    return this.coupons.findOne(id);
  }

  /** 6.3 */
  @Roles(...WRITERS)
  @Post()
  @ResponseMessage('Coupon created')
  create(@Body() dto: CreateCouponDto, @Audit() audit: AuditContext) {
    return this.coupons.create(dto, audit);
  }

  @Roles(...WRITERS)
  @Patch(':id')
  @ResponseMessage('Coupon updated')
  update(@Param('id', ParseIdPipe) id: string, @Body() dto: UpdateCouponDto, @Audit() audit: AuditContext) {
    return this.coupons.update(id, dto, audit);
  }

  @Roles(...WRITERS)
  @Delete(':id')
  remove(@Param('id', ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.coupons.remove(id, audit);
  }
}
