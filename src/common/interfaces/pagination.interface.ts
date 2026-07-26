export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  _links: {
    self: string;
    next: string | null;
    prev: string | null;
  };
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  limit?: number;
  q?: string;
}

export function buildPaginationLinks(
  basePath: string,
  page: number,
  pageSize: number,
  totalPages: number,
): {
  self: string;
  next: string | null;
  prev: string | null;
} {
  const self = `${basePath}?page=${page}&pageSize=${pageSize}`;
  const next = page < totalPages ? `${basePath}?page=${page + 1}&pageSize=${pageSize}` : null;
  const prev = page > 1 ? `${basePath}?page=${page - 1}&pageSize=${pageSize}` : null;

  return { self, next, prev };
}
