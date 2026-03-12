import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Vui lòng nhập tài khoản và mật khẩu" }, { status: 400 });
  }

  const valid = await verifyUser(username.trim(), password);
  if (!valid) {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu" }, { status: 401 });
  }

  const session = await getSession();
  session.user = username.trim();
  await session.save();

  return NextResponse.json({ success: true });
}
