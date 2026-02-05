import { z } from 'zod';

/**
 * Create transaction split input
 */
export const createTransactionSplitSchema = z.object({
  userId: z.string().uuid(),
  amount: z.coerce.number().positive('Amount must be positive'),
});

export type CreateTransactionSplitInput = z.infer<typeof createTransactionSplitSchema>;

/**
 * Update transaction split input (mark as paid/unpaid)
 */
export const updateTransactionSplitSchema = z.object({
  paid: z.boolean(),
});

export type UpdateTransactionSplitInput = z.infer<typeof updateTransactionSplitSchema>;

/**
 * Bulk create splits for a transaction
 */
export const createTransactionSplitsSchema = z.object({
  splits: z.array(createTransactionSplitSchema).min(1, 'At least one split is required'),
});

export type CreateTransactionSplitsInput = z.infer<typeof createTransactionSplitsSchema>;
