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
      <style jsx>{`
        .admin-body { display: flex; min-height: 100vh; }
        .sidebar { width: 230px; background: var(--card-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; z-index: 100; transition: transform 0.3s ease; position: fixed; top: 0; left: 0; bottom: 0; }
        .sidebar-top { padding: 16px 20px; border-bottom: 1px solid var(--border); display: none; justify-content: flex-end; }
        .sidebar-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-sec); padding: 2px 6px; }
        .sidebar-close:hover { color: var(--primary); }
        .sidebar-nav { flex: 1; padding: 16px 0; }
        .nav-item { display: block; padding: 13px 20px; font-size: 14px; font-weight: 600; color: var(--text-sec); text-decoration: none; border-left: 3px solid transparent; transition: all 0.15s; }
        .nav-item:hover { background: var(--primary-bg); color: var(--text); }
        .nav-item.active { background: var(--primary-bg); color: var(--primary); border-left-color: var(--primary); }
        .sidebar-bottom { border-top: 1px solid var(--border); }
        .sidebar-home { display: block; padding: 12px 20px; font-size: 13px; font-weight: 700; color: var(--text-sec); text-decoration: none; transition: all 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Quicksand', sans-serif; }
        .sidebar-home:hover { background: var(--primary-bg); color: var(--primary); }
        .sidebar-footer { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .sidebar-user { font-size: 13px; font-weight: 700; color: var(--text); }
        .sidebar-logout { font-size: 12px; font-weight: 700; color: var(--primary); text-decoration: none; cursor: pointer; background: none; border: none; font-family: 'Quicksand', sans-serif; }
        .sidebar-logout:hover { text-decoration: underline; }
        .main { margin-left: 230px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; transition: margin 0.3s ease; }
        .main-header { background: var(--primary); padding: 24px 32px; color: #fff; text-align: center; }
        .main-header h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; font-style: italic; }
        .main-header p { font-size: 14px; margin-top: 6px; opacity: 0.9; font-weight: 500; }
        .main-body { flex: 1; padding: 20px 32px; max-width: 760px; margin: 0 auto; width: 100%; }
        .main-body.wide { max-width: 960px; }
        .main-footer { padding: 18px 24px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text-muted); border-top: 1px solid var(--border); background: var(--card-bg); margin-top: auto; }
        .main-footer .accent { color: var(--primary); }
        .toggle-sidebar { display: none; position: fixed; top: 10px; left: 12px; z-index: 200; background: rgba(255,255,255,0.9); border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; cursor: pointer; font-size: 18px; color: var(--primary); }
        .toggle-history { position: fixed; top: 14px; right: 14px; z-index: 40; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 7px 14px; cursor: pointer; font-size: 13px; font-weight: 700; font-family: 'Quicksand', sans-serif; color: var(--primary); }
        .toggle-history:hover { background: var(--primary-bg); }
        .history-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 280px; background: var(--card-bg); border-left: 1px solid var(--border); z-index: 30; display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.3s ease; }
        .history-panel.open { transform: translateX(0); }
        .history-header { padding: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .history-header h3 { font-size: 14px; font-weight: 700; color: var(--text); }
        .history-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-sec); }
        .history-close:hover { color: var(--primary); }
        .history-list { flex: 1; overflow-y: auto; padding: 4px 0; }
        .history-item { padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--primary-bg); }
        .history-item:hover { background: var(--primary-bg); }
        .history-preview { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .history-time { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 50; }
        .overlay.active { display: block; }
        .cookie-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 500; align-items: center; justify-content: center; }
        .cookie-modal-overlay.active { display: flex; }
        .cookie-modal { background: var(--card-bg); border-radius: 14px; padding: 24px; width: 90%; max-width: 520px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); }
        .cookie-modal h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 700; font-style: italic; color: var(--primary); margin-bottom: 6px; }
        .cookie-modal p { font-size: 12px; color: var(--text-sec); margin-bottom: 14px; }
        .cookie-modal textarea { min-height: 100px; font-size: 13px; }
        .cookie-modal-actions { display: flex; gap: 8px; margin-top: 12px; }
        .cookie-modal-actions .btn { flex: 1; }

        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .sidebar-top { display: flex; }
          .toggle-sidebar { display: block; }
          .main { margin-left: 0; }
          .main-header { padding: 16px 16px; padding-top: 50px; text-align: center; }
          .main-header h2 { font-size: 20px; }
          .main-header p { font-size: 12px; }
          .main-body { padding: 14px; }
          .main-footer { padding: 14px 16px; }
        }
      `}</style>

      <div className="admin-body" suppressHydrationWarning>
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
