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
    if (!affId.trim()) { setAffStatus({ msg: "Vui long nhap Affiliate ID", type: "error" }); return; }
    try {
      const res = await fetch("/api/save-affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliate_id: affId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setAffStatus({ msg: "Da luu thanh cong!", type: "success" });
        setTimeout(() => setAffStatus(null), 3000);
      } else setAffStatus({ msg: data.error, type: "error" });
    } catch { setAffStatus({ msg: "Loi ket noi", type: "error" }); }
  }

  async function pasteTo() {
    try { const text = await navigator.clipboard.readText(); setLinkInput(text); } catch { setLinkStatus({ msg: "Khong the paste. Hay dung Ctrl+V", type: "error" }); setTimeout(() => setLinkStatus(null), 3000); }
  }

  async function convertLink() {
    if (!linkInput.trim()) { setLinkStatus({ msg: "Vui long nhap link", type: "error" }); return; }
    setLoading(true);
    setLinkStatus({ msg: "Dang chuyen doi link...", type: "loading" });
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
    } catch { setLinkStatus({ msg: "Loi ket noi server", type: "error" }); }
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
          <input type="text" value={affId} onChange={e => setAffId(e.target.value)} placeholder="Nhap Affiliate ID cua ban" />
          <button className="btn btn-dark" onClick={saveAffiliate}>Luu</button>
        </div>
        {affStatus && <div className={`status ${affStatus.type}`}>{affStatus.msg}</div>}
      </div>

      {/* Convert Link */}
      <div style={{textAlign:'center',marginBottom:'20px',padding:'8px 0'}}>
        <h3 style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:'28px',fontWeight:700,fontStyle:'italic',color:'var(--primary)',marginBottom:'4px'}}>Chuyen doi Link</h3>
        <p style={{fontSize:'13px',color:'var(--text-sec)',fontWeight:500}}>Dan link Shopee &mdash; Nhan link Affiliate ngay</p>
      </div>

      <div className="card">
        <div className="card-title">Nhap Link</div>
        <textarea value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="Dan link Shopee vao day (moi link 1 dong)..." style={{minHeight:'120px'}} />
        <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
          <button className="btn btn-outline" style={{flex:1}} onClick={pasteTo}>Paste nhanh</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={convertLink} disabled={loading}>{loading ? "Dang xu ly..." : "Chuyen doi"}</button>
        </div>
        {linkStatus && <div className={`status ${linkStatus.type}`}>{linkStatus.msg}</div>}
      </div>

      {linkResult && (
        <div className="card">
          <div className="card-title">Ket qua</div>
          <textarea value={linkResult} readOnly style={{background:'var(--primary-bg)',minHeight:'120px',fontSize:'13px'}} />
          <div style={{marginTop:'10px'}}>
            <button className="btn btn-outline" onClick={copyResult}>Copy tat ca</button>
          </div>
        </div>
      )}
    </>
  );
}
