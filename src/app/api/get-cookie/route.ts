import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookie = await getSetting("shopee_cookie", "");
  return NextResponse.json({ cookie });
}
