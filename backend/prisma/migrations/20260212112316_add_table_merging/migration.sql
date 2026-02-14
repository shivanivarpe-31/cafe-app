-- AlterTable
ALTER TABLE `tables` ADD COLUMN `isMerged` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mergedGroupId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `tables_mergedGroupId_idx` ON `tables`(`mergedGroupId`);
