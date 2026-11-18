export interface SuccessResponse<T> {
  success: true;
  data: T | Record<string, never>;
  message: string;
}

export interface ErrorResponse {
  success: false;
  data: null;
  message: string;
  errors: unknown;
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
