-- AlterEnum
CREATE TYPE "JobStatus_new" AS ENUM ('PAYMENT_PENDING', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'DISPUTED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Job" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Job" ALTER COLUMN "status" TYPE "JobStatus_new" USING ("status"::text::"JobStatus_new");
ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "JobStatus_old";
ALTER TABLE "Job" ALTER COLUMN "status" SET DEFAULT 'PAYMENT_PENDING';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WORKER_COMPLETED_JOB';
ALTER TYPE "NotificationType" ADD VALUE 'JOB_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'JOB_AUTO_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'JOB_DISPUTED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE 'WORKER_PAYOUT_FAILED';

-- CreateEnum
CREATE TYPE "JobApprovalSource" AS ENUM ('CLIENT', 'AUTO', 'ADMIN');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('CLIENT_REFUND', 'WORKER_PAYOUT');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('WORK_NOT_COMPLETED', 'POOR_QUALITY', 'DIFFERENT_FROM_DESCRIPTION', 'PROPERTY_DAMAGE', 'OTHER');

-- AlterTable
ALTER TABLE "Job"
ADD COLUMN "workerCompletedAt" TIMESTAMP(3),
ADD COLUMN "approvalDeadlineAt" TIMESTAMP(3),
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvalSource" "JobApprovalSource";

-- CreateTable
CREATE TABLE "JobDispute" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "openedByClientId" TEXT NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "DisputeResolution",
    "resolutionError" TEXT,
    "resolvedByAdminEmail" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobDispute_jobId_key" ON "JobDispute"("jobId");
CREATE INDEX "JobDispute_status_createdAt_idx" ON "JobDispute"("status", "createdAt");
CREATE INDEX "Job_status_approvalDeadlineAt_idx" ON "Job"("status", "approvalDeadlineAt");

-- AddForeignKey
ALTER TABLE "JobDispute" ADD CONSTRAINT "JobDispute_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobDispute" ADD CONSTRAINT "JobDispute_openedByClientId_fkey" FOREIGN KEY ("openedByClientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
