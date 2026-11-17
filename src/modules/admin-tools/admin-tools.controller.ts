import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import { AdminToolsService } from './admin-tools.service.js';
import { AuditLogQueryDto, CustomerDirectoryQueryDto, ExportQueryDto, LowStockQueryDto } from './dto/index.js';

const STAFF = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] as const;
const ADMINS = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;

@Controller('admin')
export class AdminToolsController {
  constructor(private readonly tools: AdminToolsService) {}

  /** 19.1 */
  @Roles(...STAFF)
  @Get('inventory/low-stock')
  lowStock(@Query() query: LowStockQueryDto) {
    return this.tools.lowStock(query.limit);
  }

  /** 19.2 */
  @Roles(...ADMINS)
  @Get('audit-logs')
  auditLogs(@Query() query: AuditLogQueryDto) {
    return this.tools.auditLogs(query);
  }

  /** 19.3 CSV download (UTF-8 with BOM for Excel). */
  @Roles(...ADMINS)
  @Get('reports/export')
  export(@Query() query: ExportQueryDto): StreamableFile {
    return new StreamableFile(this.tools.export(query.type), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${query.type}-report.csv"`,
    });
  }

  /** 19.4 Registered customers + guest buyers. */
  @Roles(...STAFF)
  @Get('customers')
  customers(@Query() query: CustomerDirectoryQueryDto) {
    return this.tools.customers(query);
  }
}
