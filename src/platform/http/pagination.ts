import { z } from "zod";

/** Default and maximum page sizes for bounded list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export function parsePaginationSearchParams(
  searchParams: URLSearchParams | Record<string, string | undefined>,
): PaginationQuery {
  const source =
    searchParams instanceof URLSearchParams
      ? {
          page: searchParams.get("page") ?? undefined,
          pageSize: searchParams.get("pageSize") ?? undefined,
        }
      : searchParams;

  return paginationQuerySchema.parse(source);
}

export function buildPageResult<T>(
  items: T[],
  totalItems: number,
  query: PaginationQuery,
): PageResult<T> {
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages,
  };
}

export function paginationOffset(query: PaginationQuery): number {
  return (query.page - 1) * query.pageSize;
}
