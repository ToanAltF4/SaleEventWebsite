import { NextRequest, NextResponse } from "next/server";
import { getMultiAffid, findMultiAffidLinkByTarget, createMultiAffidLink } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { processSingleUrl, generateShortCode, SHORT_DOMAIN } from "@/lib/url-processing";

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { affid_id, url } = await req.json();
  if (!affid_id || !url?.trim()) {
    return NextResponse.json({ error: "Thieu thong tin" }, { status: 400 });
  }

  const affidRecord = await getMultiAffid(affid_id);
  if (!affidRecord) {
    return NextResponse.json({ error: "Khong tim thay Affiliate ID" }, { status: 404 });
  }

  const [affUrl, original] = await processSingleUrl(url.trim(), affidRecord.affid);
  if (!affUrl) {
    return NextResponse.json({ error: "Khong the chuyen doi link nay" }, { status: 400 });
  }

  const existing = await findMultiAffidLinkByTarget(affid_id, affUrl);
  if (existing) {
    return NextResponse.json({
      success: true,
      short_url: `https://${SHORT_DOMAIN}/m/${existing.short_code}`,
      existing: true,
    });
  }

  const code = await generateShortCode();
  await createMultiAffidLink(affid_id, code, affUrl, original);
  return NextResponse.json({
    success: true,
    short_url: `https://${SHORT_DOMAIN}/m/${code}`,
  });
}
