import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit, Public, ResponseMessage, Roles } from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { createMulterMemoryOptions } from '../../common/utilities/multer/multer.config.js';
import { BrandsService } from './brands.service.js';
import { CreateBrandDto, UpdateBrandDto } from './dto/index.js';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  /** 2.10b Dashboard: every brand (hidden ones too) with product counts. */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @Get('admin/all')
  adminList() {
    return this.brands.adminList();
  }

  /** 2.10 */
  @Public()
  @Get()
  list() {
    return this.brands.list();
  }

  /** 2.11 By UUID id or slug. */
  @Public()
  @Get(':identifier')
  findOne(@Param('identifier') identifier: string) {
    return this.brands.findOne(identifier);
  }

  /** 2.12 JSON or multipart with an optional `logo` file. */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor('logo', createMulterMemoryOptions({ maxFiles: 1 })))
  @ResponseMessage('Brand created')
  create(
    @Body() dto: CreateBrandDto,
    @UploadedFile() logo: Express.Multer.File | undefined,
    @Audit() audit: AuditContext,
  ) {
    return this.brands.create(dto, logo, audit);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo', createMulterMemoryOptions({ maxFiles: 1 })))
  @ResponseMessage('Brand updated')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateBrandDto,
    @UploadedFile() logo: Express.Multer.File | undefined,
    @Audit() audit: AuditContext,
  ) {
    return this.brands.update(id, dto, logo, audit);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  @ResponseMessage('Brand deleted')
  remove(@Param('id', ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.brands.remove(id, audit);
  }
}
