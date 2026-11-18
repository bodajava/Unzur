import { BadRequestException } from '@nestjs/common';
import { DiscoveryService } from './discovery.service.js';

const card = (id: string) => ({ id, name: id, slug: id, images: [] });

function setup() {
  const products = {
    findPublicById: vi.fn().mockResolvedValue({ id: 'p1', categoryId: 'c1', stock: 0 }),
    findCoPurchasedIds: vi.fn().mockResolvedValue(['p2']),
    findCardsByIds: vi.fn().mockImplementation((ids: string[]) => Promise.resolve(ids.map(card))),
    findCards: vi.fn().mockResolvedValue([card('p2'), card('p3')]),
    suggest: vi.fn().mockResolvedValue([]),
  };
  const variants = { hasStock: vi.fn().mockResolvedValue(false), findById: vi.fn() };
  const notifications = { findPending: vi.fn().mockResolvedValue(null), create: vi.fn() };
  const service = new DiscoveryService(
    products as never,
    variants as never,
    {} as never,
    {} as never,
    notifications as never,
    {} as never,
  );
  return { service, products, variants, notifications };
}

describe('DiscoveryService', () => {
  it('fills recommendations without duplicates and labels the reason', async () => {
    const { service } = setup();
    const result = await service.recommendations('p1');
    expect(result.map((r) => [r.id, r.reason])).toEqual([
      ['p2', 'bought_together'],
      ['p3', 'same_category'],
    ]);
  });

  it('rejects notify-me while any active variant is in stock', async () => {
    const { service, variants } = setup();
    variants.hasStock.mockResolvedValue(true);
    await expect(service.notifyMe('p1', { email: 'a@b.com' })).rejects.toThrow(BadRequestException);
  });

  it('does not create a second pending alert for the same email', async () => {
    const { service, notifications } = setup();
    notifications.findPending.mockResolvedValue({ id: 'n1' });
    await expect(service.notifyMe('p1', { email: 'a@b.com' })).resolves.toEqual({
      subscribed: true,
      alreadySubscribed: true,
    });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('returns [] for an empty query without hitting the database', async () => {
    const { service, products } = setup();
    expect(await service.suggest('   ')).toEqual([]);
    expect(products.suggest).not.toHaveBeenCalled();
  });
});
