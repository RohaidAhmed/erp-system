import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/setup
 * Returns whether initial setup has been completed (any super_admin exists).
 * Safe to call unauthenticated — only returns a boolean flag.
 */
export async function GET() {
    try {
        const db = createServerClient();
        const { count, error } = await db
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("role", "super_admin")
            .eq("is_active", true);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data: { setup_complete: (count ?? 0) > 0 },
        });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, message: err?.message || "Server error." },
            { status: 500 }
        );
    }
}

/**
 * POST /api/setup
 * Creates the first super_admin user via Supabase Auth + public.users.
 * Blocked if any super_admin already exists — prevents takeover.
 */
export async function POST(req: NextRequest) {
    try {
        const db = createServerClient();

        // Guard: block if setup already done
        const { count, error: checkErr } = await db
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("role", "super_admin");

        if (checkErr) throw checkErr;
        if ((count ?? 0) > 0) {
            return NextResponse.json(
                { success: false, message: "Setup already complete. A super admin account already exists." },
                { status: 409 }
            );
        }

        const body = await req.json();
        const { full_name, email, password, setup_key } = body;

        // Validate setup key (optional env-based protection)
        const requiredKey = process.env.SETUP_SECRET_KEY;
        if (requiredKey && setup_key !== requiredKey) {
            return NextResponse.json(
                { success: false, message: "Invalid setup key." },
                { status: 403 }
            );
        }

        // Validate fields
        const errors: string[] = [];
        if (!full_name?.trim()) errors.push("Full name is required.");
        if (!email?.trim()) errors.push("Email is required.");
        if (!/\S+@\S+\.\S+/.test(email)) errors.push("Email is invalid.");
        if (!password || password.length < 8) errors.push("Password must be at least 8 characters.");
        if (errors.length) {
            return NextResponse.json({ success: false, message: errors[0], errors }, { status: 400 });
        }

        // Create auth user
        const { data: authData, error: authErr } = await db.auth.admin.createUser({
            email: email.trim().toLowerCase(),
            password,
            email_confirm: true, // auto-confirm so they can log in immediately
            user_metadata: { full_name: full_name.trim() },
        });

        if (authErr) {
            const msg = authErr.message.includes("already registered")
                ? "An account with this email already exists."
                : authErr.message;
            return NextResponse.json({ success: false, message: msg }, { status: 400 });
        }

        // Insert into public.users with super_admin role
        const { data: userRow, error: insertErr } = await db.from("users").insert({
            id: authData.user.id,
            email: email.trim().toLowerCase(),
            full_name: full_name.trim(),
            role: "super_admin",
            is_active: true,
        }).select().single();

        if (insertErr) {
            // Roll back the auth user if profile creation fails
            await db.auth.admin.deleteUser(authData.user.id);
            throw insertErr;
        }

        return NextResponse.json(
            { success: true, data: { id: userRow.id, email: userRow.email, full_name: userRow.full_name }, message: "Super admin created successfully." },
            { status: 201 }
        );
    } catch (err: any) {
        return NextResponse.json(
            { success: false, message: err?.message || "Server error." },
            { status: 500 }
        );
    }
}