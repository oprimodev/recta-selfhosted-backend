import { prisma } from '../../shared/db/prisma.js';
import { NotFoundError, ConflictError, CategoryInUseError } from '../../shared/errors/index.js';
import { toCustomCategoryName } from '../../shared/utils/categoryHelpers.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  ListCategoriesQuery,
} from './categories.schema.js';

/**
 * Create a custom category
 */
export async function createCategory(input: CreateCategoryInput) {
  const existing = await prisma.category.findFirst({
    where: {
      householdId: input.householdId!,
      name: input.name,
      type: input.type,
    },
  });

  if (existing) {
    throw new ConflictError('Category with this name and type already exists');
  }

  return await prisma.category.create({
    data: {
      householdId: input.householdId!,
      name: input.name,
      type: input.type,
      icon: input.icon ?? undefined,
      color: input.color ?? undefined,
    },
  });
}

/**
 * Get custom category by ID (must belong to household)
 */
export async function getCategory(categoryId: string, householdId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, householdId },
  });

  if (!category) {
    throw new NotFoundError('Category');
  }

  return category;
}

/**
 * Find custom category by ID only (used by GET /:id to resolve householdId for auth)
 */
export async function findCategoryById(categoryId: string) {
  return prisma.category.findUnique({
    where: { id: categoryId },
  });
}

/**
 * List custom categories for a household
 */
export async function listCategories(query: ListCategoriesQuery) {
  const { householdId, type } = query;

  const categories = await prisma.category.findMany({
    where: {
      householdId: householdId!,
      ...(type && { type }),
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  return categories;
}

/**
 * Update custom category
 */
export async function updateCategory(
  categoryId: string,
  householdId: string,
  input: UpdateCategoryInput
) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, householdId },
  });

  if (!category) {
    throw new NotFoundError('Category');
  }

  if (input.name && input.name !== category.name) {
    const existing = await prisma.category.findFirst({
      where: {
        householdId,
        name: input.name,
        type: category.type,
        id: { not: categoryId },
      },
    });
    if (existing) {
      throw new ConflictError('Category with this name and type already exists');
    }
  }

  return await prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(input.name != null && { name: input.name }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });
}

/**
 * Delete custom category only if not used in transactions, budgets, or recurring
 */
export async function deleteCategory(categoryId: string, householdId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, householdId },
  });

  if (!category) {
    throw new NotFoundError('Category');
  }

  const customName = toCustomCategoryName(categoryId);

  const [txCount, budgetCount, recCount] = await Promise.all([
    prisma.transaction.count({ where: { householdId, categoryName: customName } }),
    prisma.budget.count({ where: { householdId, categoryName: customName } }),
    prisma.recurringTransaction.count({ where: { householdId, categoryName: customName } }),
  ]);

  if (txCount > 0 || budgetCount > 0 || recCount > 0) {
    throw new CategoryInUseError('Category is in use');
  }

  await prisma.category.delete({
    where: { id: categoryId },
  });
}
