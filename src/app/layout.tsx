import type { Metadata } from "next";
import "./globals.css";
import { initDb, cleanupOldHistory, cleanupOldShortLinks, cleanupOldMultiAffidLinks } from "@/lib/db";

export const metadata: Metadata = {
  title: "Săn Sale Cùng Kim Ngân",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💖</text></svg>",
  },
};

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    await cleanupOldHistory(14);
    await cleanupOldShortLinks(30);
    await cleanupOldMultiAffidLinks(30);
    dbInitialized = true;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureDb();

  return (
    <html lang="vi">
      <body>
        {/* Splash screen - che FOUC khi JS hydrate */}
        <div id="splash-screen" style={{
          position:'fixed',inset:0,zIndex:99999,
          background:'linear-gradient(135deg, #FFF5F7 0%, #FFFFFF 50%, #FFF5F7 100%)',
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          transition:'opacity 0.4s ease',
        }}>
          <div style={{
            fontFamily:"'Playfair Display', Georgia, serif",
            fontSize:'28px',fontWeight:700,fontStyle:'italic',
            color:'#E8567F',marginBottom:'8px',textAlign:'center',padding:'0 20px',
          }}>
            Săn Sale Cùng Kim Ngân
          </div>
          <div style={{
            fontSize:'13px',fontWeight:500,color:'#999',fontFamily:"'Quicksand', sans-serif",
          }}>
            Đang tải...
          </div>
          <div style={{
            marginTop:'20px',width:'40px',height:'40px',
            border:'3px solid #F0D4DA',borderTopColor:'#E8567F',borderRadius:'50%',
            animation:'splash-spin 0.8s linear infinite',
          }} />
        </div>
        <style dangerouslySetInnerHTML={{__html:`
          @keyframes splash-spin { to { transform: rotate(360deg); } }
        `}} />
        <script dangerouslySetInnerHTML={{__html:`
          // Ẩn splash sau khi trang render xong
          if(typeof window!=='undefined'){
            window.addEventListener('load',function(){
              setTimeout(function(){
                var s=document.getElementById('splash-screen');
                if(s){s.style.opacity='0';setTimeout(function(){s.remove()},400);}
              },100);
            });
            // Fallback: ẩn sau 3s dù chưa load xong
            setTimeout(function(){
              var s=document.getElementById('splash-screen');
              if(s){s.style.opacity='0';setTimeout(function(){s.remove()},400);}
            },3000);
          }
        `}} />
        {children}
      </body>
    </html>
  );
}
