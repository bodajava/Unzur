import { Field, ObjectType } from '@nestjs/graphql';
import { JSONScalar } from '../../../graphql/scalars/json.scalar.js';
import { ProductCardModel } from '../../products/entities/catalog.model.js';

@ObjectType('CustomerChatResult')
export class CustomerChatResultModel {
  @Field() reply: string;
  /** Public product cards from our catalog (never from the model's imagination) */
  @Field(() => [ProductCardModel]) recommendedProducts: ProductCardModel[];
  /** "ai" or "data" (built-in answer when no AI key is set or the provider failed) */
  @Field() source: string;
}

@ObjectType('CitedMetric')
export class CitedMetricModel {
  @Field() label: string;
  @Field() value: string;
}

@ObjectType('AdvisorResult')
export class AdvisorResultModel {
  @Field() focus: string;
  @Field() analysis: string;
  /** Raw data and computed findings the analysis is based on */
  @Field(() => JSONScalar) diagnostics: unknown;
  @Field(() => [CitedMetricModel]) citedMetrics: CitedMetricModel[];
  @Field() source: string;
}

@ObjectType('AdminChatResult')
export class AdminChatResultModel {
  @Field() reply: string;
  @Field(() => JSONScalar) dataSnapshot: unknown;
  @Field() source: string;
}
