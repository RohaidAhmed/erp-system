import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, getPagination, buildPagination } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(req.url);
        const { page, pageSize, from, to } = getPagination(searchParams);
        const product_id = searchParams.get("product_id");
        const warehouse_id = searchParams.get("warehouse_id");
        const type = searchParams.get("type");

        let query = supabase
            .from("stock_movements")
            .select(
                "*, product:product_id(id, sku, name, unit_of_measure), warehouse:warehouse_id(id, name, code)",
                { count: "exact" }
            )
            .order("created_at", { ascending: false })
            .range(from, to);

        if (product_id) query = query.eq("product_id", product_id);
        if (warehouse_id) query = query.eq("warehouse_id", warehouse_id);
        if (type) query = query.eq("type", type);

        const { data, error, count } = await query;
        if (error) return apiError(error.message);
        return apiSuccess(data, "Stock movements retrieved.", buildPagination(page, pageSize, count ?? 0));
    } catch (err) {
        return apiServerError(err);
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const body = await req.json();
        const { product_id, warehouse_id, type, quantity, reference, notes } = body;

        if (!product_id) return apiError("product_id is required.");
        if (!warehouse_id) return apiError("warehouse_id is required.");
        if (!type) return apiError("type is required.");
        if (!reference?.trim()) return apiError("reference is required.");
        const qty = parseFloat(quantity);
        if (!quantity || isNaN(qty) || qty <= 0) return apiError("quantity must be a positive number.");

        // Fetch current product stock
        const { data: product } = await supabase
            .from("products")
            .select("id, name, quantity_on_hand, is_active")
            .eq("id", product_id).single();

        if (!product) return apiError("Product not found.", [], 404);
        if (!product.is_active) return apiError("Cannot record movement for an inactive product.", [], 409);

        // Validate outbound won't go negative
        if (type === "outbound" && product.quantity_on_hand < qty) {
            return apiError(
                `Insufficient stock. On hand: ${product.quantity_on_hand}, requested: ${qty}.`,
                [{ field: "quantity", message: "Exceeds available stock" }],
                422
            );
        }

        // Calculate delta — outbound reduces stock
        const delta = (type === "inbound" || type === "adjustment") ? qty
            : type === "outbound" ? -qty
                : 0; // transfer: handled externally; no global qty change here

        // Insert movement record
        const { data: movement, error: mvErr } = await supabase
            .from("stock_movements")
            .insert({ product_id, warehouse_id, type, quantity: qty, reference: reference.trim(), notes: notes?.trim() || null })
            .select("*, product:product_id(id, sku, name, unit_of_measure), warehouse:warehouse_id(id, name, code)")
            .single();

        if (mvErr) return apiError(mvErr.message);

        // Update product quantity_on_hand
        if (delta !== 0) {
            const newQty = Math.max(0, product.quantity_on_hand + delta);
            await supabase.from("products").update({ quantity_on_hand: newQty }).eq("id", product_id);
        }

        return apiSuccess(movement, "Stock movement recorded.", undefined, 201);
    } catch (err) {
        return apiServerError(err);
    }
}