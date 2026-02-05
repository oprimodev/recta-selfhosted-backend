-- Add allowPersonalAccountAccess column to household_members
-- This allows members to control whether other household members can use their personal accounts in shared household transactions

ALTER TABLE "household_members" ADD COLUMN IF NOT EXISTS "allow_personal_account_access" BOOLEAN NOT NULL DEFAULT false;
