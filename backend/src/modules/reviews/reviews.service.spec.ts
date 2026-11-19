import { BadRequestException, ConflictException } from '@nestjs/common';
import { MAX_REVIEW_IMAGES, ReviewsService } from './reviews.service.js';

function setup({ delivered = true, exists = false, auto = true } = {}) {
  const reviews = {
    existsForUser: vi.fn().mockResolvedValue(exists),
    create: vi.fn().mockImplementation((data: object) => Promise.resolve({ id: 'r1', ...data })),
  };
  const products = { findPublicById: vi.fn().mockResolvedValue({ id: 'p1' }) };
  const orders = { findDeliveredWithProduct: vi.fn().mockResolvedValue(delivered ? { id: 'o1' } : null) };
  const settings = { getBool: vi.fn().mockResolvedValue(auto) };
  const storage = {
    uploadFiles: vi.fn().mockImplementation((files: unknown[]) =>
      Promise.resolve(files.map((_, i) => ({ key: `reviews/${i}.jpg`, url: `https://cdn/reviews/${i}.jpg` }))),
    ),
    deleteFiles: vi.fn().mockResolvedValue(undefined),
  };
  const svc = new ReviewsService(
    reviews as never,
    products as never,
    orders as never,
    {} as never,
    {} as never,
    settings as never,
    storage as never,
  );
  return { svc, reviews, storage };
}

const photo = { originalname: 'a.jpg' } as Express.Multer.File;

describe('ReviewsService.create', () => {
  it('lets a customer who has not bought the piece review it, without the verified badge', async () => {
    const { svc, reviews } = setup({ delivered: false });
    await svc.create('u1', 'p1', { rating: 5 });
    expect(reviews.create).toHaveBeenCalledWith(expect.objectContaining({ orderId: null }));
  });

  it('409s on a second review', async () => {
    await expect(setup({ exists: true }).svc.create('u1', 'p1', { rating: 5 })).rejects.toThrow(ConflictException);
  });

  it('links the delivered order and publishes at once unless reviews are checked first', async () => {
    const live = setup();
    await live.svc.create('u1', 'p1', { rating: 4, comment: 'Good' });
    expect(live.reviews.create).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'o1', isApproved: true }));
    const checked = setup({ auto: false });
    await checked.svc.create('u1', 'p1', { rating: 4 });
    expect(checked.reviews.create).toHaveBeenCalledWith(expect.objectContaining({ isApproved: false }));
  });

  it('stores photos and saves their URLs', async () => {
    const { svc, reviews, storage } = setup();
    await svc.create('u1', 'p1', { rating: 5 }, [photo, photo]);
    expect(storage.uploadFiles).toHaveBeenCalledWith([photo, photo], 'reviews');
    expect(reviews.create).toHaveBeenCalledWith(
      expect.objectContaining({ images: ['https://cdn/reviews/0.jpg', 'https://cdn/reviews/1.jpg'] }),
    );
  });

  it('refuses more photos than allowed', async () => {
    const files = Array.from({ length: MAX_REVIEW_IMAGES + 1 }, () => photo);
    await expect(setup().svc.create('u1', 'p1', { rating: 5 }, files)).rejects.toThrow(BadRequestException);
  });

  it('removes uploaded photos when saving the review fails', async () => {
    const { svc, reviews, storage } = setup();
    reviews.create.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.create('u1', 'p1', { rating: 5 }, [photo])).rejects.toThrow('db down');
    expect(storage.deleteFiles).toHaveBeenCalledWith(['reviews/0.jpg']);
  });
});
