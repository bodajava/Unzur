import type { CartDetailItemRow } from '../../models/schemas/cart.schema.js';
import type { CartLineModel } from './entities/cart.model.js';

/**
 * Pure pricing of cart lines (no I/O), shared by the cart and coupons.
 * Unit price = variant (sale ?? price) when a variant is chosen, else
 * product (sale ?? base). Unavailable lines are excluded from the subtotal.
 */
export function priceCartLines(rows: CartDetailItemRow[]): {
  lines: CartLineModel[];
  subtotal: number;
  itemCount: number;
  issues: string[];
} {
  const issues: string[] = [];
  const lines = rows.map((row): CartLineModel => {
    const { product, variant } = row;
    const originalUnitPrice = variant ? variant.price : product.basePrice;
    const unitPrice = variant ? (variant.salePrice ?? variant.price) : (product.salePrice ?? product.basePrice);
    const availableStock = variant ? variant.stock : product.stock;
    const isAvailable =
      product.isActive && product.deletedAt === null && (variant === null || variant.isActive);
    const hasEnoughStock = row.quantity <= availableStock;

    if (!isAvailable) issues.push(`"${product.name}" is no longer available`);
    else if (availableStock <= 0) issues.push(`"${product.name}" is out of stock`);
    else if (!hasEnoughStock) issues.push(`Only ${availableStock} of "${product.name}" left in stock`);

    return {
      id: row.id,
      productId: row.productId,
      variantId: row.variantId,
      quantity: row.quantity,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        primaryImage: product.images[0] ?? null,
      },
      variant: variant
        ? { id: variant.id, name: variant.name, sku: variant.sku, attributes: variant.attributes }
        : null,
      unitPrice,
      originalUnitPrice,
      lineTotal: unitPrice * row.quantity,
      availableStock,
      isAvailable,
      inStock: availableStock > 0,
      hasEnoughStock,
    };
  });

  const available = lines.filter((l) => l.isAvailable);
  return {
    lines,
    subtotal: available.reduce((sum, l) => sum + l.lineTotal, 0),
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    issues,
  };
}
