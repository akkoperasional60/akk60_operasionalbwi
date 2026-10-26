-- ====================================================================
-- HOSTINGER MYSQL ENTERPRISE LOGISTICS & OPERATIONAL DATABASE SCHEMA
-- For PT Anugrah Kemasan Kreatif (PT AKK Logistics Banyuwangi DC)
-- Engine: MySQL / MariaDB (Importable via Hostinger phpMyAdmin)
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. USERS & PROFILES (Authentication & Role Based Access Control)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'spv_logistik', 'driver') NOT NULL DEFAULT 'spv_logistik',
  `department` VARCHAR(100) DEFAULT 'Logistics Operations',
  `phone` VARCHAR(50) NULL,
  `status` VARCHAR(20) DEFAULT 'approved',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. FLEETS (Armada Kendaraan Operasional)
CREATE TABLE IF NOT EXISTS `fleets` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `plate_number` VARCHAR(30) NOT NULL UNIQUE,
  `vehicle_type` VARCHAR(100) NOT NULL, -- 'Pick Up Box', 'Engkel STD', 'Engkel Long', 'Double STD'
  `tonnage_capacity` DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- metric tons
  `current_tonnage` DECIMAL(5,2) DEFAULT 0.00,
  `status` ENUM('available', 'on-duty', 'maintenance') DEFAULT 'available',
  `gps_imei` VARCHAR(100) NULL,
  `fuel_level_percent` INT DEFAULT 100,
  `odometer_km` INT DEFAULT 0,
  `year` INT DEFAULT 2024,
  `last_maintenance` DATE NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. CREWS (Supir dan Helper / Kernet)
CREATE TABLE IF NOT EXISTS `crews` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `role` VARCHAR(50) NOT NULL, -- 'Driver Utama', 'Driver Cadangan', 'Kernet / Helper'
  `license_number` VARCHAR(100) NOT NULL,
  `license_type` VARCHAR(50) NOT NULL, -- 'SIM B2 Umum', 'SIM B1 Umum', 'SIM A'
  `status` ENUM('available', 'on-duty', 'off') DEFAULT 'available',
  `trips_completed` INT DEFAULT 0,
  `rating` DECIMAL(3,2) DEFAULT 5.00,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. STORES (Toko Retail & Outlet Pelanggan)
CREATE TABLE IF NOT EXISTS `stores` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `store_code` VARCHAR(50) NOT NULL UNIQUE,
  `store_name` VARCHAR(191) NOT NULL,
  `island` VARCHAR(100) NOT NULL, -- 'Jawa', 'Bali & Nusa Tenggara', 'Sumatera', etc.
  `province` VARCHAR(100) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `address` TEXT NOT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `contact_person` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `delivery_window` VARCHAR(50) DEFAULT '08:00 - 17:00',
  `store_category` VARCHAR(50) DEFAULT 'Supermarket',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SCHEDULES (Jadwal Pengiriman & Penugasan Logistik)
CREATE TABLE IF NOT EXISTS `schedules` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `tracking_number` VARCHAR(100) NOT NULL UNIQUE,
  `origin_name` VARCHAR(191) DEFAULT 'Gudang Pusat Banyuwangi DC',
  `origin_latitude` DECIMAL(10, 8) DEFAULT -8.19060000,
  `origin_longitude` DECIMAL(11, 8) DEFAULT 114.37080000,
  `store_id` VARCHAR(64) NULL,
  `fleet_id` VARCHAR(64) NULL,
  `crew_id` VARCHAR(64) NULL,
  `status` ENUM('scheduled', 'in_transit', 'delivered', 'delayed') DEFAULT 'scheduled',
  `departure_date` DATETIME NOT NULL,
  `estimated_arrival` DATETIME NOT NULL,
  `actual_arrival` DATETIME NULL,
  `cargo_description` TEXT NOT NULL,
  `cargo_weight_ton` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `is_inter_island` TINYINT(1) DEFAULT 0,
  `ferry_booking_code` VARCHAR(100) NULL,
  `transit_port` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`fleet_id`) REFERENCES `fleets`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`crew_id`) REFERENCES `crews`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TRACKING_LOGS (Historis GPS & Tracking Operations)
CREATE TABLE IF NOT EXISTS `tracking_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `schedule_id` VARCHAR(64) NOT NULL,
  `timestamp` DATETIME NOT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `speed` DECIMAL(5, 2) DEFAULT 0.00,
  `engine_status` ENUM('RUNNING', 'STOP', 'IDLE') DEFAULT 'IDLE',
  `location_name` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. DATABRIDGE_SYNC_LOGS (Google Sheets & External API Sync Audit)
CREATE TABLE IF NOT EXISTS `databridge_sync_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('success', 'warning', 'error', 'in_progress') DEFAULT 'success',
  `source_type` VARCHAR(100) DEFAULT 'google_sheets_api',
  `sheet_name` VARCHAR(100) NULL,
  `stores_count` INT DEFAULT 0,
  `schedules_count` INT DEFAULT 0,
  `fleets_count` INT DEFAULT 0,
  `crews_count` INT DEFAULT 0,
  `details` JSON NULL,
  `message` TEXT NULL,
  `duration_ms` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. SPARE_PARTS (Inventaris & Stok Bengkel)
CREATE TABLE IF NOT EXISTS `spare_parts` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `stock` INT DEFAULT 0,
  `min_stock` INT DEFAULT 5,
  `unit_price` DECIMAL(12,2) DEFAULT 0.00,
  `supplier` VARCHAR(191) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. FUEL_LOGS (Pencatatan Klaim BBM & Efisiensi)
CREATE TABLE IF NOT EXISTS `fuel_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `fleet_id` VARCHAR(64) NOT NULL,
  `driver_name` VARCHAR(191) NOT NULL,
  `fuel_liters` DECIMAL(8,2) NOT NULL,
  `cost_rupiah` DECIMAL(12,2) NOT NULL,
  `odometer_km` INT NOT NULL,
  `spbu_location` VARCHAR(191) NOT NULL,
  `logged_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`fleet_id`) REFERENCES `fleets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
-- SEED DATA SETUP (Data Operasional Awal PT AKK Logistics)
-- ====================================================================

-- Default Users (Super Admin & Head of Logistics)
INSERT IGNORE INTO `users` (`id`, `email`, `password_hash`, `full_name`, `role`, `department`, `phone`, `status`) VALUES
('usr-001', 'bayun791@gmail.com', 'Bayu1509', 'Bayu Novianto Dimas Permana, S.Si', 'super_admin', 'Direksi Operasional & Supply Chain', '0812-1351-3590', 'approved'),
('usr-002', 'hendri@akk.co.id', 'Hendri', 'Hendri ST', 'spv_logistik', 'Head of Logistics', '0812-3456-7890', 'approved'),
('usr-003', 'zainul@akk.co.id', 'driver123', 'Zainul Agustiar', 'driver', 'Fleet Driver', '0821-4455-6677', 'approved');

-- Default Fleets (12 Unit Utama PT AKK Logistics)
INSERT IGNORE INTO `fleets` (`id`, `plate_number`, `vehicle_type`, `tonnage_capacity`, `current_tonnage`, `status`, `fuel_level_percent`, `odometer_km`, `year`) VALUES
('flt-001', 'P 8125 VC', 'Pick Up Box L300', 1.50, 1.20, 'on-duty', 85, 125400, 2022),
('flt-002', 'P 8509 VQ', 'Pick Up Box Traga', 1.80, 1.50, 'on-duty', 90, 98200, 2023),
('flt-003', 'P 8848 U', 'Engkel STD Canter', 3.50, 0.00, 'available', 100, 142100, 2021),
('flt-004', 'P 9677 VB', 'Engkel STD Canter', 3.50, 3.10, 'on-duty', 75, 115000, 2022),
('flt-005', 'P 8801 UV', 'Engkel STD Canter', 3.50, 0.00, 'available', 100, 131400, 2021),
('flt-006', 'P 8381 VE', 'Engkel Long Hino', 5.00, 0.00, 'maintenance', 50, 189000, 2020),
('flt-007', 'P 8711 UW', 'Engkel Long Hino', 5.00, 0.00, 'available', 95, 162300, 2021),
('flt-008', 'P 9281 VA', 'Double STD Hino', 8.00, 0.00, 'available', 90, 210500, 2019),
('flt-009', 'P 8928 UR', 'Double STD Hino', 8.00, 0.00, 'available', 80, 198000, 2020),
('flt-010', 'P 9194 SA', 'Double STD Hino', 8.00, 0.00, 'available', 85, 205000, 2019),
('flt-011', 'W 8229 US', 'Double STD Isuzu NMR', 8.00, 0.00, 'available', 90, 175400, 2022),
('flt-012', 'W 8603 PG', 'Double STD Isuzu NMR', 8.00, 0.00, 'available', 95, 168900, 2022);

-- Default Crews
INSERT IGNORE INTO `crews` (`id`, `name`, `phone`, `role`, `license_number`, `license_type`, `status`, `trips_completed`) VALUES
('crw-001', 'Zainul Agustiar', '0821-4455-6677', 'Driver Utama', 'B2U-99882211', 'SIM B2 Umum', 'on-duty', 142),
('crw-002', 'Aan Adi Saputra', '0821-4455-6688', 'Kernet / Helper', 'HLP-10293847', 'SIM A', 'on-duty', 110),
('crw-003', 'Ach Taufiq', '0813-8877-6655', 'Driver Utama', 'B2U-77665544', 'SIM B2 Umum', 'on-duty', 128),
('crw-004', 'Bintang Wahyu Pratama', '0813-8877-6666', 'Kernet / Helper', 'HLP-20394857', 'SIM A', 'on-duty', 95),
('crw-005', 'Aldi Wahyu Pradana', '0857-1122-3344', 'Driver Utama', 'B1U-55443322', 'SIM B1 Umum', 'available', 86),
('crw-006', 'Alphian Bayu Nugraha', '0857-1122-3355', 'Kernet / Helper', 'HLP-30495867', 'SIM A', 'available', 78),
('crw-007', 'Suwarno', '0812-9900-1122', 'Driver Cadangan', 'B2U-33221100', 'SIM B2 Umum', 'available', 65),
('crw-008', 'Adit', '0812-9900-1133', 'Driver Cadangan', 'B1U-44332211', 'SIM B1 Umum', 'available', 52);

-- Default Stores
INSERT IGNORE INTO `stores` (`id`, `store_code`, `store_name`, `island`, `province`, `city`, `address`, `latitude`, `longitude`, `contact_person`, `phone`, `store_category`) VALUES
('str-001', 'STR-BALI-01', 'Hypermart Mall Bali Galleria', 'Bali & Nusa Tenggara', 'Bali', 'Badung', 'Jl. Bypass Ngurah Rai, Kuta, Badung, Bali', -8.71880000, 115.18340000, 'I Made Suardana', '0819-3344-5566', 'Hypermarket'),
('str-002', 'STR-SBY-02', 'Lotte Grosir Surabaya', 'Jawa', 'Jawa Timur', 'Surabaya', 'Jl. Raya Mastrip No.5, Warugunung, Surabaya', -7.34120000, 112.69800000, 'Budi Santoso', '0812-8899-0011', 'Distribution Hub'),
('str-003', 'STR-BPN-03', 'Transmart Balikpapan', 'Kalimantan', 'Kalimantan Timur', 'Balikpapan', 'Jl. MT Haryono No.18, Balikpapan', -1.24830000, 116.86120000, 'Eko Prasetyo', '0822-7766-5544', 'Hypermarket'),
('str-004', 'STR-BWI-04', 'Abba Mart Sobo Banyuwangi', 'Jawa', 'Jawa Timur', 'Banyuwangi', 'Jl. S. Parman No.42, Sobo, Banyuwangi', -8.22510000, 114.36820000, 'Hj. Fatimah', '0813-1122-3344', 'Supermarket');

-- Default Schedules
INSERT IGNORE INTO `schedules` (`id`, `tracking_number`, `origin_name`, `origin_latitude`, `origin_longitude`, `store_id`, `fleet_id`, `crew_id`, `status`, `departure_date`, `estimated_arrival`, `cargo_description`, `cargo_weight_ton`, `is_inter_island`, `ferry_booking_code`, `transit_port`) VALUES
('sch-001', 'TRK-2026-09-082', 'Gudang Pusat Banyuwangi DC', -8.19060000, 114.37080000, 'str-001', 'flt-001', 'crw-001', 'in_transit', '2026-09-10 08:00:00', '2026-09-10 16:00:00', 'Karton Kemasan Makanan & Botol Plastik (120 Karton)', 1.20, 1, 'ASDP-KTG-GIL-882109', 'Pelabuhan Ketapang'),
('sch-002', 'TRK-2026-09-083', 'Gudang Pusat Banyuwangi DC', -8.19060000, 114.37080000, 'str-002', 'flt-002', 'crw-003', 'in_transit', '2026-09-10 09:30:00', '2026-09-10 18:00:00', 'Kemasan Fleksibel Standup Pouch (150 Box)', 1.50, 0, NULL, NULL),
('sch-003', 'TRK-2026-09-084', 'Gudang Pusat Banyuwangi DC', -8.19060000, 114.37080000, 'str-003', 'flt-004', 'crw-005', 'scheduled', '2026-09-11 06:00:00', '2026-09-13 12:00:00', 'Palet Kemasan Produk Industri Fast Moving Consumer Goods', 3.10, 1, 'PELNI-DF7-99201', 'Pelabuhan Tanjung Perak');

SET FOREIGN_KEY_CHECKS = 1;
