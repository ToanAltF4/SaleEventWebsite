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
    try { const text = await navigator.clipboard.readText(); setMessageInput(text); } catch { setAiStatus({ msg: "Không thể paste. Hãy dùng Ctrl+V", type: "error" }); setTimeout(() => setAiStatus(null), 3000); }
  }

  async function convertAI() {
    if (!messageInput.trim()) { setAiStatus({ msg: "Vui lòng nhập nội dung tin nhắn", type: "error" }); return; }
    setLoading(true);
    setAiStatus({ msg: "Đang trích xuất link và tạo nội dung...", type: "loading" });
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageInput }),
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data.converted);
        setAiStats(`${data.links_converted}/${data.links_found} link đã chuyển đổi`);
        setAiStatus(null);
      } else {
        setAiStatus({ msg: data.error, type: "error" });
        setAiResult("");
      }
    } catch { setAiStatus({ msg: "Lỗi kết nối server", type: "error" }); }
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
          <input type="text" value={affId} onChange={e => setAffId(e.target.value)} placeholder="Nhập Affiliate ID của bạn" />
          <button className="btn btn-dark" onClick={saveAffiliate}>Lưu</button>
        </div>
        {affStatus && <div className={`status ${affStatus.type}`}>{affStatus.msg}</div>}
      </div>

      {/* AI Content */}
      <div style={{textAlign:'center',marginBottom:'20px',padding:'8px 0'}}>
        <h3 className="page-title" style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:'28px',fontWeight:700,fontStyle:'italic',color:'var(--primary)',marginBottom:'4px'}}>AI Tạo Nội Dung</h3>
        <p className="page-subtitle" style={{fontSize:'13px',color:'var(--text-sec)',fontWeight:500}}>Dán tin nhắn &mdash; AI viết lại nội dung + gán link Affiliate</p>
      </div>

      <div className="card">
        <div className="card-title">Nội dung tin nhắn</div>
        <textarea value={messageInput} onChange={e => setMessageInput(e.target.value)} placeholder="Dán nội dung tin nhắn chứa link Shopee vào đây..." style={{minHeight:'160px'}} />
        <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
          <button className="btn btn-outline" style={{flex:1}} onClick={pasteTo}>Paste nhanh</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={convertAI} disabled={loading}>{loading ? "Đang xử lý..." : "Tạo nội dung"}</button>
        </div>
        {aiStatus && <div className={`status ${aiStatus.type}`}>{aiStatus.msg}</div>}
      </div>

      {aiResult && (
        <div className="card">
          <div className="card-title">Kết quả</div>
          <textarea value={aiResult} readOnly style={{background:'var(--primary-bg)',minHeight:'120px',fontSize:'13px'}} />
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginTop:'10px'}}>
            <button className="btn btn-outline" onClick={copyResult}>Copy kết quả</button>
            <span style={{fontSize:'13px',color:'var(--text-muted)',fontWeight:600}}>{aiStats}</span>
          </div>
        </div>
      )}
    </>
  );
}
