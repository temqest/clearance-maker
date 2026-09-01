import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PROTECTED_PATHS = ["/home", "/editor"];

function isProtectedPath(pathname) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  // Safeguard: Check if Supabase URL and Key are present & valid strings before instantiation
  if (!url || !anonKey || typeof url !== "string" || !url.startsWith("http")) {
    if (isProtectedPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(
      url,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));

            supabaseResponse = NextResponse.next({
              request
            });

            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options);
            });
          }
        }
      }
    );

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (isProtectedPath(pathname) && !user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    if (pathname === "/login" && user) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/home";
      return NextResponse.redirect(homeUrl);
    }

    return supabaseResponse;
  } catch (err) {
    console.error("Middleware Supabase Session Exception:", err);
    if (isProtectedPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }
}

