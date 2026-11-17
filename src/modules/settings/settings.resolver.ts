import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Audit, Public, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { JSONScalar } from '../../graphql/scalars/json.scalar.js';
import { UpdateSettingsDto } from './dto/index.js';
import { StoreSettingModel } from './entities/setting.model.js';
import { SettingsService } from './settings.service.js';

@Resolver(() => StoreSettingModel)
export class SettingsResolver {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Query(() => JSONScalar, { description: '15.3 Public settings as { key: value }' })
  publicSettings() {
    return this.settings.publicMap();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Query(() => [StoreSettingModel], { description: '15.4 Admin: all settings' })
  adminSettings() {
    return this.settings.listAll();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Mutation(() => [StoreSettingModel], { description: '15.4 Admin: bulk upsert' })
  updateSettings(@Args('input') input: UpdateSettingsDto, @Audit() audit: AuditContext) {
    return this.settings.upsertMany(input, audit);
  }
}
