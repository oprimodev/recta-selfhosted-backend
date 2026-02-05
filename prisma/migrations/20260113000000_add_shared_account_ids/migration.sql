-- Add sharedAccountIds JSON column to household_members table
-- This allows users to specifically select which personal accounts to share in shared households
ALTER TABLE "household_members" ADD COLUMN IF NOT EXISTS "shared_account_ids" JSONB DEFAULT '[]'::jsonb;

-- Create index on shared_account_ids for efficient querying (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS "household_members_shared_account_ids_idx" ON "household_members" USING GIN ("shared_account_ids");
