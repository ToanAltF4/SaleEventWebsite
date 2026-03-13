"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AffidLink {
  id: number;
  short_code: string;
  target_url: string;
  click_count: number;
  created_at: string;
}

interface AffidData {
  id: number;
  affid: string;
  name: string;
  created_at: string;
  links: AffidLink[];
  total_links: number;
  total_clicks: number;
  current_page: number;
  total_pages: number;
}

export default function MultiAffidClient({ affidData, shortDomain }: { affidData: AffidData[]; shortDomain: string }) {
  const router = useRouter();
  const [newAffid, setNewAffid] = useState("");
  const [newName, setNewName] = useState("");
  const [addStatus, setAddStatus] = useState<{ msg: string; type: string } | null>(null);
  const [convertUrls, setConvertUrls] = useState<Record<number, string>>({});
  const [convertStatuses, setConvertStatuses] = useState<Record<number, { msg: string; type: string } | null>>({});
  const [convertResults, setConvertResults] = useState<Record<number, string>>({});

  async function addMultiAffid() {
    if (!newAffid.trim()) { setAddStatus({ msg: "Vui lòng nhập Affiliate ID", type: "error" }); return; }
    try {
      const res = await fetch("/api/multi-affid/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affid: newAffid.trim(), name: newName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        router.refresh();
        setNewAffid("");
        setNewName("");
      } else setAddStatus({ msg: data.error, type: "error" });
    } catch { setAddStatus({ msg: "Lỗi kết nối", type: "error" }); }
  }

  async function deleteMultiAffid(id: number) {
    if (!confirm("Xóa Affiliate ID này và tất cả link liên quan?")) return;
    try {
      const res = await fetch(`/api/multi-affid/delete/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) router.refresh();
      else alert(data.error || "Lỗi xóa");
    } catch { alert("Lỗi kết nối"); }
  }

  async function convertMultiAffid(affidId: number) {
    const url = convertUrls[affidId]?.trim();
    if (!url) { setConvertStatuses(s => ({...s, [affidId]: { msg: "Vui lòng nhập link", type: "error" }})); return; }

    setConvertStatuses(s => ({...s, [affidId]: { msg: "Đang chuyển đổi...", type: "loading" }}));
    setConvertResults(s => ({...s, [affidId]: ""}));

    try {
      const res = await fetch("/api/multi-affid/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affid_id: affidId, url }),
      });
      const data = await res.json();
      if (data.success) {
        setConvertStatuses(s => ({...s, [affidId]: null}));
        setConvertResults(s => ({...s, [affidId]: data.short_url}));
        setConvertUrls(s => ({...s, [affidId]: ""}));
        setTimeout(() => {
          router.push(`/admin/multi-affid?active=${affidId}`);
          router.refresh();
        }, 1000);
      } else {
        setConvertStatuses(s => ({...s, [affidId]: { msg: data.error, type: "error" }}));
      }
    } catch {
      setConvertStatuses(s => ({...s, [affidId]: { msg: "Lỗi kết nối", type: "error" }}));
    }
  }

  return (
    <>
      <div style={{textAlign:'center',marginBottom:'20px',padding:'8px 0'}}>
        <h3 className="page-title" style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:'28px',fontWeight:700,fontStyle:'italic',color:'var(--primary)',marginBottom:'4px'}}>Multi Affiliate</h3>
        <p className="page-subtitle" style={{fontSize:'13px',color:'var(--text-sec)',fontWeight:500}}>Quản lý nhiều Affiliate ID &mdash; Tạo link &amp; theo dõi click</p>
      </div>

      {/* Add new */}
      <div className="card">
        <div className="card-title">Thêm Affiliate ID mới</div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <input type="text" value={newAffid} onChange={e => setNewAffid(e.target.value)} placeholder="Nhập Affiliate ID" style={{flex:1,minWidth:'0'}} />
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tên (tùy chọn)" style={{flex:1,minWidth:'0'}} />
          <button className="btn btn-primary" onClick={addMultiAffid}>Thêm</button>
        </div>
        {addStatus && <div className={`status ${addStatus.type}`}>{addStatus.msg}</div>}
      </div>

      {affidData.length > 0 ? affidData.map(affid => (
        <div key={affid.id} className="card" style={{borderLeft:'3px solid var(--primary)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:'14px',fontWeight:700,color:'var(--text)',wordBreak:'break-word'}}>
                {affid.name || "Affiliate"} <span style={{fontSize:'11px',color:'var(--text-muted)',fontWeight:500}}>#{affid.affid}</span>
              </div>
              <div style={{fontSize:'10px',color:'var(--text-muted)',marginTop:'2px'}}>{affid.created_at}</div>
            </div>
            <div style={{display:'flex',gap:'4px',alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
              <span style={{background:'var(--primary)',color:'#fff',padding:'2px 8px',borderRadius:'10px',fontSize:'10px',fontWeight:700}}>{affid.total_links} link</span>
              <span style={{background:'#E8F5E9',color:'#2E7D32',padding:'2px 8px',borderRadius:'10px',fontSize:'10px',fontWeight:700}}>{affid.total_clicks} click</span>
              <button onClick={() => deleteMultiAffid(affid.id)} style={{background:'none',border:'1px solid #ffcdd2',borderRadius:'6px',padding:'3px 8px',cursor:'pointer',fontSize:'10px',fontWeight:700,color:'#C62828',fontFamily:"'Quicksand',sans-serif"}}>Xóa</button>
            </div>
          </div>

          {/* Convert link */}
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <input type="text" value={convertUrls[affid.id] || ""} onChange={e => setConvertUrls(s => ({...s, [affid.id]: e.target.value}))} placeholder="Dán link Shopee..." style={{flex:1,minWidth:0}} />
            <button className="btn btn-dark" onClick={() => convertMultiAffid(affid.id)} style={{whiteSpace:'nowrap',fontSize:'13px'}}>Tạo link</button>
          </div>
          {convertStatuses[affid.id] && <div className={`status ${convertStatuses[affid.id]!.type}`}>{convertStatuses[affid.id]!.msg}</div>}
          {convertResults[affid.id] && (
            <div style={{marginTop:'8px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',background:'var(--primary-bg)',padding:'10px 14px',borderRadius:'8px'}}>
                <input type="text" value={convertResults[affid.id]} readOnly style={{flex:1,minWidth:0,border:'none',background:'transparent',fontSize:'12px',fontWeight:600,color:'var(--primary)'}} />
                <button onClick={() => navigator.clipboard.writeText(convertResults[affid.id])} style={{background:'var(--primary)',color:'#fff',border:'none',borderRadius:'6px',padding:'6px 12px',cursor:'pointer',fontSize:'11px',fontWeight:700,fontFamily:"'Quicksand',sans-serif",whiteSpace:'nowrap'}}>Copy</button>
              </div>
            </div>
          )}

          {/* Links table */}
          {affid.links.length > 0 && (
            <div style={{marginTop:'14px'}}>
              <div style={{fontSize:'12px',fontWeight:700,color:'var(--text-sec)',marginBottom:'8px',textTransform:'uppercase'}}>Link đã tạo</div>
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Link rút gọn</th>
                    <th>Link gốc</th>
                    <th>Ngày tạo</th>
                    <th style={{textAlign:'center'}}>Click</th>
                  </tr>
                </thead>
                <tbody>
                  {affid.links.map(link => (
                    <tr key={link.id}>
                      <td data-label="Link rút gọn">
                        <div style={{display:'flex',alignItems:'center',gap:'4px',flexWrap:'wrap'}}>
                          <a href={`/m/${link.short_code}`} target="_blank" style={{color:'var(--primary)',fontWeight:700,textDecoration:'none',fontSize:'12px',wordBreak:'break-all'}}>
                            {shortDomain}/m/{link.short_code}
                          </a>
                          <button onClick={() => navigator.clipboard.writeText(`https://${shortDomain}/m/${link.short_code}`)} style={{background:'none',border:'1px solid var(--border)',borderRadius:'4px',padding:'1px 6px',cursor:'pointer',fontSize:'10px',fontFamily:"'Quicksand',sans-serif",fontWeight:600,color:'var(--text-sec)'}}>Copy</button>
                        </div>
                      </td>
                      <td data-label="Link gốc" title={link.target_url} style={{fontSize:'11px',color:'var(--text-sec)'}}>
                        <span style={{wordBreak:'break-all',whiteSpace:'normal'}}>{link.target_url?.substring(0, 50)}{(link.target_url?.length || 0) > 50 ? "..." : ""}</span>
                      </td>
                      <td data-label="Ngày tạo" style={{fontSize:'11px',color:'var(--text-muted)'}}>{link.created_at}</td>
                      <td data-label="Click">
                        <span style={{background: link.click_count > 0 ? 'var(--primary)' : 'var(--border)', color: link.click_count > 0 ? '#fff' : 'var(--text-sec)', padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:700}}>
                          {link.click_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {affid.total_pages > 1 && (
                <div style={{display:'flex',justifyContent:'center',gap:'4px',marginTop:'12px',flexWrap:'wrap'}}>
                  {Array.from({ length: affid.total_pages }, (_, i) => i + 1).map(p => (
                    <a key={p} href={`/admin/multi-affid?active=${affid.id}&page=${p}`}
                       style={{padding:'5px 11px',borderRadius:'6px',fontSize:'12px',fontWeight:700,textDecoration:'none',fontFamily:"'Quicksand',sans-serif",
                         ...(p === affid.current_page ? {background:'var(--primary)',color:'#fff'} : {background:'var(--primary-bg)',color:'var(--text-sec)',border:'1px solid var(--border)'})}}>
                      {p}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {affid.total_links === 0 && (
            <div style={{marginTop:'12px',padding:'16px',textAlign:'center',fontSize:'12px',color:'var(--text-muted)',fontWeight:600,background:'var(--primary-bg)',borderRadius:'8px'}}>
              Chưa có link nào được tạo
            </div>
          )}
        </div>
      )) : (
        <div className="card" style={{textAlign:'center',padding:'32px'}}>
          <div style={{fontSize:'14px',color:'var(--text-muted)',fontWeight:600}}>Chưa có Affiliate ID nào. Hãy thêm ở trên!</div>
        </div>
      )}
    </>
  );
}
