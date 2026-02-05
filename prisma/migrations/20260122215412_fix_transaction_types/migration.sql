-- Fix transaction types based on category names
-- This migration corrects transactions that were created with the default INCOME type
-- but should be EXPENSE based on their category
--
-- SAFETY: This migration ONLY updates transactions with type = 'INCOME' that have
-- expense categories. It will NEVER change EXPENSE to INCOME or affect TRANSFER/ALLOCATION.

-- List of income categories (system categories)
-- SALARY, FREELANCE, INVESTMENTS, SALES, RENTAL_INCOME, OTHER_INCOME

-- Step 1: Fix system categories - Update transactions that have INCOME type but expense category
-- Only updates if category is a known expense category (not income, not custom, not transfer/allocation)
UPDATE transactions
SET type = 'EXPENSE'
WHERE type = 'INCOME'
  AND category_name IS NOT NULL
  AND category_name IN (
    'FOOD', 'TRANSPORTATION', 'HOUSING', 'HEALTHCARE', 'EDUCATION', 
    'ENTERTAINMENT', 'CLOTHING', 'UTILITIES', 'SUBSCRIPTIONS', 
    'ONLINE_SHOPPING', 'GROCERIES', 'RESTAURANT', 'FUEL', 'PHARMACY', 'OTHER_EXPENSES'
  );

-- Step 2: Fix custom categories - Update transactions with custom categories based on categories table
-- Only updates if the custom category exists and is marked as EXPENSE type
UPDATE transactions t
SET type = 'EXPENSE'
FROM categories c
WHERE t.type = 'INCOME'
  AND t.category_name LIKE 'CUSTOM:%'
  AND LENGTH(t.category_name) > 7  -- Ensure 'CUSTOM:' prefix exists
  AND CAST(c.id AS TEXT) = SUBSTRING(t.category_name FROM 8)  -- Extract UUID after 'CUSTOM:' and compare as text
  AND c.type = 'EXPENSE'
  AND c.household_id = t.household_id;

-- Step 3: Fix recurring transactions - Update based on recurring transaction category
-- Only updates transactions from recurring transactions that have expense categories
UPDATE transactions t
SET type = 'EXPENSE'
FROM recurring_transactions r
WHERE t.recurring_transaction_id = r.id
  AND t.type = 'INCOME'  -- Only fix transactions incorrectly marked as INCOME
  AND r.category_name IS NOT NULL
  AND r.category_name IN (
    'FOOD', 'TRANSPORTATION', 'HOUSING', 'HEALTHCARE', 'EDUCATION', 
    'ENTERTAINMENT', 'CLOTHING', 'UTILITIES', 'SUBSCRIPTIONS', 
    'ONLINE_SHOPPING', 'GROCERIES', 'RESTAURANT', 'FUEL', 'PHARMACY', 'OTHER_EXPENSES'
  )
  AND r.household_id = t.household_id;

-- Step 4: Fix recurring transactions with custom categories
-- Only updates if the recurring transaction's custom category is marked as EXPENSE
UPDATE transactions t
SET type = 'EXPENSE'
FROM recurring_transactions r
INNER JOIN categories c ON (
  r.category_name LIKE 'CUSTOM:%'
  AND LENGTH(r.category_name) > 7
  AND CAST(c.id AS TEXT) = SUBSTRING(r.category_name FROM 8)  -- Extract UUID after 'CUSTOM:' and compare as text
  AND c.type = 'EXPENSE'
  AND c.household_id = r.household_id
)
WHERE t.recurring_transaction_id = r.id
  AND t.type = 'INCOME'  -- Only fix transactions incorrectly marked as INCOME
  AND r.category_name LIKE 'CUSTOM:%'
  AND r.household_id = t.household_id;
