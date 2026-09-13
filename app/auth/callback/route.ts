import { NextResponse } from "next/server";
import { createClient, isSupabaseServerConfigured } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/study";

  if (code && isSupabaseServerConfigured()) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If there's an error or no code, redirect to sign-in with error query
  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
}
