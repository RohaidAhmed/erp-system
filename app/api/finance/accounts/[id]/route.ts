import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
    apiSuccess, apiError, apiServerError, apiNotFound,
} from "@/lib/utils/api-response";

// GET /api/finance/accounts/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const { data, error } = await supabase
            .from("accounts")
            .select("*, parent:parent_id(id, account_code, name)")
            .eq("id", params.id)
            .single();

        if (error || !data) return apiNotFound("Account");
        return apiSuccess(data, "Account retrieved.");
    } catch (err) {
        return apiServerError(err);
    }
}

// PUT /api/finance/accounts/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const body = await req.json();

        // Check account exists
        const { data: existing } = await supabase
            .from("accounts")
            .select("id, type")
            .eq("id", params.id)
            .single();
        if (!existing) return apiNotFound("Account");

        const { name, type, currency, description, parent_id, is_active } = body;

        if (!name?.trim()) return apiError("Account name is required.", [{ field: "name", message: "Required" }]);
        if (!type) return apiError("Account type is required.", [{ field: "type", message: "Required" }]);

        // Prevent circular parent reference
        if (parent_id === params.id) {
            return apiError("An account cannot be its own parent.", [{ field: "parent_id", message: "Cannot reference itself" }]);
        }

        const { data, error } = await supabase
            .from("accounts")
            .update({
                name: name.trim(),
                type,
                currency: currency || "USD",
                description: description?.trim() || null,
                parent_id: parent_id || null,
                is_active: is_active ?? true,
            })
            .eq("id", params.id)
            .select()
            .single();

        if (error) return apiError(error.message);
        return apiSuccess(data, "Account updated successfully.");
    } catch (err) {
        return apiServerError(err);
    }
}

// DELETE /api/finance/accounts/[id]  (soft delete — sets is_active = false)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();

        // Check for linked transactions
        const { count } = await supabase
            .from("transactions")
            .select("*", { count: "exact", head: true })
            .eq("account_id", params.id);

        if ((count ?? 0) > 0) {
            return apiError(
                `Cannot deactivate this account — it has ${count} linked transaction(s). Deactivate manually after reconciliation.`,
                [], 409
            );
        }

        const { data, error } = await supabase
            .from("accounts")
            .update({ is_active: false })
            .eq("id", params.id)
            .select()
            .single();

        if (error) return apiError(error.message);
        return apiSuccess(data, "Account deactivated successfully.");
    } catch (err) {
        return apiServerError(err);
    }
}