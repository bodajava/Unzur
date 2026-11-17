import { ConflictException, NotFoundException } from '@nestjs/common';
import { BrandsService } from './brands.service.js';

function setup() {
  const brands = {
    findPublicByIdOrSlug: vi.fn().mockResolvedValue(null),
    findLiveById: vi.fn().mockResolvedValue({ id: 'b1', name: 'Acme', slug: 'acme' }),
  };
  const products = { exists: vi.fn().mockResolvedValue(false) };
  const service = new BrandsService(brands as never, products as never, {} as never, {} as never, {} as never);
  return { service, brands, products };
}

describe('BrandsService', () => {
  it('looks a brand up by id when given a UUID, else by slug', async () => {
    const { service, brands } = setup();
    const id = '8d1b6c1e-1f4a-4a5e-9a8e-2b0f1c3d4e5f';
    await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
    expect(brands.findPublicByIdOrSlug).toHaveBeenLastCalledWith(id, true);
    await expect(service.findOne('acme')).rejects.toThrow(NotFoundException);
    expect(brands.findPublicByIdOrSlug).toHaveBeenLastCalledWith('acme', false);
  });

  it('refuses to delete a brand that live products still use', async () => {
    const { service, products } = setup();
    products.exists.mockResolvedValue(true);
    await expect(service.remove('b1', { actorId: 'admin' })).rejects.toThrow(ConflictException);
  });
});
