import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash

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
    conn.execute(
        "DELETE FROM history WHERE created_at < datetime('now', ?)",
        (f"-{days} days",),
    )
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
        "INSERT INTO history (original_message, converted_message) VALUES (?, ?)",
        (original, converted),
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
