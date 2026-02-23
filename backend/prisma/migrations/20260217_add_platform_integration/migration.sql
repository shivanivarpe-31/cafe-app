-- Migration: Add Platform Integration Tables
-- Purpose: Support Swiggy/Zomato webhook retry and item mapping

-- Table: webhookLog
-- Purpose: Store webhook events for retry and debugging
CREATE TABLE webhookLog (
    id INT PRIMARY KEY AUTO_INCREMENT,
    platform VARCHAR(50) NOT NULL,  -- 'SWIGGY' or 'ZOMATO'
    eventType VARCHAR(100) NOT NULL,  -- e.g., 'ORDER_PLACED', 'ORDER_CANCELLED'
    payload LONGTEXT NOT NULL,  -- JSON payload from webhook
    status VARCHAR(20) NOT NULL DEFAULT 'FAILED',  -- 'PENDING', 'FAILED', 'SUCCESS'
    error LONGTEXT,  -- Error message if failed
    attemptCount INT DEFAULT 0,  -- Number of retry attempts
    nextRetryAt DATETIME,  -- When to retry next
    lastAttemptAt DATETIME,  -- Last attempt timestamp
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for query performance
    INDEX idx_status_nextRetry (status, nextRetryAt),
    INDEX idx_platform_eventType (platform, eventType),
    INDEX idx_createdAt (createdAt)
);

-- Table: platformItemMapping
-- Purpose: Map internal menu items to platform-specific item IDs
CREATE TABLE platformItemMapping (
    id INT PRIMARY KEY AUTO_INCREMENT,
    menuItemId INT NOT NULL,
    platform VARCHAR(50) NOT NULL,  -- 'SWIGGY', 'ZOMATO', or both
    platformItemId VARCHAR(100) NOT NULL,
    platformItemName VARCHAR(255),  -- Store original platform name
    platformPrice DECIMAL(10, 2),  -- Store platform specific price
    isActive BOOLEAN DEFAULT TRUE,
    lastSyncedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (menuItemId) REFERENCES MenuItem(id) ON DELETE CASCADE,
    
    -- Unique constraint: one mapping per item per platform
    UNIQUE KEY unique_menu_platform_item (menuItemId, platform, platformItemId),
    
    -- Indexes
    INDEX idx_platform_itemId (platform, platformItemId),
    INDEX idx_menuItemId (menuItemId),
    INDEX idx_isActive (isActive)
);

-- Table: deliveryPartner (optional - for tracking delivery partners)
-- Purpose: Store delivery partner information from platforms
CREATE TABLE deliveryPartner (
    id INT PRIMARY KEY AUTO_INCREMENT,
    platform VARCHAR(50) NOT NULL,
    platformPartnerId VARCHAR(100) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(20),
    rating DECIMAL(3, 2),
    status VARCHAR(20),  -- 'ACTIVE', 'INACTIVE'
    lastActivityAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Unique constraint
    UNIQUE KEY unique_platform_partner (platform, platformPartnerId),
    
    -- Indexes
    INDEX idx_platform (platform),
    INDEX idx_status (status)
);

-- Add new columns to DeliveryInfo table
-- Using a procedure to conditionally add columns (MySQL doesn't support IF NOT EXISTS on ADD COLUMN)
SET @dbname = DATABASE();

SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'DeliveryInfo' AND COLUMN_NAME = 'webhookLogId';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE DeliveryInfo ADD COLUMN webhookLogId INT',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @fk_exists
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'DeliveryInfo' AND CONSTRAINT_NAME = 'fk_deliveryinfo_webhooklog';

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE DeliveryInfo ADD CONSTRAINT fk_deliveryinfo_webhooklog FOREIGN KEY (webhookLogId) REFERENCES webhookLog(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add delivery partner tracking to DeliveryInfo
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'DeliveryInfo' AND COLUMN_NAME = 'deliveryPartnerId';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE DeliveryInfo ADD COLUMN deliveryPartnerId INT',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @fk_exists
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'DeliveryInfo' AND CONSTRAINT_NAME = 'fk_deliveryinfo_partner';

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE DeliveryInfo ADD CONSTRAINT fk_deliveryinfo_partner FOREIGN KEY (deliveryPartnerId) REFERENCES deliveryPartner(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for platform order lookup
ALTER TABLE DeliveryInfo ADD INDEX idx_platform_order (deliveryPlatform, platformOrderId);
ALTER TABLE DeliveryInfo ADD UNIQUE INDEX unique_platform_order (deliveryPlatform, platformOrderId);
