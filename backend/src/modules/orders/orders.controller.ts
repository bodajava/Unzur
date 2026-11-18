import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Audit,
  CurrentActor,
  CurrentUser,
  Public,
  RateLimit,
  ResponseMessage,
  Roles,
} from '../../common/decorators/index.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import type { Actor, AuthUser } from '../../common/interfaces/auth.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { SettingsService } from '../settings/settings.service.js';
import { CheckoutService } from './checkout.service.js';
import {
  CancelOrderDto,
  CheckoutDto,
  ContactQueryDto,
  OrderQueryDto,
  RefundOrderDto,
  TrackQueryDto,
  UpdateOrderStatusDto,
} from './dto/index.js';
import { renderInvoice } from './invoice/invoice.renderer.js';
import { OrdersService } from './orders.service.js';

const STAFF = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] as const;
export const CHECKOUT_LIMIT = { limit: 10, windowSeconds: 60 };

/** Static paths (checkout, track, my-orders) are declared before :id. */
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  /** 4.1 Guest or user; uses the caller's cart. */
  @Public()
  @RateLimit(CHECKOUT_LIMIT)
  @Post('checkout')
  @ResponseMessage('Order placed')
  checkout(@Body() dto: CheckoutDto, @CurrentActor() actor: Actor) {
    return this.checkoutService.checkout(dto, actor);
  }

  /** 4.2 ?contact=<email|phone> required. */
  @Public()
  @RateLimit({ limit: 20, windowSeconds: 60 })
  @Get('track/:orderNumber')
  track(@Param('orderNumber') orderNumber: string, @Query() query: TrackQueryDto) {
    return this.orders.track(orderNumber, query.contact);
  }

  /** 4.3 */
  @Get('my-orders')
  myOrders(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.orders.myOrders(userId, query.page, query.limit);
  }

  /** 4.4 */
  @Roles(...STAFF)
  @Get()
  list(@Query() query: OrderQueryDto) {
    return this.orders.adminList(query);
  }

  /** 4.5 */
  @Roles(...STAFF)
  @Get(':id')
  detail(@Param('id', ParseIdPipe) id: string) {
    return this.orders.adminDetail(id);
  }

  /** 4.6 */
  @Roles(...STAFF)
  @Patch(':id/status')
  @ResponseMessage('Order status updated')
  status(@Param('id', ParseIdPipe) id: string, @Body() dto: UpdateOrderStatusDto, @Audit() audit: AuditContext) {
    return this.orders.changeStatus(id, dto, audit);
  }

  /** 4.7 */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/refund')
  @ResponseMessage('Order refunded')
  refund(@Param('id', ParseIdPipe) id: string, @Body() dto: RefundOrderDto, @Audit() audit: AuditContext) {
    return this.orders.refund(id, dto, audit);
  }

  /** 14.1 Owner, or a guest with the order's email/phone in `contact`. */
  @Public()
  @RateLimit({ limit: 10, windowSeconds: 15 * 60 })
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Order cancelled')
  cancel(@Param('id', ParseIdPipe) id: string, @Body() dto: CancelOrderDto, @CurrentUser() user?: AuthUser) {
    return this.orders.cancelByCustomer(id, dto, user);
  }

  /** 14.2 PDF. Owner, staff, or ?contact=. */
  @Public()
  @RateLimit({ limit: 20, windowSeconds: 60 })
  @Get(':id/invoice')
  async invoice(
    @Param('id', ParseIdPipe) id: string,
    @Query() query: ContactQueryDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<StreamableFile> {
    const order = await this.orders.forInvoice(id, user, query.contact);
    const settings = await this.settings.publicMap();
    const pdf = await renderInvoice(order, {
      name: (settings.store_name as string) || this.config.get<string>('APP_NAME') || 'Store',
      phone: (settings.whatsapp_number as string) || undefined,
      website: this.config.get<string>('FRONTEND_URL'),
    });
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="invoice-${order.orderNumber}.pdf"`,
      length: pdf.length,
    });
  }

  /** 14.3 */
  @Public()
  @RateLimit({ limit: 30, windowSeconds: 60 })
  @Get(':id/timeline')
  timeline(@Param('id', ParseIdPipe) id: string, @Query() query: ContactQueryDto, @CurrentUser() user?: AuthUser) {
    return this.orders.timeline(id, user, query.contact);
  }
}
