import { z } from 'zod';
import { CategoryName, CategoryType } from '../../shared/enums/index.js';

/**
 * Category type enum (INCOME or EXPENSE only for custom)
 */
export const categoryTypeEnum = z.nativeEnum(CategoryType);

/**
 * categoryName: system enum value OR "CUSTOM:<uuid>"
 * Used in Transaction, Budget, RecurringTransaction
 */
export const categoryNameSchema = z.union([
  z.nativeEnum(CategoryName),
  z.string().regex(/^CUSTOM:[0-9a-f-]{36}$/i, 'Invalid custom category id'),
]);
export type CategoryNameInput = z.infer<typeof categoryNameSchema>;

/**
 * Create custom category
 */
export const createCategorySchema = z.object({
  householdId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  type: categoryTypeEnum,
  icon: z.string().max(50).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional().nullable(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/**
 * Update custom category (name, icon, color only; type is immutable)
 */
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').nullable().optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryIdParamSchema = z.object({
  categoryId: z.string().uuid(),
});
export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;

/**
 * List categories: householdId (optional, defaults to personal), type (optional)
 */
export const listCategoriesQuerySchema = z.object({
  householdId: z.string().uuid().optional(),
  type: categoryTypeEnum.optional(),
});
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
