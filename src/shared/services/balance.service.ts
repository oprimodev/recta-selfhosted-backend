import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { BadRequestError } from '../errors/index.js';
import { AccountType, TransactionType } from '../enums/index.js';

/**
 * Balance Service - Centralized service for managing account balances
 * Ensures invariants are maintained:
 * - available_balance >= 0
 * - allocated_balance <= total_balance
 * - total_balance = available_balance + allocated_balance
 */

export interface BalanceUpdate {
  accountId: string;
  totalBalanceChange?: number;
  availableBalanceChange?: number;
  allocatedBalanceChange?: number;
}

/**
 * Validate balance invariants for an account
 */
export async function validateBalanceInvariants(accountId: string): Promise<boolean> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      totalBalance: true,
      availableBalance: true,
      allocatedBalance: true,
    },
  });

  if (!account) {
    return false;
  }

  const total = account.totalBalance.toNumber();
  const available = account.availableBalance.toNumber();
  const allocated = account.allocatedBalance.toNumber();

  // Invariant 1: available_balance >= 0
  if (available < 0) {
    throw new BadRequestError(`Available balance cannot be negative for account ${accountId}`);
  }

  // Invariant 2: allocated_balance <= total_balance
  if (allocated > total) {
    throw new BadRequestError(`Allocated balance cannot exceed total balance for account ${accountId}`);
  }

  // Invariant 3: total_balance = available_balance + allocated_balance (with small tolerance for floating point)
  const sum = available + allocated;
  if (Math.abs(total - sum) > 0.01) {
    throw new BadRequestError(`Balance inconsistency detected for account ${accountId}: total=${total}, available=${available}, allocated=${allocated}`);
  }

  return true;
}

/**
 * Update account balances atomically
 * Validates invariants before and after update
 */
export async function updateAccountBalances(
  tx: Prisma.TransactionClient,
  updates: BalanceUpdate[]
): Promise<void> {
  // Validate all accounts exist and get current balances
  const accountIds = updates.map(u => u.accountId);
  const accounts = await tx.account.findMany({
    where: { id: { in: accountIds } },
    select: {
      id: true,
      totalBalance: true,
      availableBalance: true,
      allocatedBalance: true,
    },
  });

  const accountMap = new Map(accounts.map(a => [a.id, a]));

  // Validate all accounts exist
  for (const update of updates) {
    if (!accountMap.has(update.accountId)) {
      throw new BadRequestError(`Account ${update.accountId} not found`);
    }
  }

  // Calculate new balances and validate invariants
  for (const update of updates) {
    const account = accountMap.get(update.accountId)!;
    
    const currentAvailable = account.availableBalance.toNumber();
    const currentAllocated = account.allocatedBalance.toNumber();
    const currentTotal = account.totalBalance.toNumber();

    // Calculate new values
    const newAvailable = currentAvailable + (update.availableBalanceChange || 0);
    const newAllocated = currentAllocated + (update.allocatedBalanceChange || 0);
    
    // Calculate final totalBalance:
    // - If totalBalanceChange is explicitly set (transfers = 0, normal transactions != 0), use it
    // - Otherwise, ALWAYS recalculate from newAvailable + newAllocated (for allocations/deallocations)
    //   This ensures totalBalance = availableBalance + allocatedBalance and fixes any inconsistencies
    const newTotal = update.totalBalanceChange !== undefined
      ? currentTotal + update.totalBalanceChange
      : newAvailable + newAllocated; // Always recalculate for allocations/deallocations

    // Validate invariants before update
    if (newAvailable < 0) {
      throw new BadRequestError(`Insufficient available balance in account ${update.accountId}`);
    }

    if (newAllocated < 0) {
      throw new BadRequestError(`Allocated balance cannot be negative for account ${update.accountId}`);
    }

    // For balance (legacy field): 
    // - For transfers (totalBalanceChange = 0), use availableBalanceChange (dinheiro disponível muda)
    // - For normal transactions (totalBalanceChange != 0), use totalBalanceChange (patrimônio muda)
    // - For allocations/deallocations (totalBalanceChange not set), balance doesn't change
    const balanceChange = update.totalBalanceChange !== undefined 
      ? (update.totalBalanceChange === 0 ? (update.availableBalanceChange || 0) : update.totalBalanceChange)
      : 0; // Allocations don't change balance (just moves from available to allocated)
    
    // Use absolute values to ensure totalBalance = availableBalance + allocatedBalance
    // This is critical to maintain consistency, especially after allocations
    await tx.account.update({
      where: { id: update.accountId },
      data: {
        balance: { increment: balanceChange }, // Legacy field
        totalBalance: new Prisma.Decimal(newTotal), // Use calculated total to ensure consistency
        availableBalance: new Prisma.Decimal(newAvailable),
        allocatedBalance: new Prisma.Decimal(newAllocated),
      },
    });
  }
}

/**
 * Update account balance for a normal transaction (INCOME/EXPENSE)
 * Ensures totalBalance = availableBalance + allocatedBalance
 */
export async function updateBalanceForNormalTransaction(
  tx: Prisma.TransactionClient,
  accountId: string,
  balanceChange: number
): Promise<void> {
  // Get current balances
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: {
      availableBalance: true,
      allocatedBalance: true,
    },
  });
  
  if (!account) {
    throw new BadRequestError(`Account ${accountId} not found`);
  }
  
  // Calculate new values ensuring consistency
  const currentAvailable = account.availableBalance.toNumber();
  const currentAllocated = account.allocatedBalance.toNumber();
  const newAvailable = currentAvailable + balanceChange;
  const newAllocated = currentAllocated; // Doesn't change for normal transactions
  const newTotal = newAvailable + newAllocated; // Always ensure total = available + allocated
  
  // Update all balance fields ensuring consistency
  await tx.account.update({
    where: { id: accountId },
    data: {
      balance: { increment: balanceChange }, // Legacy field
      totalBalance: new Prisma.Decimal(newTotal), // Recalculate to ensure consistency
      availableBalance: new Prisma.Decimal(newAvailable),
      // allocatedBalance remains unchanged
    },
  });
}

/**
 * Apply a transfer between accounts
 * Updates available_balance only (not total_balance)
 */
export async function applyTransfer(
  tx: Prisma.TransactionClient,
  fromAccountId: string,
  toAccountId: string,
  amount: number
): Promise<void> {
  if (fromAccountId === toAccountId) {
    throw new BadRequestError('Cannot transfer to the same account');
  }

  // Verify both accounts exist and are active
  const [fromAccount, toAccount] = await Promise.all([
    tx.account.findFirst({
      where: { id: fromAccountId, isActive: true },
      select: { id: true, availableBalance: true, type: true },
    }),
    tx.account.findFirst({
      where: { id: toAccountId, isActive: true },
      select: { id: true, availableBalance: true, type: true },
    }),
  ]);

  if (!fromAccount) {
    throw new BadRequestError('Source account not found or inactive');
  }

  if (!toAccount) {
    throw new BadRequestError('Destination account not found or inactive');
  }

  // Verify sufficient available balance (only for non-credit accounts)
  if (fromAccount.type !== AccountType.CREDIT) {
    const currentAvailable = fromAccount.availableBalance.toNumber();
    if (currentAvailable < amount) {
      throw new BadRequestError('Insufficient available balance');
    }
  }

  // Apply transfer: debit from source, credit to destination
  // Only available_balance changes (not total_balance)
  // totalBalanceChange must be 0 for transfers (doesn't affect patrimony)
  await updateAccountBalances(tx, [
    {
      accountId: fromAccountId,
      totalBalanceChange: 0, // Explicitly set to 0 - transfers don't change total balance
      availableBalanceChange: -amount,
    },
    {
      accountId: toAccountId,
      totalBalanceChange: 0, // Explicitly set to 0 - transfers don't change total balance
      availableBalanceChange: amount,
    },
  ]);
}

/**
 * Apply an allocation (move from available to allocated)
 * Also updates credit card limit if related to a credit card
 */
export async function applyAllocation(
  tx: Prisma.TransactionClient,
  accountId: string,
  creditCardId: string,
  amount: number
): Promise<void> {
  // Verify source account exists and has sufficient available balance
  const account = await tx.account.findFirst({
    where: { id: accountId, isActive: true },
    select: { id: true, availableBalance: true, type: true },
  });

  if (!account) {
    throw new BadRequestError('Source account not found or inactive');
  }

  if (account.type === AccountType.CREDIT) {
    throw new BadRequestError('Cannot allocate from a credit card account');
  }

  const currentAvailable = account.availableBalance.toNumber();
  if (currentAvailable < amount) {
    throw new BadRequestError('Insufficient available balance for allocation');
  }

  // Verify credit card exists
  const creditCard = await tx.account.findFirst({
    where: { id: creditCardId, type: AccountType.CREDIT, isActive: true },
    select: { id: true, creditLimit: true, totalLimit: true },
  });

  if (!creditCard) {
    throw new BadRequestError('Credit card not found or inactive');
  }

  // Apply allocation: move from available to allocated
  await updateAccountBalances(tx, [
    {
      accountId,
      availableBalanceChange: -amount,
      allocatedBalanceChange: amount,
    },
  ]);

  // Update credit card limits
  const currentTotalLimit = creditCard.totalLimit?.toNumber() || creditCard.creditLimit?.toNumber() || 0;
  const newTotalLimit = currentTotalLimit + amount;

  await tx.account.update({
    where: { id: creditCardId },
    data: {
      totalLimit: new Prisma.Decimal(newTotalLimit),
      // available_limit will be recalculated based on current debt
      // available_limit = total_limit - current_debt
    },
  });
}

/**
 * Apply a deallocation (move from allocated back to available)
 * Also updates credit card limit
 */
export async function applyDeallocation(
  tx: Prisma.TransactionClient,
  accountId: string,
  creditCardId: string,
  amount: number
): Promise<void> {
  // Verify source account exists and has sufficient allocated balance
  const account = await tx.account.findFirst({
    where: { id: accountId, isActive: true },
    select: { id: true, allocatedBalance: true, type: true },
  });

  if (!account) {
    throw new BadRequestError('Source account not found or inactive');
  }

  const currentAllocated = account.allocatedBalance.toNumber();
  if (currentAllocated < amount) {
    throw new BadRequestError('Insufficient allocated balance for deallocation');
  }

  // Verify credit card exists
  const creditCard = await tx.account.findFirst({
    where: { id: creditCardId, type: AccountType.CREDIT, isActive: true },
    select: { id: true, totalLimit: true },
  });

  if (!creditCard) {
    throw new BadRequestError('Credit card not found or inactive');
  }

  // Apply deallocation: move from allocated back to available
  await updateAccountBalances(tx, [
    {
      accountId,
      availableBalanceChange: amount,
      allocatedBalanceChange: -amount,
    },
  ]);

  // Update credit card limits
  const currentTotalLimit = creditCard.totalLimit?.toNumber() || 0;
  const newTotalLimit = Math.max(0, currentTotalLimit - amount);

  await tx.account.update({
    where: { id: creditCardId },
    data: {
      totalLimit: new Prisma.Decimal(newTotalLimit),
    },
  });
}

/**
 * Recalculate credit card available limit
 * available_limit = total_limit - current_debt (where debt includes paid and unpaid transactions)
 * 
 * CRITICAL: Must consider both:
 * - account.balance (paid transactions)
 * - unpaid transactions (paid: false) that also consume the limit
 */
export async function recalculateCreditCardLimit(
  tx: Prisma.TransactionClient,
  creditCardId: string
): Promise<void> {
  const creditCard = await tx.account.findUnique({
    where: { id: creditCardId },
    select: {
      id: true,
      type: true,
      balance: true,
      totalLimit: true,
      creditLimit: true,
      householdId: true,
    },
  });

  if (!creditCard || creditCard.type !== AccountType.CREDIT) {
    throw new BadRequestError('Account is not a credit card');
  }

  // Get paid debt from account balance (transactions marked as paid)
  const paidDebt = Math.max(0, creditCard.balance.toNumber());
  
  // Get unpaid transactions that also consume the limit
  // Only count EXPENSE transactions (INCOME transactions reduce debt)
  const unpaidTransactions = await tx.transaction.findMany({
    where: {
      accountId: creditCardId,
      householdId: creditCard.householdId,
      paid: false,
      type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] }, // Only INCOME/EXPENSE, exclude TRANSFER/ALLOCATION
      attachmentUrl: null, // Exclude payment transactions (they have attachmentUrl)
    },
    select: {
      type: true,
      amount: true,
    },
  });
  
  // Calculate unpaid debt (only EXPENSE transactions increase debt)
  const unpaidDebt = unpaidTransactions.reduce((sum, t) => {
    if (t.type === TransactionType.EXPENSE) {
      return sum + t.amount.toNumber();
    } else if (t.type === TransactionType.INCOME) {
      // INCOME transactions reduce debt
      return sum - t.amount.toNumber();
    }
    return sum;
  }, 0);
  
  // Total debt = paid debt + unpaid debt
  const totalDebt = Math.max(0, paidDebt + unpaidDebt);
  
  const totalLimit = creditCard.totalLimit?.toNumber() || creditCard.creditLimit?.toNumber() || 0;
  const availableLimit = Math.max(0, totalLimit - totalDebt);

  await tx.account.update({
    where: { id: creditCardId },
    data: {
      availableLimit: new Prisma.Decimal(availableLimit),
    },
  });
}

