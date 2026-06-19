-- AlterEnum
ALTER TYPE "JobPaymentStatus" ADD VALUE 'REFUND_PENDING' BEFORE 'REFUNDED';

-- AlterTable
ALTER TABLE "JobPayment"
ADD COLUMN "stripeRefundId" TEXT,
ADD COLUMN "refundedAmountMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundFailureMessage" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "JobPayment_stripeRefundId_key" ON "JobPayment"("stripeRefundId");
