-- Add isSplit field to transactions table
ALTER TABLE "transactions" ADD COLUMN "is_split" BOOLEAN NOT NULL DEFAULT false;

-- Create transaction_splits table for expense sharing
CREATE TABLE "transaction_splits" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_splits_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: one split per user per transaction
CREATE UNIQUE INDEX "transaction_splits_transaction_id_user_id_key" ON "transaction_splits"("transaction_id", "user_id");

-- Create indexes for efficient querying
CREATE INDEX "transaction_splits_transaction_id_idx" ON "transaction_splits"("transaction_id");
CREATE INDEX "transaction_splits_user_id_idx" ON "transaction_splits"("user_id");
CREATE INDEX "transaction_splits_paid_idx" ON "transaction_splits"("paid");

-- Add foreign keys
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
