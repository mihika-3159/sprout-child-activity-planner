import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/feedback" && request.method === "GET") {
    return NextResponse.json({ error: "Feedback is private" }, { status: 405, headers: { Allow: "POST" } });
  }
  if (path.startsWith("/api/admin/") && path !== "/api/admin/login" && path !== "/api/admin/logout") {
    const denied = await requireAdmin(request, request.method !== "GET" && request.method !== "HEAD");
    if (denied) return denied;
  }
  if (path === "/admin" || (path.startsWith("/admin/") && path !== "/admin/login")) {
    const denied = await requireAdmin(request);
    if (denied) return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/admin/:path*", "/api/feedback", "/admin/:path*"] };
