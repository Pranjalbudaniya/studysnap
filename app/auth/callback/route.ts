import { NextResponse } from "next/server";
import { createClient, isSupabaseServerConfigured } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/study";
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Determine the canonical base origin taking proxy headers into account
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const isLocalEnv = process.env.NODE_ENV === "development";

  const baseOrigin =
    forwardedHost && !isLocalEnv
      ? `${forwardedProto}://${forwardedHost}`
      : requestUrl.origin;

  // Handle errors passed directly by Supabase in query parameters
  if (error) {
    const errorQuery = encodeURIComponent(errorDescription || error);
    return NextResponse.redirect(`${baseOrigin}/sign-in?error=${errorQuery}`);
  }

  if (code && isSupabaseServerConfigured()) {
    const supabase = createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      // Ensure the 'next' parameter is a relative path to prevent open redirect vulnerabilities
      const safeNext = next.startsWith("/") ? next : `/${next}`;
      return NextResponse.redirect(`${baseOrigin}${safeNext}`);
    }
  }

  // If there's an error or no code, redirect to sign-in with error query
  return NextResponse.redirect(`${baseOrigin}/sign-in?error=auth_callback_failed`);
}

