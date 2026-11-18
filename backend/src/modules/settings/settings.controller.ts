import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Audit, Public, ResponseMessage, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { UpdateSettingsDto } from './dto/index.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** 15.3 { whatsapp_number, free_shipping_threshold, store_name, currency, ... } */
  @Public()
  @Get('public')
  publicSettings() {
    return this.settings.publicMap();
  }
}

@Controller('admin/settings')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** 15.4 All settings, including private ones. */
  @Get()
  list() {
    return this.settings.listAll();
  }

  /** 15.4 Bulk upsert. */
  @Patch()
  @ResponseMessage('Settings saved')
  update(@Body() dto: UpdateSettingsDto, @Audit() audit: AuditContext) {
    return this.settings.upsertMany(dto, audit);
  }
}
