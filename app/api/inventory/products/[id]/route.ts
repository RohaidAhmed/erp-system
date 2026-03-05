import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";

// GET /api/inventory/products/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const { data, error } = await supabase.from("products").select("*").eq("id", params.id).single();
        if (error || !data) return apiNotFound("Product");
        return apiSuccess(data, "Product retrieved.");
    } catch (err) {
        return apiServerError(err);
    }
}

// PUT /api/inventory/products/[id] — edit all fields except SKU
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const { data: existing } = await supabase.from("products").select("id, sku").eq("id", params.id).single();
        if (!existing) return apiNotFound("Product");

        const body = await req.json();
        if (!body.name?.trim()) return apiError("Name is required.");
        if (!body.category?.trim()) return apiError("Category is required.");
        if (!body.unit_of_measure?.trim()) return apiError("Unit of measure is required.");

        const { data, error } = await supabase.from("products").update({
            name: body.name.trim(),
            description: body.description?.trim() || null,
            category: body.category.trim(),
            unit_of_measure: body.unit_of_measure.trim(),
            unit_cost: parseFloat(body.unit_cost || 0),
            unit_price: parseFloat(body.unit_price || 0),
            reorder_point: parseFloat(body.reorder_point || 0),
            reorder_quantity: parseFloat(body.reorder_quantity || 0),
        }).eq("id", params.id).select().single();

        if (error) return apiError(error.message);
        return apiSuccess(data, "Product updated.");
    } catch (err) {
        return apiServerError(err);
    }
}

// PATCH /api/inventory/products/[id] — toggle is_active only
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const { is_active } = await req.json();
        if (typeof is_active !== "boolean") return apiError("'is_active' boolean field is required.");

        const { data: existing } = await supabase.from("products").select("id, quantity_on_hand").eq("id", params.id).single();
        if (!existing) return apiNotFound("Product");

        // Prevent deactivating a product with stock on hand
        if (!is_active && existing.quantity_on_hand > 0) {
            return apiError(
                `Cannot deactivate a product with ${existing.quantity_on_hand} units on hand. ` +
                `Zero out the stock first via a stock adjustment.`,
                [], 409
            );
        }

        const { data, error } = await supabase.from("products").update({ is_active }).eq("id", params.id).select().single();
        if (error) return apiError(error.message);
        return apiSuccess(data, is_active ? "Product reactivated." : "Product deactivated.");
    } catch (err) {
        return apiServerError(err);
    }
}