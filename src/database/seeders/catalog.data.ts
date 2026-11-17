/** Sample catalog. Prices are in piasters (18.50 EGP = 1850). */
export const CATALOG_SEED = {
  categories: [
    { name: 'Coffee', slug: 'coffee', description: 'Roasted coffee beans and ground coffee' },
    { name: 'Tea', slug: 'tea', description: 'Loose leaf and bagged tea' },
    { name: 'Accessories', slug: 'accessories', description: 'Brewing tools and cups' },
  ],
  brands: [
    { name: 'House Roast', slug: 'house-roast', description: 'Our own small-batch roastery' },
  ],
  products: [
    {
      name: 'قهوة عربية Arabic Coffee',
      slug: 'arabic-coffee',
      sku: 'COF-ARB',
      shortDescription: 'بن محمص فاتح مع هيل',
      description: 'Light roast with cardamom, ground for traditional Arabic coffee.',
      basePrice: 18500,
      stock: 120,
      isFeatured: true,
      category: 'coffee',
      brand: 'house-roast',
      variants: [
        { name: '250g', sku: 'COF-ARB-250', price: 18500, stock: 80 },
        { name: '500g', sku: 'COF-ARB-500', price: 34000, stock: 40 },
      ],
    },
    {
      name: 'Espresso Blend',
      slug: 'espresso-blend',
      sku: 'COF-ESP',
      shortDescription: 'Dark roast, chocolate notes',
      description: 'A dark roast blend made for espresso machines and moka pots.',
      basePrice: 22000,
      salePrice: 19900,
      stock: 60,
      category: 'coffee',
      brand: 'house-roast',
      variants: [],
    },
    {
      name: 'شاي أخضر Green Tea',
      slug: 'green-tea',
      sku: 'TEA-GRN',
      shortDescription: 'شاي أخضر صيني',
      description: 'Chinese sencha green tea, 100g tin.',
      basePrice: 9500,
      stock: 200,
      category: 'tea',
      brand: null,
      variants: [],
    },
  ],
};
