import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError } from "@/lib/utils/api-response";

// GET /api/hr/employees/:id
export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createServerClient();
        const { id } = params;

        const { data, error } = await supabase
            .from("employees")
            .select("*, departments(id, name)")
            .eq("id", id)
            .single();

        if (error) return apiError(error.message);
        if (!data) return apiError("Employee not found.");

        return apiSuccess(data, "Employee retrieved.");
    } catch (err) {
        return apiServerError(err);
    }
}

// PATCH /api/hr/employees/:id
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createServerClient();
        const { id } = params;
        const body = await req.json();

        if (body.salary && body.salary <= 0) {
            return apiError("Salary must be positive.", [
                { field: "salary", message: "Must be > 0" },
            ]);
        }

        const { data, error } = await supabase
            .from("employees")
            .update({
                ...body,
            })
            .eq("id", id)
            .select("*, departments(id, name)")
            .single();

        if (error) return apiError(error.message);
        return apiSuccess(data, "Employee updated.");
    } catch (err) {
        return apiServerError(err);
    }
}

// DELETE /api/hr/employees/:id
export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createServerClient();
        const { id } = params;

        const { error } = await supabase
            .from("employees")
            .delete()
            .eq("id", id);

        if (error) return apiError(error.message);

        return apiSuccess(null, "Employee deleted.");
    } catch (err) {
        return apiServerError(err);
    }
}