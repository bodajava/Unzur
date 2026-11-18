import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Public, RateLimit, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import { ADMIN_AI_LIMIT, CUSTOMER_CHAT_LIMIT } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AdminChatDto, AdvisorDto, CustomerChatDto } from './dto/index.js';
import { AdminChatResultModel, AdvisorResultModel, CustomerChatResultModel } from './entities/ai.model.js';

@Resolver()
export class AiResolver {
  constructor(private readonly ai: AiService) {}

  @Public()
  @RateLimit(CUSTOMER_CHAT_LIMIT)
  @Mutation(() => CustomerChatResultModel, { description: '9.1 Shopping assistant (public data only)' })
  customerAiChat(@Args('input') input: CustomerChatDto) {
    return this.ai.customerChat(input);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @RateLimit(ADMIN_AI_LIMIT)
  @Mutation(() => AdvisorResultModel, { description: '9.2 Data-grounded business advisor' })
  adminAiAdvisor(@Args('input') input: AdvisorDto) {
    return this.ai.advisor(input);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @RateLimit(ADMIN_AI_LIMIT)
  @Mutation(() => AdminChatResultModel, { description: '9.3 Staff assistant' })
  adminAiChat(@Args('input') input: AdminChatDto) {
    return this.ai.adminChat(input);
  }
}
