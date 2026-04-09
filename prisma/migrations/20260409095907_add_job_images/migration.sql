-- CreateTable
CREATE TABLE "JobImage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JobImage" ADD CONSTRAINT "JobImage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
