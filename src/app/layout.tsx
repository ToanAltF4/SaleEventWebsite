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
        {children}
      </body>
    </html>
  );
}
