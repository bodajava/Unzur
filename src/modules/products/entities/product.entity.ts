import type {
  ProductAdminRow,
  ProductCardRow,
  ProductDetailRow,
  ProductSuggestRow,
} from '../../../models/schemas/product.schema.js';
import type { RatingSummary } from '../../../models/schemas/review.schema.js';

type PrimaryImage = ProductCardRow['images'][number] | null;

/** Public list item. Never contains costPrice / deletedAt. */
export type ProductCard = Omit<ProductCardRow, 'images'> & { primaryImage: PrimaryImage };

export type ProductDetail = ProductDetailRow &
  RatingSummary & { relatedProducts: ProductCard[] };

export interface StockStats {
  productStock: number;
  /** Sum over active variants */
  variantStock: number;
  totalStock: number;
  activeVariants: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

export type AdminProduct = ProductAdminRow & { stockStats: StockStats };

export type ProductSuggestion = Omit<ProductSuggestRow, 'images'> & { primaryImage: PrimaryImage };

export type RecommendationReason = 'bought_together' | 'same_category' | 'featured';

export type Recommendation = ProductCard & { reason: RecommendationReason };

export function toCard(row: ProductCardRow): ProductCard {
  const { images, ...rest } = row;
  return { ...rest, primaryImage: images[0] ?? null };
}

export function toSuggestion(row: ProductSuggestRow): ProductSuggestion {
  const { images, ...rest } = row;
  return { ...rest, primaryImage: images[0] ?? null };
}

export function withStockStats(row: ProductAdminRow): AdminProduct {
  const active = row.variants.filter((v) => v.isActive);
  const variantStock = active.reduce((sum, v) => sum + v.stock, 0);
  const totalStock = row.stock + variantStock;
  return {
    ...row,
    stockStats: {
      productStock: row.stock,
      variantStock,
      totalStock,
      activeVariants: active.length,
      isLowStock: totalStock > 0 && totalStock <= row.lowStockThreshold,
      isOutOfStock: totalStock <= 0,
    },
  };
}
