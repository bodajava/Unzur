import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Audit, Public, ResponseMessage, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { CreateShippingZoneDto, ShippingRateQueryDto, UpdateShippingZoneDto } from './dto/index.js';
import { ShippingService } from './shipping.service.js';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  /** 15.1 */
  @Public()
  @Get('rates')
  rate(@Query() query: ShippingRateQueryDto) {
    return this.shipping.rate(query.governorate, query.cartSubtotal);
  }
}

/** 15.2 */
@Controller('admin/shipping-zones')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminShippingZonesController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  list() {
    return this.shipping.list();
  }

  @Post()
  @ResponseMessage('Shipping zone created')
  create(@Body() dto: CreateShippingZoneDto, @Audit() audit: AuditContext) {
    return this.shipping.create(dto, audit);
  }

  @Patch(':id')
  @ResponseMessage('Shipping zone updated')
  update(@Param('id', ParseIdPipe) id: string, @Body() dto: UpdateShippingZoneDto, @Audit() audit: AuditContext) {
    return this.shipping.update(id, dto, audit);
  }

  @Delete(':id')
  remove(@Param('id', ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.shipping.remove(id, audit);
  }
}
