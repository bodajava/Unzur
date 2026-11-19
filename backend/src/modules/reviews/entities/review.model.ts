import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { PaginationMetaModel } from '../../../graphql/models/pagination.model.js';

@ObjectType('PublicReview')
export class PublicReviewModel {
  @Field(() => ID) id: string;
  @Field(() => Int) rating: number;
  @Field(() => String, { nullable: true }) title: string | null;
  @Field(() => String, { nullable: true }) comment: string | null;
  /** Customer photo URLs */
  @Field(() => [String]) images: string[];
  /** "Mona A." */
  @Field() reviewerName: string;
  @Field() verifiedPurchase: boolean;
  @Field() createdAt: Date;
}

@ObjectType('RatingCount')
export class RatingCountModel {
  @Field(() => Int) stars: number;
  @Field(() => Int) count: number;
}

@ObjectType('RatingSummary')
export class RatingSummaryModel {
  @Field(() => Float, { nullable: true }) averageRating: number | null;
  @Field(() => Int) totalReviews: number;
  /** 5, 4, 3, 2, 1 */
  @Field(() => [RatingCountModel]) breakdown: RatingCountModel[];
}

@ObjectType('ProductReviews')
export class ProductReviewsModel {
  @Field(() => [PublicReviewModel]) items: PublicReviewModel[];
  @Field(() => PaginationMetaModel) meta: PaginationMetaModel;
  @Field(() => RatingSummaryModel) ratingSummary: RatingSummaryModel;
}

@ObjectType('SubmittedReview')
export class SubmittedReviewModel {
  @Field(() => ID) id: string;
  @Field(() => Int) rating: number;
  @Field(() => String, { nullable: true }) title: string | null;
  @Field(() => String, { nullable: true }) comment: string | null;
  /** false until a moderator approves it */
  @Field() isApproved: boolean;
  @Field() createdAt: Date;
}
