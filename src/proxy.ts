import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate — OPTIMISTIC check only (cookie presence). It cannot reach the
 * DB, so real validation happens server-side in the (app) layout and in
 * every server action via requireUser(). This just keeps anonymous
 * traffic out of the app shell cheaply.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("hq_session");
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/signin" ||
    pathname.startsWith("/api/auth/") ||
    // machine ingest (StreamBot / xsnap) — no cookie by design; the route
    // itself enforces the STATS_INGEST_SECRET bearer
    pathname === "/api/stats/ingest";

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // everything except Next internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
