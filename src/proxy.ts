import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const authCookiePrefix = "sb-";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh rotated sessions before a page or API route reads them. If a user
  // has an old/revoked token, clear it once so subsequent API calls return a
  // normal 401 instead of repeatedly attempting the invalid refresh token.
  const { error } = await supabase.auth.getUser();
  if (error?.code === "refresh_token_not_found") {
    request.cookies
      .getAll()
      .filter((cookie) => cookie.name.startsWith(authCookiePrefix) && cookie.name.includes("auth-token"))
      .forEach((cookie) => response.cookies.delete(cookie.name));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
