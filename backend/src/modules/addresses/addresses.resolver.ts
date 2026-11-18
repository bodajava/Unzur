import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../common/decorators/index.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { DeleteResultModel } from '../../graphql/models/operation-result.model.js';
import { AddressesService } from './addresses.service.js';
import { CreateAddressDto, UpdateAddressDto } from './dto/index.js';
import { AddressModel } from './entities/address.model.js';

@Resolver(() => AddressModel)
export class AddressesResolver {
  constructor(private readonly addresses: AddressesService) {}

  @Query(() => [AddressModel], { description: '10.3' })
  myAddresses(@CurrentUser('id') userId: string) {
    return this.addresses.list(userId);
  }

  @Mutation(() => AddressModel, { description: '10.4' })
  createAddress(@CurrentUser('id') userId: string, @Args('input') input: CreateAddressDto) {
    return this.addresses.create(userId, input);
  }

  @Mutation(() => AddressModel, { description: '10.5' })
  updateAddress(
    @CurrentUser('id') userId: string,
    @Args('id', { type: () => ID }, ParseIdPipe) id: string,
    @Args('input') input: UpdateAddressDto,
  ) {
    return this.addresses.update(userId, id, input);
  }

  @Mutation(() => DeleteResultModel, { description: '10.6' })
  deleteAddress(@CurrentUser('id') userId: string, @Args('id', { type: () => ID }, ParseIdPipe) id: string) {
    return this.addresses.remove(userId, id);
  }

  @Mutation(() => AddressModel, { description: '10.7' })
  setDefaultAddress(@CurrentUser('id') userId: string, @Args('id', { type: () => ID }, ParseIdPipe) id: string) {
    return this.addresses.setDefault(userId, id);
  }
}
