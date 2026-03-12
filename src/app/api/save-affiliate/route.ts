import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { affiliate_id } = await req.json();
  if (!affiliate_id?.trim()) {
    return NextResponse.json({ error: "Affiliate ID không được để trống" }, { status: 400 });
  }

  await setSetting("affiliate_id", affiliate_id.trim());
  return NextResponse.json({ success: true, affiliate_id: affiliate_id.trim() });
}
