import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  apiSuccess, apiError, apiServerError, getPagination, buildPagination,
} from "@/lib/utils/api-response";

// GET /api/procurement/purchase-orders
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const status = searchParams.get("status");
    const supplier_id = searchParams.get("supplier_id");

    let query = supabase
      .from("purchase_orders")
      .select("*, suppliers(id, name, code), purchase_order_items(*, products(id, sku, name))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) query = query.eq("status", status);
    if (supplier_id) query = query.eq("supplier_id", supplier_id);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);

    return apiSuccess(data, "Purchase orders retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

// POST /api/procurement/purchase-orders
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const required = ["po_number", "supplier_id", "order_date", "expected_date"];
    for (const field of required) {
      if (!body[field]) return apiError(`${field} is required.`);
    }

    const items = body.items || [];
    const total_amount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_cost), 0);

    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        po_number: body.po_number,
        supplier_id: body.supplier_id,
        order_date: body.order_date,
        expected_date: body.expected_date,
        currency: body.currency || "USD",
        notes: body.notes,
        status: "draft",
        total_amount,
      })
      .select()
      .single();

    if (poError) return apiError(poError.message);

    if (items.length > 0) {
      const poItems = items.map((item: any) => ({
        po_id: po.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost,
        received_quantity: 0,
      }));

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(poItems);
      if (itemsError) return apiError(itemsError.message);
    }

    return apiSuccess(po, "Purchase order created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}
