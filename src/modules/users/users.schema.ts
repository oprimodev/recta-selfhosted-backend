import { z } from 'zod';

/**
 * Dashboard widget configuration
 */
export const widgetConfigSchema = z.object({
  id: z.enum([
    'creditCards',
    'trends',
    'forecast',
    'savingsGoals',
    'projectedBalance',
    'balanceEvolution',
    'monthlyComparison',
    'insights',
    'budgetVsRealized',
    'fixedVsVariable',
    'dailyCashFlow',
    'spendingHeatmap',
  ]),
  enabled: z.boolean(),
  order: z.number().int().min(0),
});

/**
 * Dashboard preferences
 */
export const dashboardPreferencesSchema = z.object({
  widgets: z.array(widgetConfigSchema),
  updatedAt: z.coerce.date().optional(),
});

/**
 * Update user preferences input
 */
export const updateUserPreferencesSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  isPremium: z.boolean().optional(),
  onboardingCompleted: z.boolean().optional(),
  onboardingRestartedAt: z.coerce.date().optional().nullable(),
  theme: z.enum(['light', 'dark']).optional(),
  baseCurrency: z.string().length(3).optional(),
  locale: z.string().max(10).optional(),
  country: z.string().length(2).optional(),
  referralCode: z.string().max(20).optional(),
  dashboardPreferences: dashboardPreferencesSchema.optional(),
  lastRecurringProcessedMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  lastRecurringProcessedAt: z.coerce.date().optional().nullable(),
});

export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
export type DashboardPreferences = z.infer<typeof dashboardPreferencesSchema>;
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;





