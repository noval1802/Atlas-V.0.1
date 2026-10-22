-- Kotamaops per matra (AD/AL/AU) plus lambang. Baris lama menjadi AD;
-- Kodaeral V milik TNI AL. Lambang lama mengikuti nama file /kodam/<kode>.png.

CREATE TYPE "Matra" AS ENUM ('AD', 'AL', 'AU');

ALTER TABLE "Kotamaops" ADD COLUMN "matra" "Matra" NOT NULL DEFAULT 'AD';
ALTER TABLE "Kotamaops" ADD COLUMN "logo" TEXT NOT NULL DEFAULT '';

UPDATE "Kotamaops" SET "matra" = 'AL' WHERE "code" = 'KODAERAL V';
UPDATE "Kotamaops"
SET "logo" = '/kodam/' || trim(both '-' from regexp_replace(lower("code"), '[^a-z0-9]+', '-', 'g')) || '.png';

CREATE INDEX "Kotamaops_matra_idx" ON "Kotamaops"("matra");
