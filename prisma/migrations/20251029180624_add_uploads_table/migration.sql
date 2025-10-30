-- CreateTable
CREATE TABLE "uploads" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploads_key_key" ON "uploads"("key");

-- CreateIndex
CREATE INDEX "uploads_createdAt_idx" ON "uploads"("createdAt");
