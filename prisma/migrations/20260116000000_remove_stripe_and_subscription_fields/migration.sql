-- Remove Stripe and subscription-related columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_subscription_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "has_family_plan";
ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_status";
ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_current_period_end";
