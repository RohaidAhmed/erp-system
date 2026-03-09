import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";

async function requireSuperAdmin(req: NextRequest): Promise<{ callerId: string } | Response> {
    const supabase = createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return apiError("Not authenticated.", [], 401);
    const db = createServerClient();
    const { data } = await db.from("users").select("role").eq("id", session.user.id).single();
    if (data?.role !== "super_admin") return apiError("Super admin access required.", [], 403);
    return { callerId: session.user.id };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const check = await requireSuperAdmin(req);
        if (check instanceof Response) return check;

        const body = await req.json();
        const validRoles = ["super_admin", "finance_manager", "hr_manager", "inventory_manager", "procurement_officer", "sales_executive", "production_manager", "viewer"];
        if (body.role && !validRoles.includes(body.role)) return apiError("Invalid role.");

        const db = createServerClient();
        const { data: existing } = await db.from("users").select("id").eq("id", params.id).single();
        if (!existing) return apiNotFound("User");

        // Prevent super admin from removing their own admin role
        if (params.id === check.callerId && body.role && body.role !== "super_admin") {
            return apiError("You cannot remove your own super_admin role.", [], 409);
        }

        const updates: Record<string, unknown> = {};
        if (body.full_name) updates.full_name = body.full_name.trim();
        if (body.role) updates.role = body.role;

        const { data, error } = await db.from("users").update(updates).eq("id", params.id).select().single();
        if (error) return apiError(error.message);
        return apiSuccess(data, "User updated.");
    } catch (err) {
        return apiServerError(err);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const check = await requireSuperAdmin(req);
        if (check instanceof Response) return check;

        const body = await req.json();
        const db = createServerClient();

        // Toggle active status
        if (typeof body.is_active === "boolean") {
            if (params.id === check.callerId && !body.is_active) {
                return apiError("You cannot deactivate your own account.", [], 409);
            }
            const { data, error } = await db.from("users").update({ is_active: body.is_active }).eq("id", params.id).select().single();
            if (error) return apiError(error.message);
            return apiSuccess(data, body.is_active ? "User activated." : "User deactivated.");
        }

        // Send password reset email
        if (body.action === "reset_password") {
            const { data: user } = await db.from("users").select("email").eq("id", params.id).single();
            if (!user) return apiNotFound("User");
            const supabaseAdmin = createServerClient();
            const { error } = await supabaseAdmin.auth.admin.generateLink({
                type: "recovery",
                email: user.email,
            });
            if (error) return apiError(error.message);
            return apiSuccess(null, "Password reset email sent.");
        }

        return apiError("Unknown action.");
    } catch (err) {
        return apiServerError(err);
    }
}