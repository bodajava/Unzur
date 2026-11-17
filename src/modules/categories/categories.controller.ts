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
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/index.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** 2.7 Active categories as a tree (children nested). */
  @Public()
  @Get()
  tree() {
    return this.categories.tree();
  }

  /** 2.8 */
  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categories.findBySlug(slug);
  }

  /** 2.9 JSON or multipart with an optional `image` file. */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor('image', createMulterMemoryOptions({ maxFiles: 1 })))
  @ResponseMessage('Category created')
  create(
    @Body() dto: CreateCategoryDto,
    @UploadedFile() image: Express.Multer.File | undefined,
    @Audit() audit: AuditContext,
  ) {
    return this.categories.create(dto, image, audit);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', createMulterMemoryOptions({ maxFiles: 1 })))
  @ResponseMessage('Category updated')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() image: Express.Multer.File | undefined,
    @Audit() audit: AuditContext,
  ) {
    return this.categories.update(id, dto, image, audit);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  @ResponseMessage('Category deleted')
  remove(@Param('id', ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.categories.remove(id, audit);
  }
}
