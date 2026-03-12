"use client";

import { useState } from "react";

export default function ConvertLinkClient({ affiliateId: initialAffId }: { affiliateId: string }) {
  const [affId, setAffId] = useState(initialAffId);
  const [affStatus, setAffStatus] = useState<{ msg: string; type: string } | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [linkStatus, setLinkStatus] = useState<{ msg: string; type: string } | null>(null);
  const [linkResult, setLinkResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function saveAffiliate() {
    if (!affId.trim()) { setAffStatus({ msg: "Vui lòng nhập Affiliate ID", type: "error" }); return; }
    try {
      const res = await fetch("/api/save-affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliate_id: affId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setAffStatus({ msg: "Đã lưu thành công!", type: "success" });
        setTimeout(() => setAffStatus(null), 3000);
      } else setAffStatus({ msg: data.error, type: "error" });
    } catch { setAffStatus({ msg: "Lỗi kết nối", type: "error" }); }
  }

  async function pasteTo() {
    try { const text = await navigator.clipboard.readText(); setLinkInput(text); } catch { setLinkStatus({ msg: "Không thể paste. Hãy dùng Ctrl+V", type: "error" }); setTimeout(() => setLinkStatus(null), 3000); }
  }

  async function convertLink() {
    if (!linkInput.trim()) { setLinkStatus({ msg: "Vui lòng nhập link", type: "error" }); return; }
    setLoading(true);
    setLinkStatus({ msg: "Đang chuyển đổi link...", type: "loading" });
    try {
      const res = await fetch("/api/convert-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: linkInput }),
      });
      const data = await res.json();
      if (data.success) {
        setLinkStatus(null);
        setLinkResult(data.results.map((r: { affiliate: string }) => r.affiliate).join("\n"));
      } else {
        setLinkStatus({ msg: data.error, type: "error" });
        setLinkResult("");
      }
    } catch { setLinkStatus({ msg: "Lỗi kết nối server", type: "error" }); }
    setLoading(false);
  }

  function copyResult() {
    navigator.clipboard.writeText(linkResult);
  }

  return (
    <>
      {/* Affiliate ID */}
      <div className="card">
        <div className="card-title">Affiliate ID</div>
        <div style={{display:'flex',gap:'8px'}}>
          <input type="text" value={affId} onChange={e => setAffId(e.target.value)} placeholder="Nhập Affiliate ID của bạn" />
          <button className="btn btn-dark" onClick={saveAffiliate}>Lưu</button>
        </div>
        {affStatus && <div className={`status ${affStatus.type}`}>{affStatus.msg}</div>}
      </div>

      {/* Convert Link */}
      <div style={{textAlign:'center',marginBottom:'20px',padding:'8px 0'}}>
        <h3 style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:'28px',fontWeight:700,fontStyle:'italic',color:'var(--primary)',marginBottom:'4px'}}>Chuyển đổi Link</h3>
        <p style={{fontSize:'13px',color:'var(--text-sec)',fontWeight:500}}>Dán link Shopee &mdash; Nhận link Affiliate ngay</p>
      </div>

      <div className="card">
        <div className="card-title">Nhập Link</div>
        <textarea value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="Dán link Shopee vào đây (mỗi link 1 dòng)..." style={{minHeight:'120px'}} />
        <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
          <button className="btn btn-outline" style={{flex:1}} onClick={pasteTo}>Paste nhanh</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={convertLink} disabled={loading}>{loading ? "Đang xử lý..." : "Chuyển đổi"}</button>
        </div>
        {linkStatus && <div className={`status ${linkStatus.type}`}>{linkStatus.msg}</div>}
      </div>

      {linkResult && (
        <div className="card">
          <div className="card-title">Kết quả</div>
          <textarea value={linkResult} readOnly style={{background:'var(--primary-bg)',minHeight:'120px',fontSize:'13px'}} />
          <div style={{marginTop:'10px'}}>
            <button className="btn btn-outline" onClick={copyResult}>Copy tất cả</button>
          </div>
        </div>
      )}
    </>
  );
}
