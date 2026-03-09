import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
    try {
        // Get the authenticated session via SSR client (cookie-based)
        const supabase = createSupabaseServerClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
        }

        // Fetch the app user profile from public.users using the service client
        const db = createServerClient();
        const { data: user, error: userError } = await db
            .from("users")
            .select("id, email, full_name, role, avatar_url, is_active, last_login, created_at, updated_at")
            .eq("id", session.user.id)
            .single();

        if (userError || !user) {
            // User authenticated but no profile row yet — create one with viewer role
            const { data: newUser, error: createError } = await db.from("users").insert({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.user_metadata?.full_name || session.user.email!.split("@")[0],
                role: "viewer",
                is_active: true,
            }).select().single();

            if (createError) {
                return NextResponse.json({ success: false, message: "User profile not found." }, { status: 404 });
            }

            return NextResponse.json({ success: true, data: newUser });
        }

        if (!user.is_active) {
            return NextResponse.json({ success: false, message: "Account is deactivated." }, { status: 403 });
        }

        // Update last_login timestamp
        await db.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);

        return NextResponse.json({ success: true, data: user });
    } catch (err) {
        return NextResponse.json({ success: false, message: "Internal error." }, { status: 500 });
    }
}