"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/admin/convert-link");
        router.refresh();
      } else {
        setError(data.error || "Sai tai khoan hoac mat khau");
      }
    } catch {
      setError("Loi ket noi server");
    }
    setLoading(false);
  }

  return (
    <>
      <style jsx>{`
        .login-wrapper { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 16px; }
        .login-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 36px 32px; width: 100%; max-width: 380px; }
        .login-header { text-align: center; margin-bottom: 28px; }
        .login-header h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 700; font-style: italic; color: var(--primary); margin-bottom: 6px; }
        .login-header p { font-size: 13px; color: var(--text-muted); font-weight: 500; }
        .login-field { margin-bottom: 16px; }
        .login-field label { display: block; font-size: 13px; font-weight: 700; color: var(--text-sec); margin-bottom: 6px; }
        .login-btn { width: 100%; margin-top: 8px; padding: 12px; font-size: 15px; }
        .login-error { background: #FFEBEE; color: #C62828; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 16px; text-align: center; }
        @media (max-width: 768px) { .login-card { padding: 28px 20px; } .login-header h2 { font-size: 22px; } }
      `}</style>

      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <h2>Dang nhap</h2>
            <p>Vui long dang nhap de su dung dashboard</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label>Tai khoan</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Nhap ten dang nhap" required autoFocus />
            </div>
            <div className="login-field">
              <label>Mat khau</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhap mat khau" required />
            </div>
            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? "Dang xu ly..." : "Dang nhap"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
