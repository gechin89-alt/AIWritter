import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { jwtVerify } from "jose";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const ADMIN_PATH = /^\/(en|zh)\/admin(\/.*)?$/;

async function isAdminSession(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token || !process.env.AUTH_SECRET) return false;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.AUTH_SECRET),
    );
    return payload.role === "ADMIN";
  } catch {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  if (ADMIN_PATH.test(req.nextUrl.pathname)) {
    const allowed = await isAdminSession(req);
    if (!allowed) {
      const locale = req.nextUrl.pathname.split("/")[1] || routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/login`, req.url);
      return NextResponse.redirect(loginUrl);
    }
  }
  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
