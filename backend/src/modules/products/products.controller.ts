import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  Audit,
  CurrentActor,
  Public,
  RateLimit,
  ResponseMessage,
  Roles,
} from '../../common/decorators/index.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import type { AppRequest } from '../../common/interfaces/request.interface.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { createMulterMemoryOptions } from '../../common/utilities/multer/multer.config.js';
import { requestMeta } from '../../common/utilities/request-meta.js';
import { DiscoveryService } from './discovery.service.js';
import {
  AdminProductQueryDto,
  CreateProductDto,
  CreateVariantDto,
  NotifyMeDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/index.js';
import { MAX_PRODUCT_IMAGES, ProductsService } from './products.service.js';
import { VariantsService } from './variants.service.js';

const WRITERS = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;

/**
 * Route order matters: static paths (admin/all, recently-viewed) are declared
 * before `:slug` so they are not treated as a product slug.
 */
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly variants: VariantsService,
    private readonly discovery: DiscoveryService,
  ) {}

  /** 2.1 */
  @Public()
  @Get()
  list(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  /** 2.3 Includes hidden products (and deleted with includeDeleted=true), costPrice, stock stats. */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @Get('admin/all')
  adminList(@Query() query: AdminProductQueryDto) {
    return this.products.adminList(query);
  }

  /** 2.3b One product for the dashboard editor: costPrice, all images, hidden variants, stock stats. */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @Get('admin/:id')
  adminFindOne(@Param('id', ParseIdPipe) id: string) {
    return this.products.adminFindById(id);
  }

  /** 16.3 For the logged-in user, else the guest (x-guest-id / guest_id cookie). */
  @Public()
  @Get('recently-viewed')
  recentlyViewed(@CurrentActor() actor: Actor) {
    return this.discovery.recentlyViewed(actor);
  }

  /** 16.2 */
  @Public()
  @Get(':id/recommendations')
  recommendations(@Param('id', ParseIdPipe) id: string) {
    return this.discovery.recommendations(id);
  }

  /** 16.4 */
  @Public()
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Post(':id/notify-me')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('We will email you when it is back in stock')
  notifyMe(@Param('id', ParseIdPipe) id: string, @Body() dto: NotifyMeDto) {
    return this.discovery.notifyMe(id, dto);
  }

  /** 2.2 Also records a (deduplicated) view in the background. */
  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string, @CurrentActor() actor: Actor, @Req() req: AppRequest) {
    return this.products.findBySlug(slug, actor, requestMeta(req).ipAddress);
  }

  /** 2.4 multipart/form-data, up to 10 files in `images`. */
  @Roles(...WRITERS)
  @Post()
  @UseInterceptors(FilesInterceptor('images', MAX_PRODUCT_IMAGES, createMulterMemoryOptions({ maxFiles: MAX_PRODUCT_IMAGES })))
  @ResponseMessage('Product created')
  create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Audit() audit: AuditContext,
  ) {
    return this.products.create(dto, files, audit);
  }

  /** 2.5 */
  @Roles(...WRITERS)
  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images', MAX_PRODUCT_IMAGES, createMulterMemoryOptions({ maxFiles: MAX_PRODUCT_IMAGES })))
  @ResponseMessage('Product updated')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Audit() audit: AuditContext,
  ) {
    return this.products.update(id, dto, files, audit);
  }

  /** 2.6 Soft delete. */
  @Roles(...WRITERS)
  @Delete(':id')
  @ResponseMessage('Product deleted')
  remove(@Param('id', ParseIdPipe) id: string, @Audit() audit: AuditContext) {
    return this.products.remove(id, audit);
  }

  /** 13.1 */
  @Roles(...WRITERS)
  @Post(':id/variants')
  @ResponseMessage('Variant created')
  createVariant(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: CreateVariantDto,
    @Audit() audit: AuditContext,
  ) {
    return this.variants.create(id, dto, audit);
  }
}
