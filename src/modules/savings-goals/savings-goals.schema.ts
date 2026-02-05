import { z } from 'zod';
import { localDateSchema } from '../../shared/utils/dateSchema.js';

/**
 * Create savings goal request
 */
export const createSavingsGoalSchema = z.object({
  householdId: z.string().uuid().optional(), // Optional - will create personal household if not provided
  accountId: z.string().uuid().optional(),
  name: z.string().min(1).max(100).trim(),
  targetAmount: z.coerce.number().positive('Target amount must be positive'),
  currentAmount: z.coerce.number().min(0).default(0),
  targetDate: localDateSchema.optional(),
});

export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;

/**
 * Update savings goal request
 */
export const updateSavingsGoalSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100).trim().optional(),
  targetAmount: z.coerce.number().positive('Target amount must be positive').optional(),
  currentAmount: z.coerce.number().min(0).optional(),
  targetDate: z.coerce.date().nullable().optional(),
});

export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;

/**
 * Add to savings goal
 */
export const addToSavingsGoalSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  description: z.string().max(255).optional(),
});

export type AddToSavingsGoalInput = z.infer<typeof addToSavingsGoalSchema>;

/**
 * Savings goal ID param
 */
export const savingsGoalIdParamSchema = z.object({
  goalId: z.string().uuid(),
});

export type SavingsGoalIdParam = z.infer<typeof savingsGoalIdParamSchema>;

/**
 * List savings goals query
 */
export const listSavingsGoalsQuerySchema = z.object({
  householdId: z.string().uuid().optional(), // Optional - will use personal household if not provided
});

export type ListSavingsGoalsQuery = z.infer<typeof listSavingsGoalsQuerySchema>;

