import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cookie } = await req.json();
  if (!cookie?.trim()) {
    return NextResponse.json({ error: "Cookie không được để trống" }, { status: 400 });
  }

  await setSetting("shopee_cookie", cookie.trim());
  return NextResponse.json({ success: true });
}
