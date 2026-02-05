/**
 * Shared enums for the backend
 * These enums should match the Prisma schema enums
 */

export enum HouseholdRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT = 'CREDIT',
  CASH = 'CASH',
  INVESTMENT = 'INVESTMENT',
}

export enum CategoryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
  ALLOCATION = 'ALLOCATION',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum CategoryName {
  // Income categories
  SALARY = 'SALARY',
  FREELANCE = 'FREELANCE',
  INVESTMENTS = 'INVESTMENTS',
  SALES = 'SALES',
  RENTAL_INCOME = 'RENTAL_INCOME',
  OTHER_INCOME = 'OTHER_INCOME',
  
  // Expense categories
  FOOD = 'FOOD',
  TRANSPORTATION = 'TRANSPORTATION',
  HOUSING = 'HOUSING',
  HEALTHCARE = 'HEALTHCARE',
  EDUCATION = 'EDUCATION',
  ENTERTAINMENT = 'ENTERTAINMENT',
  CLOTHING = 'CLOTHING',
  UTILITIES = 'UTILITIES',
  SUBSCRIPTIONS = 'SUBSCRIPTIONS',
  ONLINE_SHOPPING = 'ONLINE_SHOPPING',
  GROCERIES = 'GROCERIES',
  RESTAURANT = 'RESTAURANT',
  FUEL = 'FUEL',
  PHARMACY = 'PHARMACY',
  OTHER_EXPENSES = 'OTHER_EXPENSES',
  
  // Internal movement categories
  TRANSFER = 'TRANSFER',
  ALLOCATION = 'ALLOCATION',
}

export enum RecurrenceFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

/**
 * Mapping from CategoryName enum to display names (Portuguese)
 * Used for notifications and other server-side messages
 */
export const CATEGORY_NAME_DISPLAY: Record<CategoryName, string> = {
  [CategoryName.SALARY]: 'Salário',
  [CategoryName.FREELANCE]: 'Freelance',
  [CategoryName.INVESTMENTS]: 'Investimentos',
  [CategoryName.SALES]: 'Vendas',
  [CategoryName.RENTAL_INCOME]: 'Aluguel',
  [CategoryName.OTHER_INCOME]: 'Outras Receitas',
  [CategoryName.FOOD]: 'Alimentação',
  [CategoryName.TRANSPORTATION]: 'Transporte',
  [CategoryName.HOUSING]: 'Moradia',
  [CategoryName.HEALTHCARE]: 'Saúde',
  [CategoryName.EDUCATION]: 'Educação',
  [CategoryName.ENTERTAINMENT]: 'Lazer',
  [CategoryName.CLOTHING]: 'Roupas',
  [CategoryName.UTILITIES]: 'Contas',
  [CategoryName.SUBSCRIPTIONS]: 'Assinaturas',
  [CategoryName.ONLINE_SHOPPING]: 'Compras Online',
  [CategoryName.GROCERIES]: 'Supermercado',
  [CategoryName.RESTAURANT]: 'Restaurante',
  [CategoryName.FUEL]: 'Combustível',
  [CategoryName.PHARMACY]: 'Farmácia',
  [CategoryName.OTHER_EXPENSES]: 'Outras Despesas',
  [CategoryName.TRANSFER]: 'Transferência',
  [CategoryName.ALLOCATION]: 'Alocação',
};

/**
 * Get all categories by type
 */
export function getCategoriesByType(type: CategoryType): CategoryName[] {
  if (type === CategoryType.INCOME) {
    return [
      CategoryName.SALARY,
      CategoryName.FREELANCE,
      CategoryName.INVESTMENTS,
      CategoryName.SALES,
      CategoryName.RENTAL_INCOME,
      CategoryName.OTHER_INCOME,
    ];
  }
  return [
    CategoryName.FOOD,
    CategoryName.TRANSPORTATION,
    CategoryName.HOUSING,
    CategoryName.HEALTHCARE,
    CategoryName.EDUCATION,
    CategoryName.ENTERTAINMENT,
    CategoryName.CLOTHING,
    CategoryName.UTILITIES,
    CategoryName.SUBSCRIPTIONS,
    CategoryName.ONLINE_SHOPPING,
    CategoryName.GROCERIES,
    CategoryName.RESTAURANT,
    CategoryName.FUEL,
    CategoryName.PHARMACY,
    CategoryName.OTHER_EXPENSES,
  ];
}

/**
 * Get default categories by type (for backward compatibility)
 */
export function getDefaultCategoriesByType(type: CategoryType): CategoryName[] {
  if (type === CategoryType.INCOME) {
    return [
      CategoryName.SALARY,
      CategoryName.FREELANCE,
      CategoryName.INVESTMENTS,
      CategoryName.OTHER_INCOME,
    ];
  }
  return [
    CategoryName.HOUSING,
    CategoryName.TRANSPORTATION,
    CategoryName.FOOD,
    CategoryName.UTILITIES,
    CategoryName.HEALTHCARE,
    CategoryName.ENTERTAINMENT,
    CategoryName.ONLINE_SHOPPING,
    CategoryName.EDUCATION,
    CategoryName.OTHER_EXPENSES,
  ];
}

/**
 * Get color for category
 */
export function getCategoryColor(categoryName: CategoryName): string {
  const colorMap: Record<CategoryName, string> = {
    // Income categories
    [CategoryName.SALARY]: '#22C55E',
    [CategoryName.FREELANCE]: '#10B981',
    [CategoryName.INVESTMENTS]: '#14B8A6',
    [CategoryName.SALES]: '#06B6D4',
    [CategoryName.RENTAL_INCOME]: '#3B82F6',
    [CategoryName.OTHER_INCOME]: '#6366F1',
    // Expense categories
    [CategoryName.FOOD]: '#F59E0B',
    [CategoryName.TRANSPORTATION]: '#F97316',
    [CategoryName.HOUSING]: '#EF4444',
    [CategoryName.UTILITIES]: '#EAB308',
    [CategoryName.HEALTHCARE]: '#84CC16',
    [CategoryName.ENTERTAINMENT]: '#8B5CF6',
    [CategoryName.ONLINE_SHOPPING]: '#EC4899',
    [CategoryName.EDUCATION]: '#6366F1',
    [CategoryName.CLOTHING]: '#F43F5E',
    [CategoryName.SUBSCRIPTIONS]: '#A855F7',
    [CategoryName.GROCERIES]: '#F59E0B',
    [CategoryName.RESTAURANT]: '#F97316',
    [CategoryName.FUEL]: '#F59E0B',
    [CategoryName.PHARMACY]: '#84CC16',
    [CategoryName.OTHER_EXPENSES]: '#64748B',
    // Internal movement categories
    [CategoryName.TRANSFER]: '#6366F1',
    [CategoryName.ALLOCATION]: '#8B5CF6',
  };
  return colorMap[categoryName] || '#64748B';
}

