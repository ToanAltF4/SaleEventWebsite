"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function AdminShell({ user, children }: { user: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<Array<{ id: number; converted_message: string; created_at: string }>>([]);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [cookieValue, setCookieValue] = useState("");
  const [cookieStatus, setCookieStatus] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => {
    if (historyOpen) {
      fetch("/api/history").then(r => r.json()).then(setHistoryData).catch(() => {});
    }
  }, [historyOpen]);

  async function openCookieModal() {
    setCookieModalOpen(true);
    try {
      const res = await fetch("/api/get-cookie");
      const data = await res.json();
      if (data.cookie) setCookieValue(data.cookie);
    } catch {}
  }

  async function saveCookieModal() {
    if (!cookieValue.trim()) {
      setCookieStatus({ msg: "Vui lòng nhập cookie", type: "error" });
      return;
    }
    try {
      const res = await fetch("/api/save-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setCookieStatus({ msg: "Đã lưu cookie thành công!", type: "success" });
        setTimeout(() => { setCookieModalOpen(false); setCookieStatus(null); }, 1500);
      } else {
        setCookieStatus({ msg: data.error || "Lỗi lưu cookie", type: "error" });
      }
    } catch {
      setCookieStatus({ msg: "Lỗi kết nối server", type: "error" });
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const navItems = [
    { href: "/admin/convert-link", label: "Chuyển đổi Link" },
    { href: "/admin/ai-content", label: "AI Tạo nội dung" },
    { href: "/admin/click-report", label: "Báo Cáo Click" },
    { href: "/admin/multi-affid", label: "Multi Affiliate" },
  ];

  return (
    <>
      <div className="admin-body">
        <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>&#9776;</button>
        <button className="toggle-history" onClick={() => setHistoryOpen(!historyOpen)}>Lịch sử</button>
        <div className={`overlay ${sidebarOpen ? "active" : ""}`} onClick={() => setSidebarOpen(false)} />

        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-top">
            <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>&times;</button>
          </div>
          <nav className="sidebar-nav">
            {navItems.map(item => (
              <a key={item.href} className={`nav-item ${pathname === item.href ? "active" : ""}`} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className="sidebar-home" onClick={openCookieModal} style={{color:'var(--primary)'}}>Cập nhật Cookie</button>
            <a href="/" className="sidebar-home">Trang chủ</a>
            <div className="sidebar-footer">
              <span className="sidebar-user">{user}</span>
              <button className="sidebar-logout" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        </aside>

        {/* HISTORY PANEL */}
        <aside className={`history-panel ${historyOpen ? "open" : ""}`}>
          <div className="history-header">
            <h3>Lịch sử chuyển đổi</h3>
            <button className="history-close" onClick={() => setHistoryOpen(false)}>&times;</button>
          </div>
          <div className="history-list">
            {historyData.length > 0 ? historyData.map(item => (
              <div key={item.id} className="history-item">
                <div className="history-preview">{item.converted_message?.substring(0, 60)}</div>
                <div className="history-time">{item.created_at}</div>
              </div>
            )) : (
              <div style={{padding:'24px 16px', fontSize:'13px', color:'var(--text-muted)', textAlign:'center', fontWeight:600}}>
                Chưa có lịch sử
              </div>
            )}
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="main-header">
            <h2>Săn Sale Cùng Kim Ngân</h2>
            <p>Chuyển đổi link Affiliate nhanh chóng</p>
          </div>
          <div className={`main-body ${pathname === "/admin/multi-affid" ? "wide" : ""}`}>
            {children}
          </div>
          <div className="main-footer">
            &copy; 2026 <span className="accent">Săn Sale Cùng Kim Ngân</span> &middot; Dev by <span className="accent">Phạm Toàn</span>
          </div>
        </main>

        {/* COOKIE MODAL */}
        <div className={`cookie-modal-overlay ${cookieModalOpen ? "active" : ""}`} onClick={e => { if (e.target === e.currentTarget) { setCookieModalOpen(false); setCookieStatus(null); } }}>
          <div className="cookie-modal">
            <h3>Cập nhật Cookie Shopee</h3>
            <p>Dán cookie từ affiliate.shopee.vn vào đây. Cookie dùng để tạo shortlink cho người dùng trang chủ.</p>
            <textarea value={cookieValue} onChange={e => setCookieValue(e.target.value)} placeholder="Dán cookie vào đây..." />
            {cookieStatus && <div className={`status ${cookieStatus.type}`}>{cookieStatus.msg}</div>}
            <div className="cookie-modal-actions">
              <button className="btn btn-primary" onClick={saveCookieModal}>Lưu Cookie</button>
              <button className="btn btn-outline" onClick={() => { setCookieModalOpen(false); setCookieStatus(null); }}>Đóng</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
