"use client";

import { useState } from "react";

export default function AiContentClient({ affiliateId: initialAffId }: { affiliateId: string }) {
  const [affId, setAffId] = useState(initialAffId);
  const [affStatus, setAffStatus] = useState<{ msg: string; type: string } | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [aiStatus, setAiStatus] = useState<{ msg: string; type: string } | null>(null);
  const [aiResult, setAiResult] = useState("");
  const [aiStats, setAiStats] = useState("");
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
    try { const text = await navigator.clipboard.readText(); setMessageInput(text); } catch { setAiStatus({ msg: "Khong the paste. Hay dung Ctrl+V", type: "error" }); setTimeout(() => setAiStatus(null), 3000); }
  }

  async function convertAI() {
    if (!messageInput.trim()) { setAiStatus({ msg: "Vui long nhap noi dung tin nhan", type: "error" }); return; }
    setLoading(true);
    setAiStatus({ msg: "Dang trich xuat link va tao noi dung...", type: "loading" });
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageInput }),
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data.converted);
        setAiStats(`${data.links_converted}/${data.links_found} link da chuyen doi`);
        setAiStatus(null);
      } else {
        setAiStatus({ msg: data.error, type: "error" });
        setAiResult("");
      }
    } catch { setAiStatus({ msg: "Loi ket noi server", type: "error" }); }
    setLoading(false);
  }

  function copyResult() {
    navigator.clipboard.writeText(aiResult);
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

      {/* AI Content */}
      <div style={{textAlign:'center',marginBottom:'20px',padding:'8px 0'}}>
        <h3 style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:'28px',fontWeight:700,fontStyle:'italic',color:'var(--primary)',marginBottom:'4px'}}>AI Tao Noi Dung</h3>
        <p style={{fontSize:'13px',color:'var(--text-sec)',fontWeight:500}}>Dan tin nhan &mdash; AI viet lai noi dung + gan link Affiliate</p>
      </div>

      <div className="card">
        <div className="card-title">Noi dung tin nhan</div>
        <textarea value={messageInput} onChange={e => setMessageInput(e.target.value)} placeholder="Dan noi dung tin nhan chua link Shopee vao day..." style={{minHeight:'160px'}} />
        <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
          <button className="btn btn-outline" style={{flex:1}} onClick={pasteTo}>Paste nhanh</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={convertAI} disabled={loading}>{loading ? "Dang xu ly..." : "Tao noi dung"}</button>
        </div>
        {aiStatus && <div className={`status ${aiStatus.type}`}>{aiStatus.msg}</div>}
      </div>

      {aiResult && (
        <div className="card">
          <div className="card-title">Ket qua</div>
          <textarea value={aiResult} readOnly style={{background:'var(--primary-bg)',minHeight:'120px',fontSize:'13px'}} />
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginTop:'10px'}}>
            <button className="btn btn-outline" onClick={copyResult}>Copy ket qua</button>
            <span style={{fontSize:'13px',color:'var(--text-muted)',fontWeight:600}}>{aiStats}</span>
          </div>
        </div>
      )}
    </>
  );
}
