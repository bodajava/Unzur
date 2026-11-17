import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Public, RateLimit } from '../../common/decorators/index.js';
import { CONTACT_LIMIT } from './contact.controller.js';
import { ContactService } from './contact.service.js';
import { CreateContactMessageDto } from './dto/index.js';
import { ContactMessageReceiptModel } from './entities/contact.model.js';

@Resolver(() => ContactMessageReceiptModel)
export class ContactResolver {
  constructor(private readonly contact: ContactService) {}

  @Public()
  @RateLimit(CONTACT_LIMIT)
  @Mutation(() => ContactMessageReceiptModel, { description: '7.4' })
  sendContactMessage(@Args('input') input: CreateContactMessageDto) {
    return this.contact.create(input);
  }
}
