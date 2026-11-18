import { BadRequestException, NotFoundException } from '@nestjs/common';
import { priceCartLines } from './cart-pricing.js';
import { CartService } from './cart.service.js';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    cartId: 'cart1',
    productId: 'p1',
    variantId: null,
    quantity: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: {
      id: 'p1',
      name: 'Coffee',
      slug: 'coffee',
      basePrice: 10_000,
      salePrice: 8_000,
      stock: 5,
      isActive: true,
      deletedAt: null,
      images: [],
    },
    variant: null,
    ...overrides,
  } as never;
}

describe('priceCartLines', () => {
  it('uses the sale price, the variant price when chosen, and skips unavailable lines', () => {
    const variantLine = row({
      id: 'i2',
      variantId: 'v1',
      quantity: 1,
      variant: { id: 'v1', name: '1kg', sku: 'K', price: 30_000, salePrice: null, stock: 0, isActive: true, attributes: null },
    });
    const gone = row({ id: 'i3', product: { ...(row() as { product: object }).product, deletedAt: new Date() } });
    const { lines, subtotal, itemCount, issues } = priceCartLines([row(), variantLine, gone]);

    expect(lines.map((l) => [l.unitPrice, l.lineTotal])).toEqual([[8_000, 16_000], [30_000, 30_000], [8_000, 16_000]]);
    expect(subtotal).toBe(46_000); // deleted product excluded
    expect(itemCount).toBe(5);
    expect(lines[1]).toMatchObject({ inStock: false, hasEnoughStock: false });
    expect(issues).toHaveLength(2);
  });
});

function setup() {
  const carts = { findByOwner: vi.fn().mockResolvedValue({ id: 'cart1' }), findDetailByOwner: vi.fn() };
  const cartItems = { findInCart: vi.fn().mockResolvedValue(null), updateById: vi.fn(), delete: vi.fn() };
  const products = { findPublicById: vi.fn().mockResolvedValue({ id: 'p1', stock: 3, categoryId: 'c' }) };
  const variants = { exists: vi.fn().mockResolvedValue(false), findById: vi.fn() };
  const service = new CartService(
    carts as never,
    cartItems as never,
    products as never,
    variants as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, carts, cartItems, variants };
}

describe('CartService', () => {
  it("404s on another actor's cart item (ownership check)", async () => {
    const { service, cartItems } = setup();
    await expect(service.updateItem({ guestId: 'guest_x' }, 'i9', { quantity: 1 })).rejects.toThrow(NotFoundException);
    expect(cartItems.findInCart).toHaveBeenCalledWith('i9', 'cart1');
    expect(cartItems.updateById).not.toHaveBeenCalled();
  });

  it('rejects a quantity above the stock', async () => {
    const { service, cartItems } = setup();
    cartItems.findInCart.mockResolvedValue({ id: 'i1', productId: 'p1', variantId: null, quantity: 1 });
    await expect(service.updateItem({ guestId: 'guest_x' }, 'i1', { quantity: 4 })).rejects.toThrow(
      new BadRequestException('Only 3 left in stock'),
    );
  });

  it('requires a variant when the product has active variants', async () => {
    const { service, cartItems, variants } = setup();
    cartItems.findInCart.mockResolvedValue({ id: 'i1', productId: 'p1', variantId: null, quantity: 1 });
    variants.exists.mockResolvedValue(true);
    await expect(service.updateItem({ userId: 'u1' }, 'i1', { quantity: 1 })).rejects.toThrow('Please choose a variant');
  });
});
