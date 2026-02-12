-- CreateIndex
CREATE INDEX `Order_status_idx` ON `Order`(`status`);

-- CreateIndex
CREATE INDEX `Order_createdAt_idx` ON `Order`(`createdAt`);

-- CreateIndex
CREATE INDEX `Order_status_createdAt_idx` ON `Order`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `Payment_status_idx` ON `Payment`(`status`);

-- CreateIndex
CREATE INDEX `Payment_paymentMode_idx` ON `Payment`(`paymentMode`);

-- CreateIndex
CREATE INDEX `Payment_createdAt_idx` ON `Payment`(`createdAt`);

-- CreateIndex
CREATE INDEX `tables_status_idx` ON `tables`(`status`);

-- RenameIndex
ALTER TABLE `Order` RENAME INDEX `Order_tableId_fkey` TO `Order_tableId_idx`;

-- RenameIndex
ALTER TABLE `OrderItem` RENAME INDEX `OrderItem_menuItemId_fkey` TO `OrderItem_menuItemId_idx`;

-- RenameIndex
ALTER TABLE `OrderItem` RENAME INDEX `OrderItem_orderId_fkey` TO `OrderItem_orderId_idx`;

-- RenameIndex
ALTER TABLE `Payment` RENAME INDEX `Payment_orderId_fkey` TO `Payment_orderId_idx`;
