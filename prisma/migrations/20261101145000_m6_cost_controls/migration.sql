ALTER TABLE "Trip" ADD COLUMN "bankDetails" TEXT;
ALTER TABLE "CostCategory" ADD COLUMN "isAccommodation" BOOLEAN NOT NULL DEFAULT false;
UPDATE "CostCategory" SET "isAccommodation" = true WHERE lower("name") = 'accommodation';

ALTER TABLE "CostAdjustment" DROP CONSTRAINT "CostAdjustment_lineId_fkey";
ALTER TABLE "CostAdjustment" ADD CONSTRAINT "CostAdjustment_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "CostLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostAdjustment" DROP CONSTRAINT "CostAdjustment_categoryId_fkey";
ALTER TABLE "CostAdjustment" ADD CONSTRAINT "CostAdjustment_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "CostCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
