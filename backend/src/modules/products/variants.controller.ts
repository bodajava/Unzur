import { Body, Controller, Delete, Param, Patch } from '@nestjs/common';
import { Audit, ResponseMessage, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { UpdateVariantDto } from './dto/index.js';
import { VariantsService } from './variants.service.js';

@Controller('variants')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class VariantsController {
  constructor(private readonly variants: VariantsService) {}

  /** 13.2 */
  @Patch(':id')
  @ResponseMessage('Variant updated')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateVariantDto,
    @Audit() audit: AuditContext,
  ) {
    return this.variants.update(id, dto, audit);
  }

  /** 13.3 Deactivates instead when the variant was already ordered. */
  @Delete(':id')
  remove(@Param('id', ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.variants.remove(id, audit);
  }
}
