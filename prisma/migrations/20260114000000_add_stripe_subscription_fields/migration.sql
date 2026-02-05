-- Add Stripe subscription fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_family_plan" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_current_period_end" TIMESTAMP(3);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "users_stripe_customer_id_idx" ON "users" ("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "users_stripe_subscription_id_idx" ON "users" ("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "users_has_family_plan_idx" ON "users" ("has_family_plan");
CREATE INDEX IF NOT EXISTS "users_subscription_status_idx" ON "users" ("subscription_status");
