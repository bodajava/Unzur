import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public, RateLimit, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import { AiService } from './ai.service.js';
import { AdminChatDto, AdvisorDto, CustomerChatDto } from './dto/index.js';

export const CUSTOMER_CHAT_LIMIT = { limit: 20, windowSeconds: 60 };
export const ADMIN_AI_LIMIT = { limit: 30, windowSeconds: 60 };

@Controller()
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** 9.1 Public data only. */
  @Public()
  @RateLimit(CUSTOMER_CHAT_LIMIT)
  @Post('ai/customer/chat')
  @HttpCode(HttpStatus.OK)
  customerChat(@Body() dto: CustomerChatDto) {
    return this.ai.customerChat(dto);
  }

  /** 9.2 */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @RateLimit(ADMIN_AI_LIMIT)
  @Post('admin/ai/advisor')
  @HttpCode(HttpStatus.OK)
  advisor(@Body() dto: AdvisorDto) {
    return this.ai.advisor(dto);
  }

  /** 9.3 */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @RateLimit(ADMIN_AI_LIMIT)
  @Post('admin/ai/chat')
  @HttpCode(HttpStatus.OK)
  adminChat(@Body() dto: AdminChatDto) {
    return this.ai.adminChat(dto);
  }
}
