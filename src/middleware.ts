/**
 * ADMIN GATE — Basic auth for operator UI (/accounts, /manage, /demo) once
 * deployed. Unset AGENT_ADMIN_PASSWORD = open (local dev).
 *
 * PUBLIC on purpose:
 *   /site/*      → client-facing read-only pages (e.g. /site/greg-caseley)
 *   /demo/chat*  → the chat widget embedded by /site (must load for clients)
 *   /api/*       → consumed externally (greg-caseley site reads listings; the
 *                  chat widget calls /api/chat). Admin-only mutation APIs are a
 *                  flagged follow-up (method-based gating, not done here).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The embedded client chat widget stays public even though it lives under /demo.
  if (pathname.startsWith("/demo/chat")) return NextResponse.next();

  const password = process.env.AGENT_ADMIN_PASSWORD;
  if (!password) return NextResponse.next(); // local/dev — open

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (given === password) return NextResponse.next();
  }
  return new NextResponse("syntellic-agent — authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="syntellic-agent admin"' },
  });
}

export const config = {
  matcher: ["/accounts/:path*", "/manage/:path*", "/demo/:path*"],
};
