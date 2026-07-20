import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Canonical-host redirect: www.skrubbit.co.za -> skrubbit.co.za.
 *
 * Both hostnames are attached to the Worker as custom domains, so both would
 * otherwise serve identical content under two URLs. The apex is canonical
 * (it is what data/site.ts advertises), so www is redirected to it with a
 * 308 that preserves method and body.
 *
 * The workers.dev URL and the apex pass through untouched.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  if (host === "www.skrubbit.co.za") {
    const url = new URL(req.url);
    url.host = "skrubbit.co.za";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's internal asset requests.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
