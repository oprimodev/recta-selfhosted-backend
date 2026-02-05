-- Fix transactions incorrectly classified as EXPENSE that have INCOME categories
-- (e.g. Salário, Entrada de dinheiro) — corrects the opposite of fix_transaction_types.
--
-- SAFETY: This migration ONLY updates transactions with type = 'EXPENSE' that have
-- income categories (system or custom). It does NOT touch INCOME, TRANSFER, or ALLOCATION.

-- Income system categories: SALARY, FREELANCE, INVESTMENTS, SALES, RENTAL_INCOME, OTHER_INCOME

-- Step 1: Fix system categories — EXPENSE + income category -> INCOME
UPDATE transactions
SET type = 'INCOME'
WHERE type = 'EXPENSE'
  AND category_name IS NOT NULL
  AND category_name IN (
    'SALARY', 'FREELANCE', 'INVESTMENTS', 'SALES', 'RENTAL_INCOME', 'OTHER_INCOME'
  );

-- Step 2: Fix custom categories — EXPENSE + custom category with type INCOME -> INCOME
UPDATE transactions t
SET type = 'INCOME'
FROM categories c
WHERE t.type = 'EXPENSE'
  AND t.category_name LIKE 'CUSTOM:%'
  AND LENGTH(t.category_name) > 7
  AND CAST(c.id AS TEXT) = SUBSTRING(t.category_name FROM 8)
  AND c.type = 'INCOME'
  AND c.household_id = t.household_id;
