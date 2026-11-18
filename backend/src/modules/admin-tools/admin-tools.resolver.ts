import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import { AdminToolsService } from './admin-tools.service.js';
import { AuditLogQueryDto, CustomerDirectoryQueryDto } from './dto/index.js';
import { AuditLogPageModel, CustomerPageModel, LowStockItemModel } from './entities/admin-tools.model.js';

@Resolver()
export class AdminToolsResolver {
  constructor(private readonly tools: AdminToolsService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @Query(() => [LowStockItemModel], { description: '19.1' })
  adminLowStock(@Args('limit', { type: () => Int, nullable: true }) limit?: number) {
    return this.tools.lowStock(Math.min(Math.max(limit ?? 100, 1), 500));
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Query(() => AuditLogPageModel, { description: '19.2' })
  adminAuditLogs(@Args('filter', { type: () => AuditLogQueryDto, nullable: true }) filter?: AuditLogQueryDto) {
    return this.tools.auditLogs(filter ?? new AuditLogQueryDto());
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @Query(() => CustomerPageModel, { description: '19.4' })
  adminCustomers(@Args('filter', { type: () => CustomerDirectoryQueryDto, nullable: true }) filter?: CustomerDirectoryQueryDto) {
    return this.tools.customers(filter ?? new CustomerDirectoryQueryDto());
  }
}
