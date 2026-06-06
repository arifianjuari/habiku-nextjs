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

export async function updateSession(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/auth/");
  const isProtected =
    pathname.startsWith("/parent") ||
    pathname.startsWith("/child") ||
    pathname.startsWith("/onboarding");

  const childModeActive = isChildModeActive(request);

  // PWA / deep link: langsung ke app jika sudah login (bukan landing marketing)
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = getAuthenticatedHomePath(childModeActive);
    return NextResponse.redirect(url);
  }

  // Tetap di mode anak setelah update/reload — jangan lempar ke dasbor ortu
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
