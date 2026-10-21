-- CreateEnum
CREATE TYPE "OpsRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERATOR_PUSDALOPS', 'OPERATOR_KODAM', 'ANALYST', 'PIMPINAN');

-- CreateEnum
CREATE TYPE "OpsStatus" AS ENUM ('KONDUSIF', 'WASPADA', 'SIAGA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "OpsRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "kotamaopsId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kotamaops" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kotamaops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Situation" (
    "id" TEXT NOT NULL,
    "kotamaopsId" TEXT NOT NULL,
    "status" "OpsStatus" NOT NULL,
    "personnel" INTEGER NOT NULL,
    "deployed" INTEGER NOT NULL,
    "incidentCount" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Situation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SituationRevision" (
    "id" TEXT NOT NULL,
    "kotamaopsId" TEXT NOT NULL,
    "editorId" TEXT,
    "status" "OpsStatus" NOT NULL,
    "personnel" INTEGER NOT NULL,
    "deployed" INTEGER NOT NULL,
    "incidentCount" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SituationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- CreateIndex
CREATE INDEX "User_kotamaopsId_idx" ON "User"("kotamaopsId");

-- CreateIndex
CREATE UNIQUE INDEX "Kotamaops_code_key" ON "Kotamaops"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Situation_kotamaopsId_key" ON "Situation"("kotamaopsId");

-- CreateIndex
CREATE INDEX "SituationRevision_kotamaopsId_createdAt_idx" ON "SituationRevision"("kotamaopsId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_kotamaopsId_fkey" FOREIGN KEY ("kotamaopsId") REFERENCES "Kotamaops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Situation" ADD CONSTRAINT "Situation_kotamaopsId_fkey" FOREIGN KEY ("kotamaopsId") REFERENCES "Kotamaops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SituationRevision" ADD CONSTRAINT "SituationRevision_kotamaopsId_fkey" FOREIGN KEY ("kotamaopsId") REFERENCES "Kotamaops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SituationRevision" ADD CONSTRAINT "SituationRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
