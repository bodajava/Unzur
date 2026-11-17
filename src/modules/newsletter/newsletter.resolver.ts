import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Public, RateLimit } from '../../common/decorators/index.js';
import { SubscribeDto } from './dto/index.js';
import { NewsletterSubscriptionModel } from './entities/newsletter.model.js';
import { SUBSCRIBE_LIMIT } from './newsletter.controller.js';
import { NewsletterService } from './newsletter.service.js';

@Resolver(() => NewsletterSubscriptionModel)
export class NewsletterResolver {
  constructor(private readonly newsletter: NewsletterService) {}

  @Public()
  @RateLimit(SUBSCRIBE_LIMIT)
  @Mutation(() => NewsletterSubscriptionModel, { description: '7.1' })
  subscribeNewsletter(@Args('input') input: SubscribeDto) {
    return this.newsletter.subscribe(input.email);
  }
}
