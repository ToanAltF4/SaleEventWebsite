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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS multi_affids (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            affid TEXT NOT NULL,
            name TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS multi_affid_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            affid_id INTEGER NOT NULL,
            short_code TEXT UNIQUE NOT NULL,
            target_url TEXT NOT NULL,
            original_url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            click_count INTEGER DEFAULT 0,
            FOREIGN KEY (affid_id) REFERENCES multi_affids(id)
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


# ============================================================
#  MULTI AFFILIATE
# ============================================================

def create_multi_affid(affid, name=""):
    conn = get_db()
    conn.execute(
        "INSERT INTO multi_affids (affid, name, created_at) VALUES (?, ?, ?)",
        (affid, name, vn_now()),
    )
    conn.commit()
    conn.close()


def get_all_multi_affids():
    conn = get_db()
    rows = conn.execute("SELECT * FROM multi_affids ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_multi_affid(affid_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM multi_affids WHERE id = ?", (affid_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_multi_affid(affid_id):
    conn = get_db()
    conn.execute("DELETE FROM multi_affid_links WHERE affid_id = ?", (affid_id,))
    conn.execute("DELETE FROM multi_affids WHERE id = ?", (affid_id,))
    conn.commit()
    conn.close()


def create_multi_affid_link(affid_id, short_code, target_url, original_url):
    conn = get_db()
    conn.execute(
        "INSERT INTO multi_affid_links (affid_id, short_code, target_url, original_url, created_at, click_count) VALUES (?, ?, ?, ?, ?, 0)",
        (affid_id, short_code, target_url, original_url, vn_now()),
    )
    conn.commit()
    conn.close()


def get_multi_affid_link(short_code):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM multi_affid_links WHERE short_code = ?", (short_code,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def find_multi_affid_link_by_target(affid_id, target_url):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM multi_affid_links WHERE affid_id = ? AND target_url = ?",
        (affid_id, target_url),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def increment_multi_affid_click(short_code):
    conn = get_db()
    conn.execute(
        "UPDATE multi_affid_links SET click_count = click_count + 1 WHERE short_code = ?",
        (short_code,),
    )
    conn.commit()
    conn.close()


def get_multi_affid_links(affid_id, page=1, per_page=10):
    conn = get_db()
    offset = (page - 1) * per_page
    total = conn.execute(
        "SELECT COUNT(*) as cnt FROM multi_affid_links WHERE affid_id = ?", (affid_id,)
    ).fetchone()["cnt"]
    rows = conn.execute(
        "SELECT * FROM multi_affid_links WHERE affid_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (affid_id, per_page, offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows], total


def get_multi_affid_total_clicks(affid_id):
    conn = get_db()
    row = conn.execute(
        "SELECT COALESCE(SUM(click_count), 0) as total FROM multi_affid_links WHERE affid_id = ?",
        (affid_id,),
    ).fetchone()
    conn.close()
    return row["total"]


def cleanup_old_multi_affid_links(days=30):
    conn = get_db()
    cutoff = (datetime.now(VN_TZ) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("DELETE FROM multi_affid_links WHERE created_at < ?", (cutoff,))
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
