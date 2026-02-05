import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db/prisma.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/index.js';
import type { UpdateTransactionSplitInput } from './transaction-splits.schema.js';

/**
 * Update a transaction split (mark as paid/unpaid)
 * Only the user who owns the split can update their own split
 */
export async function updateTransactionSplit(
  splitId: string,
  userId: string,
  input: UpdateTransactionSplitInput
) {
  const split = await prisma.transactionSplit.findUnique({
    where: { id: splitId },
    include: {
      transaction: {
        select: { householdId: true, isSplit: true },
      },
    },
  });

  if (!split) {
    throw new NotFoundError('Transaction split');
  }

  // Verify the split belongs to the user making the request
  if (split.userId !== userId) {
    throw new ForbiddenError('You can only update your own transaction split');
  }

  // Verify transaction is split
  if (!split.transaction.isSplit) {
    throw new BadRequestError('Transaction is not a split transaction');
  }

  // Update split
  const updatedSplit = await prisma.transactionSplit.update({
    where: { id: splitId },
    data: {
      paid: input.paid,
      paidAt: input.paid ? new Date() : null,
    },
    include: {
      user: {
        select: { id: true, email: true, displayName: true },
      },
      transaction: {
        select: { id: true, householdId: true },
      },
    },
  });

  return {
    ...updatedSplit,
    amount: updatedSplit.amount.toNumber(),
  };
}

/**
 * Get transaction splits for a transaction
 */
export async function getTransactionSplits(transactionId: string, householdId: string) {
  // Verify transaction exists and belongs to household
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, householdId },
    select: { id: true, isSplit: true },
  });

  if (!transaction) {
    throw new NotFoundError('Transaction');
  }

  if (!transaction.isSplit) {
    return [];
  }

  const splits = await prisma.transactionSplit.findMany({
    where: { transactionId },
    include: {
      user: {
        select: { id: true, email: true, displayName: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return splits.map(split => ({
    ...split,
    amount: split.amount.toNumber(),
  }));
}
