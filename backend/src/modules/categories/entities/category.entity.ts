import type { CategoryNode, CategoryPublic } from '../../../models/schemas/category.schema.js';

export type { CategoryNode };

export interface CategoryDetail extends CategoryPublic {
  parent: Pick<CategoryPublic, 'id' | 'name' | 'slug'> | null;
  children: CategoryPublic[];
}

/**
 * Builds the tree from a flat list. A category whose parent is not in the
 * list (hidden or deleted) is dropped together with its sub-tree.
 */
export function buildCategoryTree(rows: CategoryPublic[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    if (!node.parentId) roots.push(node);
    else nodes.get(node.parentId)?.children.push(node);
  }
  return roots;
}
