import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  CHILD_MODE_COOKIE,
  CHILD_MODE_HOME,
  getAuthenticatedHomePath,
  isChildModeCookieValue,
} from "@/lib/child/child-mode-session";
import { hasSupabaseConfig } from "@/lib/env";

function isChildModeActive(request: NextRequest): boolean {
  return isChildModeCookieValue(request.cookies.get(CHILD_MODE_COOKIE)?.value);
}

function pathnameNeedsAuthCheck(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/parent") ||
    pathname.startsWith("/child") ||
    pathname.startsWith("/onboarding")
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname === "/icon" ||
    pathname.startsWith("/apple-icon")
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  if (!hasSupabaseConfig()) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/auth/");
  const isProtected =
    pathname.startsWith("/parent") ||
    pathname.startsWith("/child") ||
    pathname.startsWith("/onboarding");

  let user: { id: string } | null = null;

  if (pathnameNeedsAuthCheck(pathname)) {
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims?.sub) {
      user = { id: String(data.claims.sub) };
    }
  }

  const childModeActive = isChildModeActive(request);

  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = getAuthenticatedHomePath(childModeActive);
    return NextResponse.redirect(url);
  }

  if (user && childModeActive && pathname.startsWith("/parent")) {
    const url = request.nextUrl.clone();
    url.pathname = CHILD_MODE_HOME;
    return NextResponse.redirect(url);
  }

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = getAuthenticatedHomePath(childModeActive);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
