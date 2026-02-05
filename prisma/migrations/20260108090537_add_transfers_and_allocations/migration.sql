-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'ALLOCATION');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable: Add new fields to accounts
ALTER TABLE "accounts" ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "total_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "available_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "allocated_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total_limit" DECIMAL(15,2),
ADD COLUMN     "available_limit" DECIMAL(15,2);

-- AlterTable: Add new fields to transactions
ALTER TABLE "transactions" ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'INCOME',
ADD COLUMN     "from_account_id" UUID,
ADD COLUMN     "to_account_id" UUID,
ADD COLUMN     "related_entity_id" UUID;

-- Make categoryName nullable (it's not needed for TRANSFER/ALLOCATION)
ALTER TABLE "transactions" ALTER COLUMN "category_name" DROP NOT NULL;

-- Initialize account balances from existing balance field
-- total_balance and available_balance start as the current balance
-- allocated_balance starts at 0
UPDATE "accounts" SET 
  "total_balance" = "balance",
  "available_balance" = "balance",
  "allocated_balance" = 0,
  "status" = CASE WHEN "is_active" = true THEN 'ACTIVE'::"AccountStatus" ELSE 'INACTIVE'::"AccountStatus" END;

-- Initialize credit card limits
-- For credit cards: total_limit = credit_limit (initially, no allocations)
-- available_limit = credit_limit - current debt (balance represents debt)
UPDATE "accounts" SET 
  "total_limit" = "credit_limit",
  "available_limit" = CASE 
    WHEN "credit_limit" IS NOT NULL AND "balance" < 0 THEN "credit_limit" + "balance" -- balance is negative (debt)
    WHEN "credit_limit" IS NOT NULL THEN "credit_limit"
    ELSE NULL
  END
WHERE "type" = 'CREDIT' AND "credit_limit" IS NOT NULL;

-- Initialize transaction types based on category
-- Transactions with income categories -> INCOME
UPDATE "transactions" SET "type" = 'INCOME'::"TransactionType"
WHERE "category_name" IN ('SALARY', 'FREELANCE', 'INVESTMENTS', 'SALES', 'RENTAL_INCOME', 'OTHER_INCOME');

-- Transactions with expense categories -> EXPENSE
UPDATE "transactions" SET "type" = 'EXPENSE'::"TransactionType"
WHERE "category_name" IN ('FOOD', 'TRANSPORTATION', 'HOUSING', 'HEALTHCARE', 'EDUCATION', 'ENTERTAINMENT', 'CLOTHING', 'UTILITIES', 'SUBSCRIPTIONS', 'ONLINE_SHOPPING', 'GROCERIES', 'RESTAURANT', 'FUEL', 'PHARMACY', 'OTHER_EXPENSES');

-- Add foreign key constraints
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_related_entity_id_fkey" FOREIGN KEY ("related_entity_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "transactions_household_id_type_idx" ON "transactions"("household_id", "type");
CREATE INDEX "transactions_from_account_id_idx" ON "transactions"("from_account_id");
CREATE INDEX "transactions_to_account_id_idx" ON "transactions"("to_account_id");
CREATE INDEX "transactions_related_entity_id_idx" ON "transactions"("related_entity_id");

