import { IsUUID } from 'class-validator';

/** 11.2 POST /wishlist */
export class AddToWishlistDto {
  @IsUUID('4')
  productId: string;
}
