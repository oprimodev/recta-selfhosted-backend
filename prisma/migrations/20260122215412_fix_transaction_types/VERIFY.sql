-- VERIFICATION QUERIES - Run these BEFORE the migration to see what will be changed
-- These queries show you exactly which transactions will be updated

-- Query 1: Count transactions that will be fixed (system categories)
SELECT 
  COUNT(*) as transactions_to_fix,
  category_name,
  COUNT(*) as count_per_category
FROM transactions
WHERE type = 'INCOME'
  AND category_name IS NOT NULL
  AND category_name IN (
    'FOOD', 'TRANSPORTATION', 'HOUSING', 'HEALTHCARE', 'EDUCATION', 
    'ENTERTAINMENT', 'CLOTHING', 'UTILITIES', 'SUBSCRIPTIONS', 
    'ONLINE_SHOPPING', 'GROCERIES', 'RESTAURANT', 'FUEL', 'PHARMACY', 'OTHER_EXPENSES'
  )
GROUP BY category_name
ORDER BY count_per_category DESC;

-- Query 2: Count transactions that will be fixed (custom categories)
SELECT 
  COUNT(*) as transactions_to_fix,
  t.category_name,
  c.type as category_type,
  c.name as category_name_display
FROM transactions t
INNER JOIN categories c ON (
  t.category_name LIKE 'CUSTOM:%'
  AND LENGTH(t.category_name) > 7
  AND CAST(c.id AS TEXT) = SUBSTRING(t.category_name FROM 8)
  AND c.household_id = t.household_id
)
WHERE t.type = 'INCOME'
  AND c.type = 'EXPENSE'
GROUP BY t.category_name, c.type, c.name
ORDER BY COUNT(*) DESC;

-- Query 3: Count recurring transactions that will be fixed
SELECT 
  COUNT(*) as transactions_to_fix,
  r.category_name,
  r.description
FROM transactions t
INNER JOIN recurring_transactions r ON t.recurring_transaction_id = r.id
WHERE t.type = 'INCOME'
  AND r.category_name IS NOT NULL
  AND r.category_name IN (
    'FOOD', 'TRANSPORTATION', 'HOUSING', 'HEALTHCARE', 'EDUCATION', 
    'ENTERTAINMENT', 'CLOTHING', 'UTILITIES', 'SUBSCRIPTIONS', 
    'ONLINE_SHOPPING', 'GROCERIES', 'RESTAURANT', 'FUEL', 'PHARMACY', 'OTHER_EXPENSES'
  )
  AND r.household_id = t.household_id
GROUP BY r.category_name, r.description
ORDER BY COUNT(*) DESC;

-- Query 4: Count recurring transactions with custom categories that will be fixed
SELECT 
  COUNT(*) as transactions_to_fix,
  r.category_name,
  r.description,
  c.type as category_type,
  c.name as category_name_display
FROM transactions t
INNER JOIN recurring_transactions r ON t.recurring_transaction_id = r.id
INNER JOIN categories c ON (
  r.category_name LIKE 'CUSTOM:%'
  AND LENGTH(r.category_name) > 7
  AND CAST(c.id AS TEXT) = SUBSTRING(r.category_name FROM 8)
  AND c.type = 'EXPENSE'
  AND c.household_id = r.household_id
)
WHERE t.type = 'INCOME'
  AND r.category_name LIKE 'CUSTOM:%'
  AND r.household_id = t.household_id
GROUP BY r.category_name, r.description, c.type, c.name
ORDER BY COUNT(*) DESC;

-- Query 5: Total summary
SELECT 
  'System Categories' as fix_type,
  COUNT(*) as total_to_fix
FROM transactions
WHERE type = 'INCOME'
  AND category_name IS NOT NULL
  AND category_name IN (
    'FOOD', 'TRANSPORTATION', 'HOUSING', 'HEALTHCARE', 'EDUCATION', 
    'ENTERTAINMENT', 'CLOTHING', 'UTILITIES', 'SUBSCRIPTIONS', 
    'ONLINE_SHOPPING', 'GROCERIES', 'RESTAURANT', 'FUEL', 'PHARMACY', 'OTHER_EXPENSES'
  )

UNION ALL

SELECT 
  'Custom Categories' as fix_type,
  COUNT(*) as total_to_fix
FROM transactions t
INNER JOIN categories c ON (
  t.category_name LIKE 'CUSTOM:%'
  AND LENGTH(t.category_name) > 7
  AND CAST(c.id AS TEXT) = SUBSTRING(t.category_name FROM 8)
  AND c.type = 'EXPENSE'
  AND c.household_id = t.household_id
)
WHERE t.type = 'INCOME'

UNION ALL

SELECT 
  'Recurring (System)' as fix_type,
  COUNT(*) as total_to_fix
FROM transactions t
INNER JOIN recurring_transactions r ON t.recurring_transaction_id = r.id
WHERE t.type = 'INCOME'
  AND r.category_name IS NOT NULL
  AND r.category_name IN (
    'FOOD', 'TRANSPORTATION', 'HOUSING', 'HEALTHCARE', 'EDUCATION', 
    'ENTERTAINMENT', 'CLOTHING', 'UTILITIES', 'SUBSCRIPTIONS', 
    'ONLINE_SHOPPING', 'GROCERIES', 'RESTAURANT', 'FUEL', 'PHARMACY', 'OTHER_EXPENSES'
  )
  AND r.household_id = t.household_id

UNION ALL

SELECT 
  'Recurring (Custom)' as fix_type,
  COUNT(*) as total_to_fix
FROM transactions t
INNER JOIN recurring_transactions r ON t.recurring_transaction_id = r.id
INNER JOIN categories c ON (
  r.category_name LIKE 'CUSTOM:%'
  AND LENGTH(r.category_name) > 7
  AND CAST(c.id AS TEXT) = SUBSTRING(r.category_name FROM 8)
  AND c.type = 'EXPENSE'
  AND c.household_id = r.household_id
)
WHERE t.type = 'INCOME'
  AND r.category_name LIKE 'CUSTOM:%'
  AND r.household_id = t.household_id;
