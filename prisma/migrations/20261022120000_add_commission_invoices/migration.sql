-- CreateEnum
CREATE TYPE "CommissionInvoiceStatus" AS ENUM ('PENDING', 'PROCESSING', 'ISSUED', 'FAILED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "billingName" TEXT,
ADD COLUMN "billingTaxId" TEXT,
ADD COLUMN "billingStreet" TEXT,
ADD COLUMN "billingCity" TEXT,
ADD COLUMN "billingPostalCode" TEXT,
ADD COLUMN "billingCountry" TEXT;

-- CreateTable
CREATE TABLE "CommissionInvoice" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CommissionInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'FAKTUROWNIA',
    "providerId" TEXT,
    "providerStatus" TEXT,
    "number" TEXT,
    "ksefNumber" TEXT,
    "pdfUrl" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionInvoice_jobId_key" ON "CommissionInvoice"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionInvoice_providerId_key" ON "CommissionInvoice"("providerId");

-- CreateIndex
CREATE INDEX "CommissionInvoice_workerId_createdAt_idx" ON "CommissionInvoice"("workerId", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionInvoice_status_updatedAt_idx" ON "CommissionInvoice"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "CommissionInvoice" ADD CONSTRAINT "CommissionInvoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionInvoice" ADD CONSTRAINT "CommissionInvoice_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
