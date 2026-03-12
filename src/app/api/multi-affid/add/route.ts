import { NextRequest, NextResponse } from "next/server";
import { createMultiAffid } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { affid, name } = await req.json();
  if (!affid?.trim()) {
    return NextResponse.json({ error: "Affiliate ID khong duoc de trong" }, { status: 400 });
  }

  await createMultiAffid(affid.trim(), name?.trim() || "");
  return NextResponse.json({ success: true });
}
