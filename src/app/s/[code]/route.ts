import { NextRequest, NextResponse } from "next/server";
import { getShortLink, incrementClick } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await getShortLink(code);

  if (!link) {
    return new NextResponse("Link khong ton tai", { status: 404 });
  }

  await incrementClick(code);
  return NextResponse.redirect(link.target_url, 302);
}
