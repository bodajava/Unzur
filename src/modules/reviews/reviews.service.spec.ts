import { ConflictException, ForbiddenException } from '@nestjs/common';
import { NOT_PURCHASED, ReviewsService } from './reviews.service.js';

function setup({ delivered = true, exists = false, auto = false } = {}) {
  const reviews = {
    existsForUser: vi.fn().mockResolvedValue(exists),
    create: vi.fn().mockImplementation((data: object) => Promise.resolve({ id: 'r1', ...data })),
  };
  const products = { findPublicById: vi.fn().mockResolvedValue({ id: 'p1' }) };
  const orders = { findDeliveredWithProduct: vi.fn().mockResolvedValue(delivered ? { id: 'o1' } : null) };
  const settings = { getBool: vi.fn().mockResolvedValue(auto) };
  const svc = new ReviewsService(reviews as never, products as never, orders as never, {} as never, {} as never, settings as never);
  return { svc, reviews };
}

describe('ReviewsService.create', () => {
  it('403s when the user never received the product', async () => {
    await expect(setup({ delivered: false }).svc.create('u1', 'p1', { rating: 5 })).rejects.toThrow(
      new ForbiddenException(NOT_PURCHASED),
    );
  });

  it('409s on a second review', async () => {
    await expect(setup({ exists: true }).svc.create('u1', 'p1', { rating: 5 })).rejects.toThrow(ConflictException);
  });

  it('links the delivered order and waits for moderation unless auto-approve is on', async () => {
    const pending = setup();
    await pending.svc.create('u1', 'p1', { rating: 4, comment: 'Good' });
    expect(pending.reviews.create).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'o1', isApproved: false }));
    const auto = setup({ auto: true });
    await auto.svc.create('u1', 'p1', { rating: 4 });
    expect(auto.reviews.create).toHaveBeenCalledWith(expect.objectContaining({ isApproved: true }));
  });
});
