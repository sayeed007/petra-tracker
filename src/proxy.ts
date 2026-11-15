import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleLocale = createMiddleware(routing);

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/en/issues", request.url));
  }
  return handleLocale(request);
}

export const config = {
  matcher: "/((?!api|_next|.*\\..*).*)",
};
