-- Otjiningirua West Farming - MariaDB schema (tested for MariaDB 10.4+)
-- Import this file in phpMyAdmin

-- Adjust the database name if preferred
CREATE DATABASE IF NOT EXISTS `ow_farm` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `ow_farm`;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- USERS
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `phone` VARCHAR(64) DEFAULT NULL,
  `user_type` ENUM('individual','business','admin') NOT NULL DEFAULT 'individual',
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- RAMS
CREATE TABLE IF NOT EXISTS `rams` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `breed` VARCHAR(191) DEFAULT NULL,
  `price` DECIMAL(10,2) DEFAULT NULL,
  `status` ENUM('available','reserved','sold') NOT NULL DEFAULT 'available',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rams_status` (`status`),
  KEY `idx_rams_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- BEANS
CREATE TABLE IF NOT EXISTS `beans` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `variety` VARCHAR(191) DEFAULT NULL,
  `price_per_kg` DECIMAL(10,2) DEFAULT NULL,
  `status` ENUM('available','out_of_stock','discontinued') NOT NULL DEFAULT 'available',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_beans_status` (`status`),
  KEY `idx_beans_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MEDIA (for Rams and Beans)
CREATE TABLE IF NOT EXISTS `media` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parent_type` ENUM('ram','bean') NOT NULL,
  `parent_id` BIGINT UNSIGNED NOT NULL,
  `media_type` ENUM('image','video') NOT NULL,
  `url` VARCHAR(512) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_parent` (`parent_type`,`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- INQUIRIES (from public/contact)
CREATE TABLE IF NOT EXISTS `inquiries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product` ENUM('rams','beans','both') DEFAULT NULL,
  `name` VARCHAR(191) DEFAULT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `phone` VARCHAR(64) DEFAULT NULL,
  `quantity` VARCHAR(64) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inquiries_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ORDERS
CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('pending','paid','shipped','cancelled','completed') NOT NULL DEFAULT 'pending',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_user_id` (`user_id`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_created_at` (`created_at`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `product_type` ENUM('ram','bean') NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order_id` (`order_id`),
  KEY `idx_order_items_product` (`product_type`,`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_type` ENUM('ram','bean') NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `quantity_change` INT NOT NULL,
  `note` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stock_product` (`product_type`,`product_id`),
  KEY `idx_stock_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ACTIVITY LOGS (admin actions)
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `actor_name` VARCHAR(191) DEFAULT NULL,
  `action` VARCHAR(64) NOT NULL,
  `entity` VARCHAR(64) NOT NULL,
  `entity_id` VARCHAR(64) DEFAULT NULL,
  `details` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SETTINGS (single row or key-value)
CREATE TABLE IF NOT EXISTS `settings` (
  `id` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `phone` VARCHAR(64) DEFAULT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `location` VARCHAR(191) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Useful analytics views
CREATE OR REPLACE VIEW `view_user_counts` AS
SELECT `user_type`, COUNT(*) AS `count`
FROM `users`
GROUP BY `user_type`;

CREATE OR REPLACE VIEW `view_order_monthly` AS
SELECT DATE_FORMAT(`created_at`, '%Y-%m') AS `month`,
       COUNT(*) AS `orders`,
       COALESCE(SUM(`total_amount`),0) AS `revenue`
FROM `orders`
GROUP BY DATE_FORMAT(`created_at`, '%Y-%m')
ORDER BY `month` DESC;

CREATE OR REPLACE VIEW `view_stock_balances` AS
SELECT `product_type`, `product_id`, COALESCE(SUM(`quantity_change`),0) AS `stock`
FROM `stock_movements`
GROUP BY `product_type`, `product_id`;

-- Sample seed data (optional) - comment out if not needed
INSERT INTO `settings` (`id`,`phone`,`email`,`location`) VALUES (1,'+264 XX XXX XXXX','info@otjiningirua.com','Otjiningirua West, Namibia')
ON DUPLICATE KEY UPDATE `phone`=VALUES(`phone`),`email`=VALUES(`email`),`location`=VALUES(`location`);

