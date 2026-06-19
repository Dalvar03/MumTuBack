-- AlterEnum
CREATE TYPE "JobStatus_new" AS ENUM ('PAYMENT_PENDING', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Job" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Job" ALTER COLUMN "status" TYPE "JobStatus_new" USING ("status"::text::"JobStatus_new");
ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "JobStatus_old";

-- CreateEnum
CREATE TYPE "StripeOnboardingStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'RESTRICTED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "JobPaymentStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "WorkerTransferStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REVERSED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeAccountId" TEXT,
ADD COLUMN "stripeOnboardingStatus" "StripeOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeTransfersEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Job"
ADD COLUMN "amountMinor" INTEGER,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'pln',
ADD COLUMN "platformFeeMinor" INTEGER,
ADD COLUMN "workerAmountMinor" INTEGER,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3);

UPDATE "Job"
SET
  "amountMinor" = ROUND("price" * 100)::INTEGER,
  "platformFeeMinor" = 0,
  "workerAmountMinor" = ROUND("price" * 100)::INTEGER,
  "paidAt" = CASE WHEN "status" <> 'CANCELLED' THEN "createdAt" ELSE NULL END;

ALTER TABLE "Job"
ALTER COLUMN "amountMinor" SET NOT NULL,
ALTER COLUMN "platformFeeMinor" SET NOT NULL,
ALTER COLUMN "workerAmountMinor" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PAYMENT_PENDING';

-- CreateTable
CREATE TABLE "JobPayment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "JobPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeCustomerId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerTransfer" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "stripeTransferId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "WorkerTransferStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

INSERT INTO "JobPayment" (
    "id",
    "jobId",
    "status",
    "amountMinor",
    "currency",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_' || "id",
    "id",
    CASE
        WHEN "status" = 'CANCELLED' THEN 'CANCELED'::"JobPaymentStatus"
        ELSE 'SUCCEEDED'::"JobPaymentStatus"
    END,
    "amountMinor",
    "currency",
    "createdAt",
    "updatedAt"
FROM "Job";

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");
CREATE UNIQUE INDEX "JobPayment_jobId_key" ON "JobPayment"("jobId");
CREATE UNIQUE INDEX "JobPayment_stripeCheckoutSessionId_key" ON "JobPayment"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "JobPayment_stripePaymentIntentId_key" ON "JobPayment"("stripePaymentIntentId");
CREATE UNIQUE INDEX "JobPayment_stripeChargeId_key" ON "JobPayment"("stripeChargeId");
CREATE INDEX "JobPayment_status_idx" ON "JobPayment"("status");
CREATE UNIQUE INDEX "WorkerTransfer_jobId_key" ON "WorkerTransfer"("jobId");
CREATE UNIQUE INDEX "WorkerTransfer_stripeTransferId_key" ON "WorkerTransfer"("stripeTransferId");
CREATE INDEX "WorkerTransfer_workerId_idx" ON "WorkerTransfer"("workerId");
CREATE INDEX "WorkerTransfer_status_idx" ON "WorkerTransfer"("status");
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

-- AddForeignKey
ALTER TABLE "JobPayment" ADD CONSTRAINT "JobPayment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTransfer" ADD CONSTRAINT "WorkerTransfer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerTransfer" ADD CONSTRAINT "WorkerTransfer_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
