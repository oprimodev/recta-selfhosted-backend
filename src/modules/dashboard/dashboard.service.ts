import { prisma } from '../../shared/db/prisma.js';
import { parseMonthFilter } from '../../shared/utils/pagination.js';
import { AccountType, TransactionType, CategoryType, getCategoriesByType, getCategoryColor, CATEGORY_NAME_DISPLAY } from '../../shared/enums/index.js';
import { isCustomCategoryName, toCustomCategoryName } from '../../shared/utils/categoryHelpers.js';
import type {
  DashboardOverviewQuery,
  DashboardOverviewResponse,
  DashboardSummary,
  DashboardTrend,
  DashboardForecast,
  CategoryBreakdown,
  MonthlyComparisonItem,
  BalanceEvolutionItem,
  FixedVsVariable,
  BudgetVsRealized,
  DashboardHeatmapDay,
} from './dashboard.schema.js';

/**
 * Get complete dashboard overview with all aggregated data
 */
export async function getDashboardOverview(query: DashboardOverviewQuery): Promise<DashboardOverviewResponse> {
  const { householdId, month } = query;
  const { start: monthStart, end: monthEnd } = parseMonthFilter(month);

  // Calculate previous month for trends
  const [year, monthNum] = month.split('-').map(Number);
  const prevMonth = monthNum === 1 
    ? `${year - 1}-12` 
    : `${year}-${String(monthNum - 1).padStart(2, '0')}`;
  const { start: prevMonthStart, end: prevMonthEnd } = parseMonthFilter(prevMonth);

  // Get credit card IDs to exclude
  const creditCardAccounts = await prisma.account.findMany({
    where: { householdId, type: AccountType.CREDIT, isActive: true },
    select: { id: true },
  });
  const creditCardIds = new Set(creditCardAccounts.map(a => a.id));

  // Fetch all data in parallel
  const [
    currentMonthTransactions,
    previousMonthTransactions,
    budgets,
    recurringTransactionsRaw,
    last6MonthsData,
    last12MonthsData,
  ] = await Promise.all([
    // Current month transactions
    prisma.transaction.findMany({
      where: {
        householdId,
        date: { gte: monthStart, lte: monthEnd },
      },
      include: {
        account: { select: { type: true } },
      },
    }),
    // Previous month transactions
    prisma.transaction.findMany({
      where: {
        householdId,
        date: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      include: {
        account: { select: { type: true } },
      },
    }),
    // Budgets for current month
    prisma.budget.findMany({
      where: {
        householdId,
        month: { gte: monthStart, lte: monthEnd },
      },
    }),
    // Recurring transactions (active)
    prisma.recurringTransaction.findMany({
      where: { householdId, isActive: true },
      include: {
        account: { select: { type: true } },
      },
    }),
    // Last 6 months aggregated data for comparison
    getMonthlyAggregates(householdId, 6, month, creditCardIds),
    // Last 12 months aggregated data for balance evolution
    getMonthlyAggregates(householdId, 12, month, creditCardIds),
  ]);

  // Infer transaction type from category for recurring transactions
  const incomeCategories = getCategoriesByType(CategoryType.INCOME);
  const recurringTransactions = recurringTransactionsRaw.map(rt => ({
    ...rt,
    type: incomeCategories.includes(rt.categoryName as any) 
      ? TransactionType.INCOME 
      : TransactionType.EXPENSE,
  }));

  // Calculate summary
  const summary = calculateSummary(currentMonthTransactions, creditCardIds);
  const previousSummary = calculateSummary(previousMonthTransactions, creditCardIds);

  // Calculate trend
  const trend = calculateTrend(summary, previousSummary);

  // Calculate forecast (based on last month + recurring)
  const forecast = calculateForecast(previousSummary, recurringTransactions, creditCardIds);

  // Calculate category breakdown
  const categoryBreakdown = calculateCategoryBreakdown(currentMonthTransactions, creditCardIds);

  // Monthly comparison (last 6 months)
  const monthlyComparison = formatMonthlyComparison(last6MonthsData);

  // Balance evolution (last 12 months)
  const balanceEvolution = formatBalanceEvolution(last12MonthsData);

  // Fixed vs Variable
  const fixedVsVariable = calculateFixedVsVariable(
    currentMonthTransactions,
    recurringTransactions,
    creditCardIds
  );

  // Budget vs Realized
  const budgetVsRealized = calculateBudgetVsRealized(
    budgets,
    currentMonthTransactions,
    summary,
    creditCardIds
  );

  // Heatmap (daily spending)
  const heatmap = await getHeatmapData(householdId, month, creditCardIds);

  return {
    summary,
    trend,
    forecast,
    categoryBreakdown,
    monthlyComparison,
    balanceEvolution,
    fixedVsVariable,
    budgetVsRealized,
    heatmap,
  };
}

/**
 * Calculate income/expense summary from transactions
 */
function calculateSummary(
  transactions: Array<{
    type: string;
    amount: { toNumber: () => number } | number;
    accountId: string | null;
    account: { type: string } | null;
  }>,
  creditCardIds: Set<string>
): DashboardSummary {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of transactions) {
    // Exclude transfers and allocations
    if (t.type === TransactionType.TRANSFER || t.type === TransactionType.ALLOCATION) {
      continue;
    }

    // Exclude credit card transactions
    if (t.accountId && creditCardIds.has(t.accountId)) {
      continue;
    }
    if (t.account && t.account.type === AccountType.CREDIT) {
      continue;
    }

    const amount = typeof t.amount === 'number' ? t.amount : t.amount.toNumber();

    if (t.type === TransactionType.INCOME) {
      totalIncome += amount;
    } else if (t.type === TransactionType.EXPENSE) {
      totalExpense += Math.abs(amount);
    }
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}

/**
 * Calculate trend comparing current and previous month
 */
function calculateTrend(current: DashboardSummary, previous: DashboardSummary): DashboardTrend {
  const incomeChange = previous.totalIncome > 0
    ? ((current.totalIncome - previous.totalIncome) / previous.totalIncome) * 100
    : (current.totalIncome > 0 ? 100 : 0);

  const expenseChange = previous.totalExpense > 0
    ? ((current.totalExpense - previous.totalExpense) / previous.totalExpense) * 100
    : (current.totalExpense > 0 ? 100 : 0);

  const previousBalance = previous.totalIncome - previous.totalExpense;
  const currentBalance = current.totalIncome - current.totalExpense;
  const balanceChange = previousBalance !== 0
    ? ((currentBalance - previousBalance) / Math.abs(previousBalance)) * 100
    : (currentBalance !== 0 ? (currentBalance > 0 ? 100 : -100) : 0);

  return {
    incomeChange,
    expenseChange,
    balanceChange,
    incomeTrend: incomeChange > 0 ? 'up' : incomeChange < 0 ? 'down' : 'stable',
    expenseTrend: expenseChange > 0 ? 'up' : expenseChange < 0 ? 'down' : 'stable',
  };
}

/**
 * Calculate forecast for next month
 */
function calculateForecast(
  previousSummary: DashboardSummary,
  recurringTransactions: Array<{
    type: string;
    amount: { toNumber: () => number } | number;
    accountId: string | null;
    account: { type: string } | null;
  }>,
  creditCardIds: Set<string>
): DashboardForecast {
  // Base prediction on previous month
  let predictedIncome = previousSummary.totalIncome;
  let predictedExpense = previousSummary.totalExpense;

  // Add recurring transactions (filtering out credit cards)
  for (const rt of recurringTransactions) {
    if (rt.accountId && creditCardIds.has(rt.accountId)) continue;
    if (rt.account && rt.account.type === AccountType.CREDIT) continue;

    const amount = typeof rt.amount === 'number' ? rt.amount : rt.amount.toNumber();

    if (rt.type === TransactionType.INCOME) {
      predictedIncome += amount;
    } else if (rt.type === TransactionType.EXPENSE) {
      predictedExpense += Math.abs(amount);
    }
  }

  return {
    predictedIncome,
    predictedExpense,
    predictedBalance: predictedIncome - predictedExpense,
  };
}

/**
 * Calculate spending by category
 */
function calculateCategoryBreakdown(
  transactions: Array<{
    type: string;
    amount: { toNumber: () => number } | number;
    categoryName: string | null;
    accountId: string | null;
    account: { type: string } | null;
  }>,
  creditCardIds: Set<string>
): CategoryBreakdown[] {
  const categoryMap = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    if (!t.categoryName) continue;
    if (t.type === TransactionType.TRANSFER || t.type === TransactionType.ALLOCATION) continue;
    if (t.accountId && creditCardIds.has(t.accountId)) continue;
    if (t.account && t.account.type === AccountType.CREDIT) continue;

    const amount = typeof t.amount === 'number' ? t.amount : t.amount.toNumber();
    
    if (!categoryMap.has(t.categoryName)) {
      categoryMap.set(t.categoryName, { income: 0, expense: 0 });
    }

    const cat = categoryMap.get(t.categoryName)!;
    if (t.type === TransactionType.INCOME) {
      cat.income += amount;
    } else if (t.type === TransactionType.EXPENSE) {
      cat.expense += Math.abs(amount);
    }
  }

  return Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      name,
      income: data.income,
      expense: data.expense,
      total: data.income - data.expense,
    }))
    .filter(c => c.income !== 0 || c.expense !== 0)
    .sort((a, b) => b.expense - a.expense);
}

/**
 * Get monthly aggregated data for the last N months
 */
async function getMonthlyAggregates(
  householdId: string,
  months: number,
  currentMonth: string,
  creditCardIds: Set<string>
): Promise<Array<{ month: string; income: number; expense: number }>> {
  const [year, monthNum] = currentMonth.split('-').map(Number);
  const results: Array<{ month: string; income: number; expense: number }> = [];

  // Start from (months-1) months ago to include current month
  for (let i = months - 1; i >= 0; i--) {
    let targetYear = year;
    let targetMonth = monthNum - i;

    while (targetMonth <= 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    const monthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const { start, end } = parseMonthFilter(monthStr);

    const transactions = await prisma.transaction.findMany({
      where: {
        householdId,
        date: { gte: start, lte: end },
        NOT: {
          accountId: { in: Array.from(creditCardIds) },
        },
      },
      select: {
        type: true,
        amount: true,
      },
    });

    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      if (t.type === TransactionType.TRANSFER || t.type === TransactionType.ALLOCATION) continue;
      
      const amount = t.amount.toNumber();
      if (t.type === TransactionType.INCOME) {
        income += amount;
      } else if (t.type === TransactionType.EXPENSE) {
        expense += Math.abs(amount);
      }
    }

    results.push({
      month: monthStr,
      income,
      expense,
    });
  }

  return results;
}

/**
 * Format monthly comparison data
 */
function formatMonthlyComparison(
  data: Array<{ month: string; income: number; expense: number }>
): MonthlyComparisonItem[] {
  return data.map(d => ({
    month: formatMonthLabel(d.month),
    income: d.income,
    expense: d.expense,
  }));
}

/**
 * Format balance evolution data
 */
function formatBalanceEvolution(
  data: Array<{ month: string; income: number; expense: number }>
): BalanceEvolutionItem[] {
  let runningBalance = 0;
  return data.map(d => {
    runningBalance += d.income - d.expense;
    return {
      month: formatMonthLabel(d.month),
      balance: runningBalance,
    };
  });
}

/**
 * Format month string to short label (e.g., "2024-01" -> "Jan")
 */
function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 1);
  return date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
}

/**
 * Calculate fixed vs variable expenses
 */
function calculateFixedVsVariable(
  transactions: Array<{
    type: string;
    amount: { toNumber: () => number } | number;
    accountId: string | null;
    account: { type: string } | null;
    recurringTransactionId: string | null;
  }>,
  recurringTransactions: Array<{ id: string }>,
  creditCardIds: Set<string>
): FixedVsVariable {
  const recurringIds = new Set(recurringTransactions.map(rt => rt.id));
  
  let fixed = 0;
  let variable = 0;

  for (const t of transactions) {
    if (t.type !== TransactionType.EXPENSE) continue;
    if (t.accountId && creditCardIds.has(t.accountId)) continue;
    if (t.account && t.account.type === AccountType.CREDIT) continue;

    const amount = Math.abs(typeof t.amount === 'number' ? t.amount : t.amount.toNumber());

    // If transaction is linked to a recurring transaction, it's fixed
    if (t.recurringTransactionId && recurringIds.has(t.recurringTransactionId)) {
      fixed += amount;
    } else {
      variable += amount;
    }
  }

  const total = fixed + variable;
  return {
    fixed,
    variable,
    fixedPercentage: total > 0 ? (fixed / total) * 100 : 0,
    variablePercentage: total > 0 ? (variable / total) * 100 : 0,
  };
}

/**
 * Calculate budget vs realized
 */
function calculateBudgetVsRealized(
  budgets: Array<{
    categoryName: string;
    type: string;
    monthlyLimit: { toNumber: () => number } | number;
  }>,
  transactions: Array<{
    type: string;
    amount: { toNumber: () => number } | number;
    categoryName: string | null;
    accountId: string | null;
    account: { type: string } | null;
  }>,
  summary: DashboardSummary,
  creditCardIds: Set<string>
): BudgetVsRealized[] {
  // Calculate spending by category
  const categorySpending = new Map<string, number>();
  const categoryIncome = new Map<string, number>();

  for (const t of transactions) {
    if (!t.categoryName) continue;
    if (t.type === TransactionType.TRANSFER || t.type === TransactionType.ALLOCATION) continue;
    if (t.accountId && creditCardIds.has(t.accountId)) continue;
    if (t.account && t.account.type === AccountType.CREDIT) continue;

    const amount = Math.abs(typeof t.amount === 'number' ? t.amount : t.amount.toNumber());

    if (t.type === TransactionType.EXPENSE) {
      categorySpending.set(t.categoryName, (categorySpending.get(t.categoryName) || 0) + amount);
    } else if (t.type === TransactionType.INCOME) {
      categoryIncome.set(t.categoryName, (categoryIncome.get(t.categoryName) || 0) + amount);
    }
  }

  return budgets.map(budget => {
    const budgeted = typeof budget.monthlyLimit === 'number' ? budget.monthlyLimit : budget.monthlyLimit.toNumber();
    const isExpenseBudget = budget.type === CategoryType.EXPENSE || budget.type === 'EXPENSE';
    let spent: number;

    if (budget.categoryName === 'Geral') {
      // General budget - use total
      spent = isExpenseBudget ? summary.totalExpense : summary.totalIncome;
    } else {
      spent = isExpenseBudget
        ? (categorySpending.get(budget.categoryName) || 0)
        : (categoryIncome.get(budget.categoryName) || 0);
    }

    const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
    const remaining = budgeted - spent;
    const status: 'ok' | 'warning' | 'exceeded' = 
      percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok';

    return {
      category: budget.categoryName,
      type: (isExpenseBudget ? 'EXPENSE' : 'INCOME') as 'INCOME' | 'EXPENSE',
      budgeted,
      spent,
      remaining,
      percentage: Math.min(percentage, 1000), // Cap at 1000%
      status,
    };
  }).sort((a, b) => {
    // Sort: exceeded first, then warning, then ok
    const statusOrder = { exceeded: 0, warning: 1, ok: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return b.percentage - a.percentage;
  });
}

/**
 * Get heatmap data for daily spending
 */
async function getHeatmapData(
  householdId: string,
  month: string,
  creditCardIds: Set<string>
): Promise<{ month: string; data: DashboardHeatmapDay[]; total: number; daysInMonth: number }> {
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const creditCardIdsArray = Array.from(creditCardIds);

  // Use raw SQL for efficient aggregation
  const dailySpending = await prisma.$queryRaw<Array<{ day: number; amount: string }>>`
    SELECT 
      EXTRACT(DAY FROM date)::integer as day,
      SUM(ABS(amount))::text as amount
    FROM "transactions"
    WHERE "household_id" = ${householdId}::uuid
      AND date >= ${monthStart}
      AND date <= ${monthEnd}
      AND type = 'EXPENSE'
      AND (
        "account_id" IS NULL 
        OR "account_id" NOT IN (SELECT unnest(${creditCardIdsArray}::uuid[]))
      )
    GROUP BY EXTRACT(DAY FROM date)
    ORDER BY day
  `;

  const spendingMap = new Map<number, number>();
  for (const row of dailySpending) {
    spendingMap.set(row.day, parseFloat(row.amount));
  }

  const data: DashboardHeatmapDay[] = [];
  let total = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const amount = spendingMap.get(day) || 0;
    data.push({ day, amount });
    total += amount;
  }

  return { month, data, total, daysInMonth };
}
