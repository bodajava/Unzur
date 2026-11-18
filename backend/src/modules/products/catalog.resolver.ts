import { BadRequestException } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { CurrentActor, Public } from '../../common/decorators/index.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import type { GqlContext } from '../../common/utilities/execution-context.js';
import { requestMeta } from '../../common/utilities/request-meta.js';
import { BrandsService } from '../brands/brands.service.js';
import { BrandModel } from '../brands/entities/brand.model.js';
import { CategoriesService } from '../categories/categories.service.js';
import { CategoryDetailModel, CategoryNodeModel } from '../categories/entities/category.model.js';
import { DiscoveryService } from './discovery.service.js';
import { ProductQueryDto } from './dto/index.js';
import {
  ProductCardModel,
  ProductDetailModel,
  ProductPageModel,
  ProductSuggestionModel,
} from './entities/catalog.model.js';
import { ProductsService } from './products.service.js';

/** Storefront reads over GraphQL; wraps the same services as REST (no logic here). */
@Public()
@Resolver()
export class CatalogResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly discovery: DiscoveryService,
    private readonly categoriesService: CategoriesService,
    private readonly brandsService: BrandsService,
  ) {}

  @Query(() => ProductPageModel, { description: '2.1 Paginated, filterable product list' })
  products(@Args('filter', { type: () => ProductQueryDto, nullable: true }) filter?: ProductQueryDto) {
    return this.productsService.list(filter ?? new ProductQueryDto());
  }

  @Query(() => ProductDetailModel, { description: '2.2 Product page (records a view)' })
  product(@Args('slug') slug: string, @CurrentActor() actor: Actor, @Context() ctx: GqlContext) {
    return this.productsService.findBySlug(slug, actor, requestMeta(ctx.req).ipAddress);
  }

  @Query(() => [CategoryNodeModel], { description: '2.7 Category tree' })
  categories() {
    return this.categoriesService.tree();
  }

  @Query(() => CategoryDetailModel, { description: '2.8' })
  category(@Args('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Query(() => [BrandModel], { description: '2.10' })
  brands() {
    return this.brandsService.list();
  }

  @Query(() => BrandModel, { description: '2.11 By id or slug' })
  brand(@Args('identifier') identifier: string) {
    return this.brandsService.findOne(identifier);
  }

  @Query(() => [ProductSuggestionModel], { description: '16.1 Search-as-you-type (max 8)' })
  searchSuggest(@Args('q') q: string) {
    if (q.length > 100) throw new BadRequestException('q must be at most 100 characters');
    return this.discovery.suggest(q);
  }

  @Query(() => [ProductCardModel], { description: '16.3 For the user, else the guest' })
  recentlyViewed(@CurrentActor() actor: Actor) {
    return this.discovery.recentlyViewed(actor);
  }
}
