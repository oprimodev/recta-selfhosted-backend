-- CreateTable
CREATE TABLE "user_feedback" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_feedback_email_idx" ON "user_feedback"("email");

-- CreateIndex
CREATE INDEX "user_feedback_created_at_idx" ON "user_feedback"("created_at");
