import { Module } from '@nestjs/common';
import { BrandsModule } from '../brands/brands.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { CatalogResolver } from './catalog.resolver.js';
import { DiscoveryService } from './discovery.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { SearchController } from './search.controller.js';
import { VariantsController } from './variants.controller.js';
import { VariantsService } from './variants.service.js';

/** Catalog products, variants (13.x) and smart discovery (16.x). */
@Module({
  imports: [CategoriesModule, BrandsModule],
  controllers: [ProductsController, VariantsController, SearchController],
  providers: [ProductsService, VariantsService, DiscoveryService, CatalogResolver],
  exports: [ProductsService, DiscoveryService],
})
export class ProductsModule {}
