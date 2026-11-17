import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../../graphql/models/pagination.model.js';
import { ProductCardModel } from '../../products/entities/catalog.model.js';

@ObjectType('WishlistItem')
export class WishlistItemModel {
  @Field(() => ID) id: string;
  @Field(() => ID) productId: string;
  @Field() addedAt: Date;
  @Field(() => ProductCardModel) product: ProductCardModel;
  /** Product still on sale (active) */
  @Field() isAvailable: boolean;
  /** Product or one of its active variants has stock (live) */
  @Field() inStock: boolean;
}

@ObjectType('WishlistPage')
export class WishlistPageModel extends Paginated(WishlistItemModel) {}

@ObjectType('WishlistChange')
export class WishlistChangeModel {
  @Field(() => ID) productId: string;
  @Field() inWishlist: boolean;
  /** false when nothing changed (already there / not there) */
  @Field() changed: boolean;
}
