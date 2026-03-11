import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);

    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");          // "invite" | "recovery" | "email" etc.
    const next = searchParams.get("next") ?? "/dashboard";

    const supabase = createSupabaseServerClient();

    // ── PKCE flow (magic link, OAuth, email confirm) ─────────────────────────
    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // Recovery = password reset → go to reset-password page
            if (type === "recovery") {
                return NextResponse.redirect(`${origin}/auth/reset-password`);
            }
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // ── Token hash flow (invite email, recovery email) ───────────────────────
    if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
        if (!error) {
            // Invited users must set a password before accessing the app
            if (type === "invite") {
                return NextResponse.redirect(`${origin}/auth/accept-invite`);
            }
            if (type === "recovery") {
                return NextResponse.redirect(`${origin}/auth/reset-password`);
            }
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // Auth failed — redirect to login with error flag
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}