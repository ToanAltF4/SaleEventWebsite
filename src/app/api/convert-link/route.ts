import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { extractUrlsFromText, processSingleUrl, createShortUrl } from "@/lib/url-processing";

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { urls: rawUrls } = await req.json();
  if (!rawUrls?.trim()) {
    return NextResponse.json({ error: "Vui long nhap it nhat 1 link" }, { status: 400 });
  }

  const affiliateId = await getSetting("affiliate_id", "");
  if (!affiliateId) {
    return NextResponse.json({ error: "Vui long cai dat Affiliate ID truoc" }, { status: 400 });
  }

  const lines = rawUrls.split("\n");
  const results: Array<{ original: string; affiliate: string }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const found = extractUrlsFromText(line);
    if (found.length > 0) {
      for (const url of found) {
        const [affUrl] = await processSingleUrl(url, affiliateId);
        const displayUrl = affUrl ? await createShortUrl(affUrl, user) : "Khong ho tro";
        results.push({ original: url, affiliate: displayUrl });
      }
    } else if (line.startsWith("http") || line.startsWith("s.shopee") || line.startsWith("shopee")) {
      let processUrl = line;
      if (!processUrl.startsWith("http")) processUrl = "https://" + processUrl;
      const [affUrl] = await processSingleUrl(processUrl, affiliateId);
      const displayUrl = affUrl ? await createShortUrl(affUrl, user) : "Khong ho tro";
      results.push({ original: processUrl, affiliate: displayUrl });
    }
  }

  if (results.length === 0) {
    return NextResponse.json({ error: "Khong tim thay link hop le" }, { status: 400 });
  }

  return NextResponse.json({ success: true, results });
}
