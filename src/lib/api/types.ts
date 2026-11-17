/** Shapes returned by the UNZUR API (money in piasters). */

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
  errors?: unknown;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ImageRef {
  id: string;
  url: string;
  altText: string | null;
}

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  basePrice: number;
  salePrice: number | null;
  stock: number;
  isFeatured: boolean;
  createdAt: string;
  category: { id: string; name: string; slug: string };
  brand: { id: string; name: string; slug: string; logoUrl: string | null } | null;
  primaryImage: ImageRef | null;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  children: CategoryNode[];
}

export interface Suggestion {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  salePrice: number | null;
  primaryImage: ImageRef | null;
}

export interface CartSummary {
  id: string | null;
  guestId: string | null;
  itemCount: number;
  subtotal: number;
}

export interface SubscribeResult {
  email: string;
  subscribed: boolean;
  result: "CREATED" | "REACTIVATED" | "ALREADY_SUBSCRIBED";
}
