import { NextRequest, NextResponse } from "next/server";
import { getMultiAffidLinks, getMultiAffidTotalClicks } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const affidId = parseInt(id);
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const perPage = 10;

  const { links, total } = await getMultiAffidLinks(affidId, page, perPage);
  const totalPages = total > 0 ? Math.ceil(total / perPage) : 1;
  const totalClicks = await getMultiAffidTotalClicks(affidId);

  return NextResponse.json({ links, total, total_clicks: totalClicks, page, total_pages: totalPages });
}
