import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Admin pages protection is handled in admin/layout.tsx (server-side)
  // This middleware can be used for additional logic if needed
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
