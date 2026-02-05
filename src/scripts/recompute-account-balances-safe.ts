#!/usr/bin/env tsx
/**
 * Fix balances ONLY for accounts affected by fix_income migration.
 * 
 * This script:
 * 1. Finds accounts that have INCOME transactions with income categories (these may have been corrected)
 * 2. Recalculates balances ONLY for those accounts from their transaction history
 * 3. Leaves all other accounts completely untouched
 *
 * Usage:
 *   npm run script:recompute-balances
 *   npx tsx src/scripts/recompute-account-balances-safe.ts
 */

import 'dotenv/config';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../shared/db/prisma.js';
import { AccountType, TransactionType } from '../shared/enums/index.js';
import { recalculateCreditCardLimit } from '../shared/services/balance.service.js';

function calculateBalanceChange(amount: number, isIncome: boolean, accountType: string): number {
  const isCreditCard = accountType === AccountType.CREDIT;
  if (isCreditCard) return isIncome ? -amount : amount;
  return isIncome ? amount : -amount;
}

async function main() {
  console.log('🔍 Finding accounts affected by fix_income migration...');

  const incomeCategories = ['SALARY', 'FREELANCE', 'INVESTMENTS', 'SALES', 'RENTAL_INCOME', 'OTHER_INCOME'];
  
  // Get custom income categories
  const customIncomeCategories = await prisma.category.findMany({
    where: { type: 'INCOME' },
    select: { id: true },
  });
  
  const customCategoryIds = customIncomeCategories.map(c => `CUSTOM:${c.id}`);
  
  // Find accounts that have INCOME transactions with income categories
  // These are the accounts that may have been affected by the migration
  const affectedTransactions = await prisma.transaction.findMany({
    where: {
      type: TransactionType.INCOME,
      paid: { not: false }, // paid = true or null
      accountId: { not: null },
      OR: [
        { categoryName: { in: incomeCategories } },
        { categoryName: { in: customCategoryIds } },
      ],
    },
    select: {
      accountId: true,
    },
    distinct: ['accountId'],
  });

  if (affectedTransactions.length === 0) {
    console.log('✅ No affected accounts found. No balance adjustments needed.');
    return;
  }

  const affectedAccountIds = affectedTransactions
    .map(t => t.accountId)
    .filter((id): id is string => id !== null);

  console.log(`📊 Found ${affectedAccountIds.length} affected accounts`);

  // Get all transactions for affected accounts to recalculate their balances
  const allTransactions = await prisma.transaction.findMany({
    where: {
      accountId: { in: affectedAccountIds },
      type: { in: [TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER, TransactionType.ALLOCATION] },
    },
    select: {
      id: true,
      type: true,
      amount: true,
      paid: true,
      accountId: true,
      fromAccountId: true,
      toAccountId: true,
      relatedEntityId: true,
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  // Get account details
  const accounts = await prisma.account.findMany({
    where: { id: { in: affectedAccountIds } },
    select: {
      id: true,
      name: true,
      type: true,
      creditLimit: true,
    },
  });

  const accountTypeMap = new Map(accounts.map(a => [a.id, a.type]));

  // Calculate balances for affected accounts only
  const totalDelta = new Map<string, number>();
  const transferAvailableDelta = new Map<string, number>();
  const allocatedDelta = new Map<string, number>();
  const creditCardAllocationDelta = new Map<string, number>();

  for (const t of allTransactions) {
    const amount = t.amount.toNumber();
    const paid = t.paid !== false;

    if (t.type === TransactionType.TRANSFER && t.fromAccountId && t.toAccountId) {
      if (affectedAccountIds.includes(t.fromAccountId)) {
        const from = transferAvailableDelta.get(t.fromAccountId) ?? 0;
        transferAvailableDelta.set(t.fromAccountId, from - amount);
      }
      if (affectedAccountIds.includes(t.toAccountId)) {
        const to = transferAvailableDelta.get(t.toAccountId) ?? 0;
        transferAvailableDelta.set(t.toAccountId, to + amount);
      }
      continue;
    }

    if (t.type === TransactionType.ALLOCATION && t.accountId && t.relatedEntityId) {
      if (affectedAccountIds.includes(t.accountId)) {
        const absAmount = Math.abs(amount);
        const sign = amount >= 0 ? 1 : -1;
        const alloc = allocatedDelta.get(t.accountId) ?? 0;
        allocatedDelta.set(t.accountId, alloc + sign * absAmount);
      }
      if (affectedAccountIds.includes(t.relatedEntityId)) {
        const cc = creditCardAllocationDelta.get(t.relatedEntityId) ?? 0;
        creditCardAllocationDelta.set(t.relatedEntityId, cc + Math.abs(amount) * (amount >= 0 ? 1 : -1));
      }
      continue;
    }

    if ((t.type === TransactionType.INCOME || t.type === TransactionType.EXPENSE) && paid && t.accountId && affectedAccountIds.includes(t.accountId)) {
      const accountType = accountTypeMap.get(t.accountId);
      if (!accountType) continue;
      const isIncome = t.type === TransactionType.INCOME;
      const change = calculateBalanceChange(amount, isIncome, accountType);
      const cur = totalDelta.get(t.accountId) ?? 0;
      totalDelta.set(t.accountId, cur + change);
    }
  }

  console.log(`🔄 Recalculating balances for ${accounts.length} affected accounts...`);

  await prisma.$transaction(async (tx) => {
    for (const acc of accounts) {
      const total = totalDelta.get(acc.id) ?? 0;
      const transfer = transferAvailableDelta.get(acc.id) ?? 0;
      const allocated = allocatedDelta.get(acc.id) ?? 0;

      if (acc.type === AccountType.CREDIT) {
        const balance = Math.max(0, total);
        const creditLimit = acc.creditLimit?.toNumber() ?? 0;
        const allocationDelta = creditCardAllocationDelta.get(acc.id) ?? 0;
        const totalLimit = Math.max(0, creditLimit + allocationDelta);

        await tx.account.update({
          where: { id: acc.id },
          data: {
            balance: new Prisma.Decimal(balance),
            totalBalance: new Prisma.Decimal(balance),
            availableBalance: new Prisma.Decimal(0),
            allocatedBalance: new Prisma.Decimal(0),
            totalLimit: new Prisma.Decimal(totalLimit),
          },
        });
        await recalculateCreditCardLimit(tx, acc.id);
      } else {
        const totalBalance = total;
        const allocatedBalance = Math.max(0, allocated);
        const availableBalance = totalBalance - allocatedBalance + transfer;

        if (availableBalance < 0) {
          console.warn(
            `⚠️  Account "${acc.name}" (${acc.id}): available would be ${availableBalance}. Clamping to 0.`
          );
        }
        const available = Math.max(0, availableBalance);

        await tx.account.update({
          where: { id: acc.id },
          data: {
            balance: new Prisma.Decimal(totalBalance),
            totalBalance: new Prisma.Decimal(totalBalance),
            availableBalance: new Prisma.Decimal(available),
            allocatedBalance: new Prisma.Decimal(allocatedBalance),
          },
        });
      }
    }
  });

  console.log('✅ Balance recalculation completed successfully.');
  console.log(`📝 Recalculated ${accounts.length} affected accounts. All other accounts were left untouched.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
