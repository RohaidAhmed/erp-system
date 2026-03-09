import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, getPagination, buildPagination } from "@/lib/utils/api-response";

async function getCallerRole(req: NextRequest): Promise<string | null> {
    const supabase = createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const db = createServerClient();
    const { data } = await db.from("users").select("role").eq("id", session.user.id).single();
    return data?.role || null;
}

export async function GET(req: NextRequest) {
    try {
        const role = await getCallerRole(req);
        if (!role) return apiError("Not authenticated.", [], 401);
        if (role !== "super_admin") return apiError("Super admin access required.", [], 403);

        const supabase = createServerClient();
        const { searchParams } = new URL(req.url);
        const { page, pageSize, from, to } = getPagination(searchParams);
        const search = searchParams.get("search");

        let query = supabase
            .from("users")
            .select("id, email, full_name, role, is_active, last_login, created_at", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to);

        if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

        const { data, error, count } = await query;
        if (error) return apiError(error.message);
        return apiSuccess(data, "Users retrieved.", buildPagination(page, pageSize, count ?? 0));
    } catch (err) {
        return apiServerError(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const callerRole = await getCallerRole(req);
        if (!callerRole) return apiError("Not authenticated.", [], 401);
        if (callerRole !== "super_admin") return apiError("Super admin access required.", [], 403);

        const body = await req.json();
        if (!body.email?.trim()) return apiError("Email is required.");
        if (!body.full_name?.trim()) return apiError("Full name is required.");
        if (!body.role) return apiError("Role is required.");

        const validRoles = ["super_admin", "finance_manager", "hr_manager", "inventory_manager", "procurement_officer", "sales_executive", "production_manager", "viewer"];
        if (!validRoles.includes(body.role)) return apiError("Invalid role.");

        // Use Supabase Admin to invite user by email
        // The user will receive a magic link / invite email
        const supabaseAdmin = createServerClient(); // service role — has admin access

        // Check if email already exists
        const { count } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true }).eq("email", body.email.toLowerCase().trim());
        if ((count ?? 0) > 0) return apiError("A user with this email already exists.", [], 409);

        // Create auth user via admin API (invite)
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            body.email.toLowerCase().trim(),
            { data: { full_name: body.full_name.trim() } }
        );

        if (authErr) return apiError(authErr.message);

        // Upsert user profile in public.users
        const { data, error } = await supabaseAdmin.from("users").upsert({
            id: authData.user.id,
            email: body.email.toLowerCase().trim(),
            full_name: body.full_name.trim(),
            role: body.role,
            is_active: true,
        }, { onConflict: "id" }).select().single();

        if (error) return apiError(error.message);
        return apiSuccess(data, "User invited. They will receive an email to set their password.", undefined, 201);
    } catch (err) {
        return apiServerError(err);
    }
}