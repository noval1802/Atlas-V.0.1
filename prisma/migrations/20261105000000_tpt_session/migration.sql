-- CreateTable
CREATE TABLE "TptSession" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TptSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TptSession_sourceId_key" ON "TptSession"("sourceId");
