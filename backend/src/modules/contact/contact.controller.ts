import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Audit, Public, RateLimit, ResponseMessage, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { ContactService } from './contact.service.js';
import { ContactQueryDto, CreateContactMessageDto, UpdateContactMessageDto } from './dto/index.js';

export const CONTACT_LIMIT = { limit: 5, windowSeconds: 3600 };
const STAFF = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] as const;

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  /** 7.4 */
  @Public()
  @RateLimit(CONTACT_LIMIT)
  @Post()
  @ResponseMessage('Thanks! We will get back to you soon.')
  create(@Body() dto: CreateContactMessageDto) {
    return this.contact.create(dto);
  }

  /** 7.5 */
  @Roles(...STAFF)
  @Get('messages')
  inbox(@Query() query: ContactQueryDto) {
    return this.contact.inbox(query);
  }

  /** 7.6 */
  @Roles(...STAFF)
  @Patch('messages/:id')
  update(@Param('id', ParseIdPipe) id: string, @Body() dto: UpdateContactMessageDto) {
    return this.contact.update(id, dto);
  }

  /** 7.7 */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete('messages/:id')
  @ResponseMessage('Message deleted')
  remove(@Param('id', ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.contact.remove(id, audit);
  }
}
