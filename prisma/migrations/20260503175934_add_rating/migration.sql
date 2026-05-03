-- AlterTable
ALTER TABLE "User" ADD COLUMN     "averageRating" DOUBLE PRECISION,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "ratingsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_jobId_fromUserId_key" ON "Rating"("jobId", "fromUserId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
