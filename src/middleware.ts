import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, LEGACY_AUTH_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { ZAIVON_HUB_PATH } from "@/constants/zaivon-products";
import { ZAIVON_ONBOARDING_PATH } from "@/lib/zaivon-onboarding";
import { resolvePostLoginPath } from "@/lib/auth/safe-next-path";
import { isSharedZaivonPath, isZaivonOwner } from "@/lib/auth/zaivon-owner";

const ZAIVON_HOST = "zaivon.vercel.app";
const LEGACY_HOSTS = new Set([
  "lh-hub-delta.vercel.app",
  "lh-hub.vercel.app",
  "lh-hub-lucash67s-projects.vercel.app",
  "lh-hub-git-main-lucash67s-projects.vercel.app",
]);

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  ZAIVON_ONBOARDING_PATH,
  "/agendar",
  "/agendamento",
  "/api/schedule/public",
];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/brand/")) return true;
  if (pathname === "/favicon.ico") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const host = request.headers.get("host")?.toLowerCase() ?? "";
  if (LEGACY_HOSTS.has(host)) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${ZAIVON_HOST}`);
    return NextResponse.redirect(target, 308);
  }

  const token =
    request.cookies.get(AUTH_COOKIE)?.value ?? request.cookies.get(LEGACY_AUTH_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Visitante na raiz → onboarding público (não Business-first).
  if (!session && pathname === "/") {
    return NextResponse.redirect(new URL(ZAIVON_ONBOARDING_PATH, request.url));
  }

  if (pathname.startsWith("/login")) {
    if (session) {
      const next = request.nextUrl.searchParams.get("next");
      const dest = resolvePostLoginPath(next);
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // Já logado no onboarding público → Hub.
  if (session && (pathname === ZAIVON_ONBOARDING_PATH || pathname.startsWith(`${ZAIVON_ONBOARDING_PATH}/`))) {
    return NextResponse.redirect(new URL(ZAIVON_HUB_PATH, request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== ZAIVON_HUB_PATH && pathname !== ZAIVON_ONBOARDING_PATH) {
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (!isZaivonOwner(session.email) && !isSharedZaivonPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "ZAIVON Business está em desenvolvimento." },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/em-breve", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
