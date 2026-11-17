import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Audit, Public, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { DeleteResultModel } from '../../graphql/models/operation-result.model.js';
import { CreateShippingZoneDto, ShippingRateQueryDto, UpdateShippingZoneDto } from './dto/index.js';
import { ShippingRateModel, ShippingZoneModel } from './entities/shipping.model.js';
import { ShippingService } from './shipping.service.js';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { BadRequestException } from '@nestjs/common';

const ADMINS = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;

@Resolver(() => ShippingZoneModel)
export class ShippingResolver {
  constructor(private readonly shipping: ShippingService) {}

  @Public()
  @Query(() => ShippingRateModel, { description: '15.1 Fee for a governorate (free above the threshold)' })
  async shippingRate(
    @Args('governorate') governorate: string,
    @Args('cartSubtotal', { type: () => Int, nullable: true }) cartSubtotal?: number,
  ) {
    // Same checks as the REST query DTO (scalar args are not validated by the pipe).
    const query = plainToInstance(ShippingRateQueryDto, { governorate, cartSubtotal });
    await validateOrReject(query).catch(() => {
      throw new BadRequestException('Invalid governorate or cartSubtotal');
    });
    return this.shipping.rate(query.governorate, query.cartSubtotal ?? undefined);
  }

  @Roles(...ADMINS)
  @Query(() => [ShippingZoneModel], { description: '15.2 Admin' })
  shippingZones() {
    return this.shipping.list();
  }

  @Roles(...ADMINS)
  @Mutation(() => ShippingZoneModel)
  createShippingZone(@Args('input') input: CreateShippingZoneDto, @Audit() audit: AuditContext) {
    return this.shipping.create(input, audit);
  }

  @Roles(...ADMINS)
  @Mutation(() => ShippingZoneModel)
  updateShippingZone(
    @Args('id', { type: () => ID }, ParseIdPipe) id: string,
    @Args('input') input: UpdateShippingZoneDto,
    @Audit() audit: AuditContext,
  ) {
    return this.shipping.update(id, input, audit);
  }

  @Roles(...ADMINS)
  @Mutation(() => DeleteResultModel)
  deleteShippingZone(@Args('id', { type: () => ID }, ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.shipping.remove(id, audit);
  }
}
