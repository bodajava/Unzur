import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, ResponseMessage } from '../../common/decorators/index.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { AddressesService } from './addresses.service.js';
import { CreateAddressDto, UpdateAddressDto } from './dto/index.js';

/** Logged-in user's address book (all routes need a Bearer token). */
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  /** 10.3 */
  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.addresses.list(userId);
  }

  /** 10.4 */
  @Post()
  @ResponseMessage('Address saved')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAddressDto) {
    return this.addresses.create(userId, dto);
  }

  /** 10.7 (declared before :id) */
  @Patch(':id/default')
  @ResponseMessage('Default address updated')
  setDefault(@CurrentUser('id') userId: string, @Param('id', ParseIdPipe) id: string) {
    return this.addresses.setDefault(userId, id);
  }

  /** 10.5 */
  @Patch(':id')
  @ResponseMessage('Address updated')
  update(@CurrentUser('id') userId: string, @Param('id', ParseIdPipe) id: string, @Body() dto: UpdateAddressDto) {
    return this.addresses.update(userId, id, dto);
  }

  /** 10.6 */
  @Delete(':id')
  @ResponseMessage('Address deleted')
  remove(@CurrentUser('id') userId: string, @Param('id', ParseIdPipe) id: string) {
    return this.addresses.remove(userId, id);
  }
}
