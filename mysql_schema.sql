-- =============================================
-- MySQL Schema cho SaleEventWebsite
-- Chạy file này trên MySQL VPS để tạo database
-- =============================================

CREATE DATABASE IF NOT EXISTS saleevent
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE saleevent;

-- Bảng cấu hình
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(255) PRIMARY KEY,
    `value` TEXT NOT NULL
) ENGINE=InnoDB;

-- Bảng lịch sử AI content
CREATE TABLE IF NOT EXISTS history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_message TEXT NOT NULL,
    converted_message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng user đăng nhập
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng short links (chức năng rút gọn link chính)
CREATE TABLE IF NOT EXISTS short_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    short_code VARCHAR(50) UNIQUE NOT NULL,
    target_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    click_count INT DEFAULT 0,
    created_by VARCHAR(100) DEFAULT NULL,
    INDEX idx_short_code (short_code),
    INDEX idx_created_by (created_by),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Bảng multi affiliate IDs
CREATE TABLE IF NOT EXISTS multi_affids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    affid VARCHAR(255) NOT NULL,
    name VARCHAR(255) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng links cho multi affiliate
CREATE TABLE IF NOT EXISTS multi_affid_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    affid_id INT NOT NULL,
    short_code VARCHAR(50) UNIQUE NOT NULL,
    target_url TEXT NOT NULL,
    original_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    click_count INT DEFAULT 0,
    INDEX idx_affid_id (affid_id),
    INDEX idx_short_code_multi (short_code),
    INDEX idx_created_at_multi (created_at),
    FOREIGN KEY (affid_id) REFERENCES multi_affids(id) ON DELETE CASCADE
) ENGINE=InnoDB;
