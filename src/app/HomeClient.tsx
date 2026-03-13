"use client";

import { useEffect, useRef, useState } from "react";

export default function HomeClient({ user }: { user: string | null }) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<{ msg: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const splashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user && !sessionStorage.getItem("splashShown")) {
      setShowSplash(true);
      sessionStorage.setItem("splashShown", "1");

      const container = document.getElementById("fwContainer");
      if (container) {
        const colors = ["#E8567F","#F78DA7","#FF6B9D","#FFB6C1","#FF85A2","#E91E63","#FF4081","#F50057","#FF69B4","#DB7093","#C71585","#FFD700","#FFA500","#FF6347"];
        const bursts = [
          { x: 20, y: 25, cls: "burst-1", count: 14 },
          { x: 75, y: 20, cls: "burst-2", count: 14 },
          { x: 50, y: 30, cls: "burst-3", count: 16 },
          { x: 30, y: 60, cls: "burst-2", count: 12 },
          { x: 80, y: 55, cls: "burst-1", count: 12 },
          { x: 15, y: 45, cls: "burst-3", count: 10 },
          { x: 65, y: 70, cls: "burst-1", count: 10 },
        ];
        bursts.forEach((b) => {
          for (let i = 0; i < b.count; i++) {
            const angle = (Math.PI * 2 / b.count) * i;
            const dist = 60 + Math.random() * 80;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            const dot = document.createElement("div");
            dot.className = "splash-fw " + b.cls;
            dot.style.left = b.x + "%";
            dot.style.top = b.y + "%";
            const size = (4 + Math.random() * 5) + "px";
            dot.style.width = size;
            dot.style.height = size;
            const color = colors[Math.floor(Math.random() * colors.length)];
            dot.style.background = color;
            dot.style.boxShadow = "0 0 6px " + color;
            dot.style.setProperty("--fw-dir", `translate(${dx}px,${dy}px)`);
            container.appendChild(dot);
          }
        });
      }

      setTimeout(() => {
        ["sp1","sp2","sp3","sp4"].forEach((id, i) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.style.left = "50%";
          el.style.top = "45%";
          el.style.animation = `sparkle 0.8s ${i * 0.12}s ease both`;
        });
      }, 1400);

      setTimeout(() => {
        const splash = splashRef.current;
        if (splash) {
          splash.classList.add("hide");
          setTimeout(() => setShowSplash(false), 800);
        }
      }, 3000);
    }
  }, [user]);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      setStatus({ msg: "Không thể paste. Hãy dùng Ctrl+V", type: "error" });
      setTimeout(() => setStatus(null), 3000);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(result);
  }

  async function handleConvert() {
    if (!url.trim()) {
      setStatus({ msg: "Vui lòng nhập link Shopee", type: "error" });
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    setLoading(true);
    setStatus({ msg: "Đang chuyển đổi link...", type: "loading" });
    let apiSuccess = false;

    try {
      const customRes = await fetch("/api/public-custom-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const customData = await customRes.json();
      if (customData.success && customData.short_link) {
        setResult(customData.short_link);
        setStatus(null);
        apiSuccess = true;
      } else {
        console.warn("[HomeClient] custom-link failed:", customData.error || "unknown");
      }
    } catch (err) {
      console.warn("[HomeClient] custom-link exception:", err);
    }

    if (!apiSuccess) {
      try {
        const res = await fetch("/api/public-convert-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: url.trim() }),
        });
        const data = await res.json();
        if (data.success && data.results?.length > 0) {
          const affLink = data.results[0].affiliate;
          if (affLink === "Không hỗ trợ") {
            setStatus({ msg: "Link không hỗ trợ. Vui lòng nhập link Shopee hợp lệ.", type: "error" });
            setResult("");
          } else {
            setResult(affLink);
            setStatus(null);
          }
        } else {
          setStatus({ msg: data.error || "Không tìm thấy link hợp lệ", type: "error" });
          setResult("");
        }
      } catch {
        setStatus({ msg: "Lỗi kết nối server", type: "error" });
      }
    }

    setLoading(false);
  }

  return (
    <>
      <style jsx>{`
        .converter-section { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 32px 16px 24px; width: 100%; }
        .converter-wrap { width: 100%; max-width: 480px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .converter-title { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; font-style: italic; color: var(--primary); text-align: center; }
        .converter-block { width: 100%; background: var(--card-bg); border-radius: 14px; border: 1.5px solid var(--border); padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .converter-label { font-size: 13px; font-weight: 700; color: var(--text-sec); white-space: nowrap; }
        .input-row { display: flex; gap: 8px; width: 100%; }
        .input-row input { flex: 1; min-width: 0; }
        .paste-btn, .copy-btn-home, .visit-btn { padding: 10px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; font-family: 'Quicksand', sans-serif; cursor: pointer; white-space: nowrap; transition: all 0.15s; display: inline-flex; align-items: center; gap: 5px; }
        .paste-btn { background: var(--primary-bg); color: var(--primary); border: 1.5px solid var(--border); }
        .paste-btn:hover { background: var(--border); }
        .copy-btn-home { background: var(--primary-bg); color: var(--primary); border: 1.5px solid var(--border); }
        .copy-btn-home:hover { background: var(--border); }
        .visit-btn { background: var(--primary); color: #fff; text-decoration: none; justify-content: center; }
        .visit-btn:hover { opacity: 0.85; }
        .convert-btn { width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; font-family: 'Quicksand', sans-serif; cursor: pointer; color: #fff; background: linear-gradient(135deg, var(--primary), #F78DA7); box-shadow: 0 4px 16px rgba(232, 86, 127, 0.3); transition: all 0.2s; }
        .convert-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(232, 86, 127, 0.4); }
        .convert-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .result-block { width: 100%; background: var(--card-bg); border-radius: 14px; border: 1.5px solid var(--border); padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .result-input { background: var(--primary-bg) !important; border-color: var(--border) !important; }
        .result-actions-row { display: flex; gap: 8px; width: 100%; }
        .result-actions-row .copy-btn-home { flex: 1; justify-content: center; }
        .result-actions-row .visit-btn { flex: 1; }
        .home-status { width: 100%; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-align: center; }
        .promo-instruction { width: 100%; text-align: left; font-size: 15px; font-weight: 700; color: var(--primary); line-height: 2; margin-top: 6px; }
        .fb-post-btn { width: 100%; padding: 13px; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; font-family: 'Quicksand', sans-serif; cursor: pointer; color: #fff; background: #1877F2; text-decoration: none; text-align: center; display: block; transition: all 0.2s; box-shadow: 0 4px 12px rgba(24, 119, 242, 0.3); }
        .fb-post-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .promo-img { width: 100%; max-width: 480px; border-radius: 14px; object-fit: cover; }

        .splash { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999; background: linear-gradient(160deg, #FFF8FA 0%, #FFE8EE 40%, #FFF0F5 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 1; transition: opacity 0.7s ease, transform 0.7s ease; overflow: hidden; }
        .splash.hide { opacity: 0; transform: scale(1.05); pointer-events: none; }
        .splash-greeting { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; font-style: italic; color: var(--primary); text-align: center; opacity: 0; animation: greetPop 0.6s 0.8s ease both; z-index: 2; }
        @keyframes greetPop { 0% { opacity: 0; transform: scale(0.6); } 60% { transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes sparkle { 0% { opacity: 0; transform: translate(0,0) scale(0.3); } 40% { opacity: 1; } 100% { opacity: 0; transform: var(--sparkle-dir) scale(0.6); } }

        @media (max-width: 768px) {
          .converter-section { padding: 20px 14px 16px; }
          .converter-wrap { max-width: 100%; }
          .converter-title { font-size: 20px; }
          .converter-block, .result-block { padding: 12px; }
          .convert-btn { padding: 12px; font-size: 13px; }
          .fb-post-btn { padding: 12px; font-size: 13px; }
          .promo-instruction { font-size: 14px; }
          .splash-greeting { font-size: 20px; }
        }
      `}</style>

      <style jsx global>{`
        .splash-fw { position: absolute; width: 6px; height: 6px; border-radius: 50%; opacity: 0; pointer-events: none; }
        .splash-fw.burst-1 { animation: fwBurst1 1.8s ease-out forwards; }
        .splash-fw.burst-2 { animation: fwBurst2 2s 0.4s ease-out forwards; }
        .splash-fw.burst-3 { animation: fwBurst3 1.6s 0.8s ease-out forwards; }
        @keyframes fwBurst1 { 0% { opacity: 0; transform: translate(0,0) scale(0); } 15% { opacity: 1; transform: translate(0,0) scale(1.5); } 100% { opacity: 0; transform: var(--fw-dir) scale(0); } }
        @keyframes fwBurst2 { 0% { opacity: 0; transform: translate(0,0) scale(0); } 15% { opacity: 1; transform: translate(0,0) scale(1.5); } 100% { opacity: 0; transform: var(--fw-dir) scale(0); } }
        @keyframes fwBurst3 { 0% { opacity: 0; transform: translate(0,0) scale(0); } 15% { opacity: 1; transform: translate(0,0) scale(1.5); } 100% { opacity: 0; transform: var(--fw-dir) scale(0); } }
        .splash-sparkle { position: absolute; font-size: 20px; opacity: 0; pointer-events: none; z-index: 1; }
      `}</style>

      {showSplash && (
        <div className="splash" ref={splashRef}>
          <div id="fwContainer"></div>
          <div className="splash-greeting">Săn Sale Cùng Kim Ngân</div>
          <div className="splash-sparkle" id="sp1" style={{ "--sparkle-dir": "translate(-30px,-40px)" } as React.CSSProperties}>&#10024;</div>
          <div className="splash-sparkle" id="sp2" style={{ "--sparkle-dir": "translate(30px,-35px)" } as React.CSSProperties}>&#128150;</div>
          <div className="splash-sparkle" id="sp3" style={{ "--sparkle-dir": "translate(-25px,30px)" } as React.CSSProperties}>&#127800;</div>
          <div className="splash-sparkle" id="sp4" style={{ "--sparkle-dir": "translate(35px,25px)" } as React.CSSProperties}>&#128151;</div>
        </div>
      )}

      <div className="converter-section">
        <div className="converter-wrap">
          <div className="converter-title">Tạo Link Mua Hàng Mã Độc Quyền Facebook</div>

          <div className="converter-block">
            <div className="converter-label">Link gốc Shopee</div>
            <div className="input-row">
              <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Dán link Shopee vào đây..." onKeyDown={e => e.key === "Enter" && handleConvert()} />
              <button className="paste-btn" onClick={handlePaste}>Paste</button>
            </div>
          </div>

          <button className="convert-btn" onClick={handleConvert} disabled={loading}>
            {loading ? "Đang xử lý..." : "Tạo link nhận mã Độc Quyền Facebook"}
          </button>

          {status && (
            <div className={`home-status ${status.type}`}>{status.msg}</div>
          )}

          {result && (
            <div className="result-block">
              <div className="converter-label">Link đã có voucher</div>
              <div className="input-row">
                <input type="text" value={result} readOnly className="result-input" />
                <button className="copy-btn-home" onClick={handleCopy}>Copy</button>
              </div>
              <a href={result} className="visit-btn" target="_blank">Truy cập nhanh</a>
            </div>
          )}

          <div className="promo-instruction">
            <div style={{display:'flex',gap:'8px'}}><span>1&#65039;&#8419;</span><span>Copy link &amp; comment vào bài viết bên dưới</span></div>
            <div style={{display:'flex',gap:'8px'}}><span>2&#65039;&#8419;</span><span>Click vào link vừa comment sang Shopee mã sẽ tự động lưu</span></div>
          </div>
          <a href="https://www.facebook.com/share/p/1C4do57ne2/" target="_blank" className="fb-post-btn">Truy cập bài viết</a>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/promo-20.jpg" alt="Mã giảm 20%" className="promo-img" />
        </div>
      </div>
    </>
  );
}
