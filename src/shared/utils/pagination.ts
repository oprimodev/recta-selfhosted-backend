import { z } from 'zod';

/**
 * Pagination query schema for cursor-based pagination
 */
export const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T extends { id: string }>(
  items: T[],
  limit: number,
  total?: number
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasMore,
      ...(total !== undefined && { total }),
    },
  };
}

/**
 * Build Prisma pagination args for cursor-based pagination
 */
export function buildPaginationArgs(params: PaginationQuery) {
  const { cursor, limit } = params;

  return {
    take: limit + 1, // Take one extra to check if there are more
    ...(cursor && {
      skip: 1, // Skip the cursor item
      cursor: { id: cursor },
    }),
  };
}

/**
 * Month filter schema (YYYY-MM format)
 */
export const monthFilterSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format')
    .optional(),
});

/**
 * Parse month string to date range
 */
export function parseMonthFilter(month: string): { start: Date; end: Date } {
  const [year, monthNum] = month.split('-').map(Number);
  const start = new Date(year!, monthNum! - 1, 1);
  const end = new Date(year!, monthNum!, 0, 23, 59, 59, 999);
  return { start, end };
}







