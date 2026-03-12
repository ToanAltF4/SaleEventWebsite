import mysql from "mysql2/promise";
import { hashSync, compareSync } from "bcryptjs";

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "saleevent",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 3,
};

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

function vnNow(): string {
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().slice(0, 19).replace("T", " ");
}

// ============================================================
//  INIT
// ============================================================

export async function initDb() {
  const db = getPool();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(255) PRIMARY KEY,
      \`value\` TEXT NOT NULL
    ) ENGINE=InnoDB
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      original_message TEXT NOT NULL,
      converted_message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS short_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      short_code VARCHAR(50) UNIQUE NOT NULL,
      target_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      click_count INT DEFAULT 0,
      created_by VARCHAR(100) DEFAULT NULL,
      INDEX idx_short_code (short_code),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS multi_affids (
      id INT AUTO_INCREMENT PRIMARY KEY,
      affid VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await db.execute(`
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
      FOREIGN KEY (affid_id) REFERENCES multi_affids(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  // Create default admin user if not exists
  const defaultUser = process.env.ADMIN_USER || "admin";
  const defaultPass = process.env.ADMIN_PASS || "changeme123!@#changemeplease";
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM users WHERE username = ?",
    [defaultUser]
  );
  if (rows.length === 0) {
    const pwHash = hashSync(defaultPass, 10);
    await db.execute(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [defaultUser, pwHash]
    );
  }
}

// ============================================================
//  CLEANUP
// ============================================================

export async function cleanupOldHistory(days = 14) {
  const db = getPool();
  const cutoff = new Date(Date.now() + 7 * 3600000 - days * 86400000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  await db.execute("DELETE FROM history WHERE created_at < ?", [cutoff]);
}

export async function cleanupOldShortLinks(days = 30) {
  const db = getPool();
  const cutoff = new Date(Date.now() + 7 * 3600000 - days * 86400000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  await db.execute("DELETE FROM short_links WHERE created_at < ?", [cutoff]);
}

export async function cleanupOldMultiAffidLinks(days = 30) {
  const db = getPool();
  const cutoff = new Date(Date.now() + 7 * 3600000 - days * 86400000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  await db.execute("DELETE FROM multi_affid_links WHERE created_at < ?", [cutoff]);
}

// ============================================================
//  AUTH
// ============================================================

export async function verifyUser(username: string, password: string): Promise<boolean> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT password_hash FROM users WHERE username = ?",
    [username]
  );
  if (rows.length === 0) return false;
  return compareSync(password, rows[0].password_hash);
}

// ============================================================
//  SETTINGS
// ============================================================

export async function getSetting(key: string, defaultValue = ""): Promise<string> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT `value` FROM settings WHERE `key` = ?",
    [key]
  );
  return rows.length > 0 ? rows[0].value : defaultValue;
}

export async function setSetting(key: string, value: string) {
  const db = getPool();
  await db.execute(
    "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
    [key, value, value]
  );
}

// ============================================================
//  HISTORY
// ============================================================

export async function addHistory(original: string, converted: string) {
  const db = getPool();
  await db.execute(
    "INSERT INTO history (original_message, converted_message, created_at) VALUES (?, ?, ?)",
    [original, converted, vnNow()]
  );
}

export async function getHistory(limit = 20): Promise<mysql.RowDataPacket[]> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM history ORDER BY created_at DESC LIMIT ?",
    [String(limit)]
  );
  return rows;
}

// ============================================================
//  SHORT LINKS
// ============================================================

export async function createShortLink(shortCode: string, targetUrl: string, createdBy: string | null = null) {
  const db = getPool();
  await db.execute(
    "INSERT INTO short_links (short_code, target_url, created_by, created_at) VALUES (?, ?, ?, ?)",
    [shortCode, targetUrl, createdBy, vnNow()]
  );
}

export async function getShortLink(shortCode: string): Promise<mysql.RowDataPacket | null> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM short_links WHERE short_code = ?",
    [shortCode]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function findShortLinkByTarget(targetUrl: string): Promise<mysql.RowDataPacket | null> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM short_links WHERE target_url = ?",
    [targetUrl]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function updateShortLinkCreatedBy(shortCode: string, createdBy: string) {
  const db = getPool();
  await db.execute(
    "UPDATE short_links SET created_by = ? WHERE short_code = ?",
    [createdBy, shortCode]
  );
}

export async function incrementClick(shortCode: string) {
  const db = getPool();
  await db.execute(
    "UPDATE short_links SET click_count = click_count + 1 WHERE short_code = ?",
    [shortCode]
  );
}

export async function getAdminShortLinks(search = "", dateFrom = "", dateTo = ""): Promise<mysql.RowDataPacket[]> {
  const db = getPool();
  let query = "SELECT * FROM short_links WHERE created_by IS NOT NULL";
  const params: string[] = [];

  if (search) {
    query += " AND (short_code LIKE ? OR target_url LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (dateFrom) {
    query += " AND DATE(created_at) >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    query += " AND DATE(created_at) <= ?";
    params.push(dateTo);
  }
  query += " ORDER BY created_at DESC";

  const [rows] = await db.execute<mysql.RowDataPacket[]>(query, params);
  return rows;
}

// ============================================================
//  MULTI AFFILIATE
// ============================================================

export async function createMultiAffid(affid: string, name = "") {
  const db = getPool();
  await db.execute(
    "INSERT INTO multi_affids (affid, name, created_at) VALUES (?, ?, ?)",
    [affid, name, vnNow()]
  );
}

export async function getAllMultiAffids(): Promise<mysql.RowDataPacket[]> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM multi_affids ORDER BY created_at DESC"
  );
  return rows;
}

export async function getMultiAffid(affidId: number): Promise<mysql.RowDataPacket | null> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM multi_affids WHERE id = ?",
    [affidId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function deleteMultiAffid(affidId: number) {
  const db = getPool();
  await db.execute("DELETE FROM multi_affid_links WHERE affid_id = ?", [affidId]);
  await db.execute("DELETE FROM multi_affids WHERE id = ?", [affidId]);
}

export async function createMultiAffidLink(affidId: number, shortCode: string, targetUrl: string, originalUrl: string) {
  const db = getPool();
  await db.execute(
    "INSERT INTO multi_affid_links (affid_id, short_code, target_url, original_url, created_at, click_count) VALUES (?, ?, ?, ?, ?, 0)",
    [affidId, shortCode, targetUrl, originalUrl, vnNow()]
  );
}

export async function getMultiAffidLink(shortCode: string): Promise<mysql.RowDataPacket | null> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM multi_affid_links WHERE short_code = ?",
    [shortCode]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function findMultiAffidLinkByTarget(affidId: number, targetUrl: string): Promise<mysql.RowDataPacket | null> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM multi_affid_links WHERE affid_id = ? AND target_url = ?",
    [affidId, targetUrl]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function incrementMultiAffidClick(shortCode: string) {
  const db = getPool();
  await db.execute(
    "UPDATE multi_affid_links SET click_count = click_count + 1 WHERE short_code = ?",
    [shortCode]
  );
}

export async function getMultiAffidLinks(affidId: number, page = 1, perPage = 10): Promise<{ links: mysql.RowDataPacket[]; total: number }> {
  const db = getPool();
  const offset = (page - 1) * perPage;

  const [countRows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as cnt FROM multi_affid_links WHERE affid_id = ?",
    [affidId]
  );
  const total = countRows[0].cnt;

  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM multi_affid_links WHERE affid_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [affidId, String(perPage), String(offset)]
  );

  return { links: rows, total };
}

export async function getMultiAffidTotalClicks(affidId: number): Promise<number> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT COALESCE(SUM(click_count), 0) as total FROM multi_affid_links WHERE affid_id = ?",
    [affidId]
  );
  return rows[0].total;
}
