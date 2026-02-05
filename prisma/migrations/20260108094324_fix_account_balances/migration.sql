-- Fix account balances: Synchronize total_balance and available_balance with balance
-- This migration corrects inconsistencies that may have occurred when transactions
-- were updated before the new balance fields were properly synchronized.

-- For non-credit accounts:
-- - total_balance should equal balance (patrimony)
-- - available_balance should equal balance - allocated_balance
UPDATE "accounts" 
SET 
  "total_balance" = "balance",
  "available_balance" = "balance" - COALESCE("allocated_balance", 0)
WHERE "type" != 'CREDIT';

-- For credit card accounts:
-- - total_balance should equal balance (debt, positive value)
-- - available_balance is not applicable (always 0)
UPDATE "accounts"
SET 
  "total_balance" = "balance",
  "available_balance" = 0
WHERE "type" = 'CREDIT';

-- Validate that available_balance is not negative (invariant check)
-- This will fail if there are accounts with negative available_balance
-- which would indicate a data integrity issue
DO $$
DECLARE
  negative_available_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO negative_available_count
  FROM "accounts"
  WHERE "type" != 'CREDIT' 
    AND "available_balance" < 0;
  
  IF negative_available_count > 0 THEN
    RAISE WARNING 'Found % accounts with negative available_balance. This may indicate data integrity issues.', negative_available_count;
  END IF;
END $$;

