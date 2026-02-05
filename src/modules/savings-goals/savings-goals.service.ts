import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db/prisma.js';
import { NotFoundError, BadRequestError } from '../../shared/errors/index.js';
import type {
  CreateSavingsGoalInput,
  UpdateSavingsGoalInput,
  AddToSavingsGoalInput,
  ListSavingsGoalsQuery,
} from './savings-goals.schema.js';

/**
 * Create a new savings goal
 */
export async function createSavingsGoal(input: CreateSavingsGoalInput) {
  // householdId must be provided (resolved in routes via ensurePersonalHousehold)
  if (!input.householdId) {
    throw new BadRequestError('householdId is required');
  }
  const householdId = input.householdId;

  const { name, targetAmount, currentAmount, targetDate } = input;

  // Verify current amount doesn't exceed target
  if (currentAmount > targetAmount) {
    throw new BadRequestError('Current amount cannot exceed target amount');
  }

  // Verify account if provided
  if (input.accountId) {
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, householdId, isActive: true },
    });
    if (!account) {
      throw new NotFoundError('Account');
    }
  }

  const goal = await prisma.savingsGoal.create({
    data: {
      householdId,
      accountId: input.accountId,
      name,
      targetAmount: new Prisma.Decimal(targetAmount),
      currentAmount: new Prisma.Decimal(currentAmount),
      targetDate,
    },
  });

  // Convert Prisma.Decimal to number for JSON serialization
  return {
    ...goal,
    targetAmount: goal.targetAmount.toNumber(),
    currentAmount: goal.currentAmount.toNumber(),
  };
}

/**
 * Get savings goal by ID
 */
export async function getSavingsGoal(goalId: string) {
  const goal = await prisma.savingsGoal.findUnique({
    where: { id: goalId },
  });

  if (!goal) {
    throw new NotFoundError('Savings goal');
  }

  // Convert Prisma.Decimal to number for JSON serialization
  return {
    ...goal,
    targetAmount: goal.targetAmount.toNumber(),
    currentAmount: goal.currentAmount.toNumber(),
  };
}

/**
 * List savings goals for a household
 */
export async function listSavingsGoals(query: ListSavingsGoalsQuery) {
  const { householdId } = query;

  const goals = await prisma.savingsGoal.findMany({
    where: { householdId },
    orderBy: [
      { createdAt: 'desc' },
    ],
  });

  // Calculate progress for each goal and convert Prisma.Decimal to number for JSON serialization
  return goals.map((goal: { targetAmount: Prisma.Decimal; currentAmount: Prisma.Decimal; id: string; name: string; targetDate: Date | null; accountId: string | null; householdId: string; createdAt: Date; updatedAt: Date }) => {
    const target = goal.targetAmount.toNumber();
    const current = goal.currentAmount.toNumber();
    const percentage = target > 0 ? (current / target) * 100 : 0;
    const remaining = target - current;
    const isCompleted = current >= target;

    return {
      ...goal,
      targetAmount: target,
      currentAmount: current,
      remaining,
      percentage: Math.round(percentage * 100) / 100,
      isCompleted,
    };
  });
}

/**
 * Update savings goal
 */
export async function updateSavingsGoal(goalId: string, input: UpdateSavingsGoalInput) {
  const existingGoal = await prisma.savingsGoal.findUnique({
    where: { id: goalId },
  });

  if (!existingGoal) {
    throw new NotFoundError('Savings goal');
  }

  // Validate current amount doesn't exceed new target if both are being updated
  const newCurrentAmount = input.currentAmount ?? existingGoal.currentAmount.toNumber();
  const newTargetAmount = input.targetAmount ?? existingGoal.targetAmount.toNumber();

  if (newCurrentAmount > newTargetAmount) {
    throw new BadRequestError('Current amount cannot exceed target amount');
  }

  // Verify account if provided
  if (input.accountId !== undefined) {
    if (input.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: input.accountId, householdId: existingGoal.householdId, isActive: true },
      });
      if (!account) {
        throw new NotFoundError('Account');
      }
    }
  }

  const goal = await prisma.savingsGoal.update({
    where: { id: goalId },
    data: {
      ...(input.accountId !== undefined && { accountId: input.accountId }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.targetAmount !== undefined && {
        targetAmount: new Prisma.Decimal(input.targetAmount),
      }),
      ...(input.currentAmount !== undefined && {
        currentAmount: new Prisma.Decimal(input.currentAmount),
      }),
      ...(input.targetDate !== undefined && { targetDate: input.targetDate }),
    },
  });

  // Convert Prisma.Decimal to number for JSON serialization
  return {
    ...goal,
    targetAmount: goal.targetAmount.toNumber(),
    currentAmount: goal.currentAmount.toNumber(),
  };
}

/**
 * Add amount to savings goal
 */
export async function addToSavingsGoal(
  goalId: string,
  householdId: string,
  input: AddToSavingsGoalInput
) {
  const goal = await prisma.savingsGoal.findFirst({
    where: { id: goalId, householdId },
  });

  if (!goal) {
    throw new NotFoundError('Savings goal');
  }

  const newAmount = goal.currentAmount.toNumber() + input.amount;
  const target = goal.targetAmount.toNumber();

  if (newAmount > target) {
    throw new BadRequestError(
      `Adding this amount would exceed the target. Maximum allowed: ${target - goal.currentAmount.toNumber()}`
    );
  }

  const updatedGoal = await prisma.savingsGoal.update({
    where: { id: goalId },
    data: {
      currentAmount: new Prisma.Decimal(newAmount),
    },
  });

  return updatedGoal;
}

/**
 * Delete savings goal
 */
export async function deleteSavingsGoal(goalId: string) {
  const goal = await prisma.savingsGoal.findUnique({
    where: { id: goalId },
  });

  if (!goal) {
    throw new NotFoundError('Savings goal');
  }

  await prisma.savingsGoal.delete({
    where: { id: goalId },
  });

  return { deleted: true };
}

