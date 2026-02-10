import sqlite3
import os
from datetime import datetime, timezone, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

VN_TZ = timezone(timedelta(hours=7))


def vn_now():
    return datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S")

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_message TEXT NOT NULL,
            converted_message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS short_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            short_code TEXT UNIQUE NOT NULL,
            target_url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            click_count INTEGER DEFAULT 0,
            created_by TEXT DEFAULT NULL
        )
    """)
    # Migration: thêm cột created_by nếu DB cũ chưa có
    try:
        conn.execute("ALTER TABLE short_links ADD COLUMN created_by TEXT DEFAULT NULL")
    except sqlite3.OperationalError:
        pass  # cột đã tồn tại
    conn.commit()

    # Create default admin user if not exists
    row = conn.execute("SELECT id FROM users WHERE username = ?", ("kimngan",)).fetchone()
    if not row:
        pw_hash = generate_password_hash("Kn@1802")
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            ("kimngan", pw_hash),
        )
        conn.commit()

    conn.close()


def cleanup_old_history(days=14):
    conn = get_db()
    cutoff = (datetime.now(VN_TZ) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("DELETE FROM history WHERE created_at < ?", (cutoff,))
    conn.commit()
    conn.close()


def verify_user(username, password):
    conn = get_db()
    row = conn.execute(
        "SELECT password_hash FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()
    if row and check_password_hash(row["password_hash"], password):
        return True
    return False


def get_setting(key, default=""):
    conn = get_db()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(key, value):
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (key, value),
    )
    conn.commit()
    conn.close()


def add_history(original, converted):
    conn = get_db()
    conn.execute(
        "INSERT INTO history (original_message, converted_message, created_at) VALUES (?, ?, ?)",
        (original, converted, vn_now()),
    )
    conn.commit()
    conn.close()


def get_history(limit=20):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM history ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ============================================================
#  SHORT LINKS
# ============================================================

def create_short_link(short_code, target_url, created_by=None):
    conn = get_db()
    conn.execute(
        "INSERT INTO short_links (short_code, target_url, created_by, created_at) VALUES (?, ?, ?, ?)",
        (short_code, target_url, created_by, vn_now()),
    )
    conn.commit()
    conn.close()


def get_short_link(short_code):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM short_links WHERE short_code = ?", (short_code,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def find_short_link_by_target(target_url):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM short_links WHERE target_url = ?", (target_url,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_short_link_created_by(short_code, created_by):
    conn = get_db()
    conn.execute(
        "UPDATE short_links SET created_by = ? WHERE short_code = ?",
        (created_by, short_code),
    )
    conn.commit()
    conn.close()


def increment_click(short_code):
    conn = get_db()
    conn.execute(
        "UPDATE short_links SET click_count = click_count + 1 WHERE short_code = ?",
        (short_code,),
    )
    conn.commit()
    conn.close()


def get_all_short_links(limit=100):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM short_links ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def cleanup_old_short_links(days=30):
    conn = get_db()
    cutoff = (datetime.now(VN_TZ) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("DELETE FROM short_links WHERE created_at < ?", (cutoff,))
    conn.commit()
    conn.close()


def delete_short_link(link_id):
    conn = get_db()
    conn.execute("DELETE FROM short_links WHERE id = ?", (link_id,))
    conn.commit()
    conn.close()


def get_admin_short_links(search="", date_from="", date_to=""):
    conn = get_db()
    query = "SELECT * FROM short_links WHERE created_by IS NOT NULL"
    params = []
    if search:
        query += " AND (short_code LIKE ? OR target_url LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    if date_from:
        query += " AND date(created_at) >= ?"
        params.append(date_from)
    if date_to:
        query += " AND date(created_at) <= ?"
        params.append(date_to)
    query += " ORDER BY created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]
