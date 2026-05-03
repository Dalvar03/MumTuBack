-- CreateTable
CREATE TABLE "WorkerPayoutDetails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerPayoutDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerPayoutDetails_userId_key" ON "WorkerPayoutDetails"("userId");

-- AddForeignKey
ALTER TABLE "WorkerPayoutDetails" ADD CONSTRAINT "WorkerPayoutDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
