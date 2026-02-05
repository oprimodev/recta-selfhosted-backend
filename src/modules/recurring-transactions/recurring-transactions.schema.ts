import { z } from 'zod';
import { RecurrenceFrequency } from '../../shared/enums/index.js';
import { localDateSchema } from '../../shared/utils/dateSchema.js';
import { categoryNameSchema } from '../categories/categories.schema.js';

/**
 * Recurrence frequency enum
 */
export const recurrenceFrequencyEnum = z.nativeEnum(RecurrenceFrequency);

/**
 * Create recurring transaction request
 */
export const createRecurringTransactionSchema = z.object({
  householdId: z.string().uuid().optional(), // Optional - will create personal household if not provided
  accountId: z.string().uuid(),
  categoryName: categoryNameSchema,
  amount: z.coerce.number().refine((val) => val !== 0, 'Amount cannot be zero'),
  description: z.string().max(255).optional(),
  frequency: recurrenceFrequencyEnum,
  startDate: localDateSchema,
  endDate: localDateSchema.optional(),
  nextRunAt: localDateSchema,
  isActive: z.boolean().default(true),
});

export type CreateRecurringTransactionInput = z.infer<
  typeof createRecurringTransactionSchema
>;

/**
 * Update recurring transaction request
 */
export const updateRecurringTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryName: categoryNameSchema.optional(),
  amount: z.coerce.number().refine((val) => val !== 0, 'Amount cannot be zero').optional(),
  description: z.string().max(255).optional(),
  frequency: recurrenceFrequencyEnum.optional(),
  startDate: localDateSchema.optional(),
  endDate: localDateSchema.nullable().optional(),
  nextRunAt: localDateSchema.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRecurringTransactionInput = z.infer<
  typeof updateRecurringTransactionSchema
>;

/**
 * Recurring transaction ID param
 */
export const recurringTransactionIdParamSchema = z.object({
  recurringId: z.string().uuid(),
});

export type RecurringTransactionIdParam = z.infer<
  typeof recurringTransactionIdParamSchema
>;

/**
 * List recurring transactions query
 */
export const listRecurringTransactionsQuerySchema = z.object({
  householdId: z.string().uuid().optional(), // Optional - will use personal household if not provided
  isActive: z.coerce.boolean().optional(),
});

export type ListRecurringTransactionsQuery = z.infer<
  typeof listRecurringTransactionsQuerySchema
>;

/**
 * Execute recurring transaction
 * REGRA DE NEGÓCIO:
 * - paid: true para cartão de crédito (consome limite imediatamente)
 * - paid: false para conta bancária (pendente para revisão)
 */
export const executeRecurringTransactionSchema = z.object({
  date: localDateSchema.optional(),
  paid: z.boolean().optional(), // Se não fornecido, usa false (padrão seguro)
});

export type ExecuteRecurringTransactionInput = z.infer<
  typeof executeRecurringTransactionSchema
>;

