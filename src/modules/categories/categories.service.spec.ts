import { BadRequestException, ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { buildCategoryTree } from './entities/category.entity.js';

const row = (id: string, parentId: string | null = null) => ({
  id,
  name: id,
  slug: id,
  description: null,
  imageUrl: null,
  parentId,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function setup(links: { id: string; parentId: string | null }[] = []) {
  const categories = {
    findLiveById: vi.fn().mockResolvedValue({ ...row('a'), isActive: true, deletedAt: null }),
    findLiveParentLinks: vi.fn().mockResolvedValue(links),
    countLiveChildren: vi.fn().mockResolvedValue(0),
    slugExists: vi.fn().mockResolvedValue(false),
  };
  const products = { countLiveInCategory: vi.fn().mockResolvedValue(0) };
  const service = new CategoriesService(
    categories as never,
    products as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, categories, products };
}

const audit = { actorId: 'admin' };

describe('CategoriesService', () => {
  it('builds a nested tree and drops children of hidden parents', () => {
    const tree = buildCategoryTree([row('root'), row('child', 'root'), row('orphan', 'hidden')]);
    expect(tree.map((n) => n.id)).toEqual(['root']);
    expect(tree[0].children.map((n) => n.id)).toEqual(['child']);
  });

  it('refuses to move a category under its own descendant', async () => {
    const { service } = setup([
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
    ]);
    await expect(service.update('a', { parentId: 'c' }, undefined, audit)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update('a', { parentId: 'a' }, undefined, audit)).rejects.toThrow(
      'A category cannot be its own parent',
    );
  });

  it('refuses to delete a category that still has products', async () => {
    const { service, products } = setup();
    products.countLiveInCategory.mockResolvedValue(3);
    await expect(service.remove('a', audit)).rejects.toThrow(ConflictException);
  });
});
