import { NextResponse } from "next/server";
import { getHistory } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const history = await getHistory(20);
  return NextResponse.json(history);
}
