import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractUrlsFromText, processSingleUrl } from "@/lib/url-processing";

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Bạn đã tạo quá nhiều link. Vui lòng thử lại sau 1 giờ." },
        { status: 429 }
      );
    }
  }

  const { urls: rawUrls } = await req.json();
  if (!rawUrls?.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập ít nhất 1 link" }, { status: 400 });
  }

  const affiliateId = await getSetting("affiliate_id", "");
  if (!affiliateId) {
    return NextResponse.json({ error: "Hệ thống chưa được cấu hình. Vui lòng liên hệ admin." }, { status: 400 });
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
        results.push({ original: url, affiliate: affUrl || "Không hỗ trợ" });
      }
    } else if (line.startsWith("http") || line.startsWith("s.shopee") || line.startsWith("shopee")) {
      let processUrl = line;
      if (!processUrl.startsWith("http")) processUrl = "https://" + processUrl;
      const [affUrl] = await processSingleUrl(processUrl, affiliateId);
      results.push({ original: processUrl, affiliate: affUrl || "Không hỗ trợ" });
    }
  }

  if (results.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy link hợp lệ" }, { status: 400 });
  }

  return NextResponse.json({ success: true, results });
}
