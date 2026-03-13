"use client";

import { useState } from "react";

interface LinkData {
  id: number;
  short_code: string;
  target_url: string;
  click_count: number;
  created_at: string;
  created_by: string;
}

export default function ClickReportClient({
  affiliateId: initialAffId, links, totalClicks, totalLinks, search, dateFrom, dateTo, shortDomain
}: {
  affiliateId: string;
  links: LinkData[];
  totalClicks: number;
  totalLinks: number;
  search: string;
  dateFrom: string;
  dateTo: string;
  shortDomain: string;
}) {
  const [affId, setAffId] = useState(initialAffId);
  const [affStatus, setAffStatus] = useState<{ msg: string; type: string } | null>(null);

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

      <div style={{textAlign:'center',marginBottom:'20px',padding:'8px 0'}}>
        <h3 className="page-title" style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:'28px',fontWeight:700,fontStyle:'italic',color:'var(--primary)',marginBottom:'4px'}}>Báo Cáo Click</h3>
        <p className="page-subtitle" style={{fontSize:'13px',color:'var(--text-sec)',fontWeight:500}}>Thống kê lượt click từ các link rút gọn</p>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:'10px',marginBottom:'14px'}}>
        <div className="card" style={{flex:1,textAlign:'center',marginBottom:0}}>
          <div style={{fontSize:'24px',fontWeight:700,color:'var(--primary)'}}>{totalLinks}</div>
          <div style={{fontSize:'12px',fontWeight:600,color:'var(--text-sec)'}}>Tổng link</div>
        </div>
        <div className="card" style={{flex:1,textAlign:'center',marginBottom:0}}>
          <div style={{fontSize:'24px',fontWeight:700,color:'var(--primary)'}}>{totalClicks}</div>
          <div style={{fontSize:'12px',fontWeight:600,color:'var(--text-sec)'}}>Tổng click</div>
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="card-title">Bộ lọc</div>
        <form method="GET" action="/admin/click-report" className="filter-form" style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:1,minWidth:'140px'}}>
            <label style={{fontSize:'11px',fontWeight:700,color:'var(--text-sec)',display:'block',marginBottom:'4px'}}>Tìm kiếm</label>
            <input type="text" name="q" placeholder="Short code hoặc link..." defaultValue={search} style={{padding:'8px 10px',fontSize:'13px'}} />
          </div>
          <div style={{minWidth:'130px'}}>
            <label style={{fontSize:'11px',fontWeight:700,color:'var(--text-sec)',display:'block',marginBottom:'4px'}}>Từ ngày</label>
            <input type="date" name="from" defaultValue={dateFrom} style={{padding:'8px 10px',fontSize:'13px'}} />
          </div>
          <div style={{minWidth:'130px'}}>
            <label style={{fontSize:'11px',fontWeight:700,color:'var(--text-sec)',display:'block',marginBottom:'4px'}}>Đến ngày</label>
            <input type="date" name="to" defaultValue={dateTo} style={{padding:'8px 10px',fontSize:'13px'}} />
          </div>
          <button type="submit" className="btn btn-primary" style={{padding:'9px 18px',fontSize:'13px'}}>Lọc</button>
          <a href="/admin/click-report" className="btn btn-outline" style={{padding:'9px 18px',fontSize:'13px',textDecoration:'none',textAlign:'center'}}>Xóa lọc</a>
        </form>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-title">Danh sách link ({links.length})</div>
        <table className="responsive-table">
          <thead>
            <tr>
              <th>Link rút gọn</th>
              <th>Link gốc (affiliate)</th>
              <th>Ngày tạo</th>
              <th style={{textAlign:'center'}}>Click</th>
            </tr>
          </thead>
          <tbody>
            {links.length > 0 ? links.map(link => (
              <tr key={link.id}>
                <td data-label="Link rút gọn">
                  <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
                    <a href={`/s/${link.short_code}`} target="_blank" style={{color:'var(--primary)',fontWeight:700,textDecoration:'none',fontSize:'12px',wordBreak:'break-all'}}>
                      {shortDomain}/s/{link.short_code}
                    </a>
                    <button onClick={() => { navigator.clipboard.writeText(`https://${shortDomain}/s/${link.short_code}`); }} style={{background:'none',border:'1px solid var(--border)',borderRadius:'4px',padding:'2px 8px',cursor:'pointer',fontSize:'10px',fontFamily:"'Quicksand',sans-serif",fontWeight:600,color:'var(--text-sec)'}}>Copy</button>
                  </div>
                </td>
                <td data-label="Link gốc" style={{maxWidth:'220px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'11px',color:'var(--text-sec)'}} title={link.target_url}>
                  <span style={{wordBreak:'break-all',whiteSpace:'normal'}}>{link.target_url?.substring(0, 60)}{(link.target_url?.length || 0) > 60 ? "..." : ""}</span>
                </td>
                <td data-label="Ngày tạo" style={{fontSize:'11px',color:'var(--text-muted)'}}>{link.created_at}</td>
                <td data-label="Click">
                  <span style={{background: link.click_count > 0 ? 'var(--primary)' : 'var(--border)', color: link.click_count > 0 ? '#fff' : 'var(--text-sec)', padding:'3px 10px',borderRadius:'12px',fontSize:'11px',fontWeight:700}}>
                    {link.click_count}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} style={{padding:'24px',textAlign:'center',color:'var(--text-muted)',fontWeight:600}}>
                {search || dateFrom || dateTo ? "Không tìm thấy link phù hợp" : "Chưa có link nào được tạo từ Dashboard"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
