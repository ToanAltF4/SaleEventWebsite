import os
from datetime import datetime, timezone, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import pymysql
from pymysql.cursors import DictCursor

load_dotenv()

VN_TZ = timezone(timedelta(hours=7))


def vn_now():
    return datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S")


# MySQL connection config from environment
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "saleevent"),
    "charset": "utf8mb4",
    "cursorclass": DictCursor,
}


def get_db():
    return pymysql.connect(**DB_CONFIG)


def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            `key` VARCHAR(255) PRIMARY KEY,
            `value` TEXT NOT NULL
        ) ENGINE=InnoDB
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            original_message TEXT NOT NULL,
            converted_message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    """)
    cur.execute("""
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
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS multi_affids (
            id INT AUTO_INCREMENT PRIMARY KEY,
            affid VARCHAR(255) NOT NULL,
            name VARCHAR(255) DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    """)
    cur.execute("""
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
    """)
    conn.commit()

    # Create default admin user if not exists
    cur.execute("SELECT id FROM users WHERE username = %s", ("kimngan",))
    row = cur.fetchone()
    if not row:
        pw_hash = generate_password_hash("Kn@1802")
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
            ("kimngan", pw_hash),
        )
        conn.commit()

    cur.close()
    conn.close()


def cleanup_old_history(days=14):
    conn = get_db()
    cur = conn.cursor()
    cutoff = (datetime.now(VN_TZ) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("DELETE FROM history WHERE created_at < %s", (cutoff,))
    conn.commit()
    cur.close()
    conn.close()


def verify_user(username, password):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM users WHERE username = %s", (username,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row and check_password_hash(row["password_hash"], password):
        return True
    return False


def get_setting(key, default=""):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT `value` FROM settings WHERE `key` = %s", (key,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row["value"] if row else default


def set_setting(key, value):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO settings (`key`, `value`) VALUES (%s, %s) ON DUPLICATE KEY UPDATE `value` = %s",
        (key, value, value),
    )
    conn.commit()
    cur.close()
    conn.close()


def add_history(original, converted):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO history (original_message, converted_message, created_at) VALUES (%s, %s, %s)",
        (original, converted, vn_now()),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_history(limit=20):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM history ORDER BY created_at DESC LIMIT %s", (limit,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


# ============================================================
#  SHORT LINKS
# ============================================================

def create_short_link(short_code, target_url, created_by=None):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO short_links (short_code, target_url, created_by, created_at) VALUES (%s, %s, %s, %s)",
        (short_code, target_url, created_by, vn_now()),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_short_link(short_code):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM short_links WHERE short_code = %s", (short_code,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row


def find_short_link_by_target(target_url):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM short_links WHERE target_url = %s", (target_url,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row


def update_short_link_created_by(short_code, created_by):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "UPDATE short_links SET created_by = %s WHERE short_code = %s",
        (created_by, short_code),
    )
    conn.commit()
    cur.close()
    conn.close()


def increment_click(short_code):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "UPDATE short_links SET click_count = click_count + 1 WHERE short_code = %s",
        (short_code,),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_all_short_links(limit=100):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM short_links ORDER BY created_at DESC LIMIT %s", (limit,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def cleanup_old_short_links(days=30):
    conn = get_db()
    cur = conn.cursor()
    cutoff = (datetime.now(VN_TZ) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("DELETE FROM short_links WHERE created_at < %s", (cutoff,))
    conn.commit()
    cur.close()
    conn.close()


def delete_short_link(link_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM short_links WHERE id = %s", (link_id,))
    conn.commit()
    cur.close()
    conn.close()


# ============================================================
#  MULTI AFFILIATE
# ============================================================

def create_multi_affid(affid, name=""):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO multi_affids (affid, name, created_at) VALUES (%s, %s, %s)",
        (affid, name, vn_now()),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_all_multi_affids():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM multi_affids ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def get_multi_affid(affid_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM multi_affids WHERE id = %s", (affid_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row


def delete_multi_affid(affid_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM multi_affid_links WHERE affid_id = %s", (affid_id,))
    cur.execute("DELETE FROM multi_affids WHERE id = %s", (affid_id,))
    conn.commit()
    cur.close()
    conn.close()


def create_multi_affid_link(affid_id, short_code, target_url, original_url):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO multi_affid_links (affid_id, short_code, target_url, original_url, created_at, click_count) VALUES (%s, %s, %s, %s, %s, 0)",
        (affid_id, short_code, target_url, original_url, vn_now()),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_multi_affid_link(short_code):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM multi_affid_links WHERE short_code = %s", (short_code,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row


def find_multi_affid_link_by_target(affid_id, target_url):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM multi_affid_links WHERE affid_id = %s AND target_url = %s",
        (affid_id, target_url),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row


def increment_multi_affid_click(short_code):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "UPDATE multi_affid_links SET click_count = click_count + 1 WHERE short_code = %s",
        (short_code,),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_multi_affid_links(affid_id, page=1, per_page=10):
    conn = get_db()
    cur = conn.cursor()
    offset = (page - 1) * per_page
    cur.execute(
        "SELECT COUNT(*) as cnt FROM multi_affid_links WHERE affid_id = %s", (affid_id,)
    )
    total = cur.fetchone()["cnt"]
    cur.execute(
        "SELECT * FROM multi_affid_links WHERE affid_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (affid_id, per_page, offset),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows, total


def get_multi_affid_total_clicks(affid_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT COALESCE(SUM(click_count), 0) as total FROM multi_affid_links WHERE affid_id = %s",
        (affid_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row["total"]


def cleanup_old_multi_affid_links(days=30):
    conn = get_db()
    cur = conn.cursor()
    cutoff = (datetime.now(VN_TZ) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("DELETE FROM multi_affid_links WHERE created_at < %s", (cutoff,))
    conn.commit()
    cur.close()
    conn.close()


def get_admin_short_links(search="", date_from="", date_to=""):
    conn = get_db()
    cur = conn.cursor()
    query = "SELECT * FROM short_links WHERE created_by IS NOT NULL"
    params = []
    if search:
        query += " AND (short_code LIKE %s OR target_url LIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])
    if date_from:
        query += " AND DATE(created_at) >= %s"
        params.append(date_from)
    if date_to:
        query += " AND DATE(created_at) <= %s"
        params.append(date_to)
    query += " ORDER BY created_at DESC"
    cur.execute(query, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows
