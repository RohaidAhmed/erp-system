import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, getPagination, buildPagination } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const status = searchParams.get("status");
    const customer_id = searchParams.get("customer_id");

    let query = supabase
      .from("sales_orders")
      .select("*, customers(id, name, customer_code, tier, currency), sales_order_items(*, products(id, sku, name, unit_of_measure))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) query = query.eq("status", status);
    if (customer_id) query = query.eq("customer_id", customer_id);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);
    return apiSuccess(data, "Sales orders retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    if (!body.so_number?.trim()) return apiError("SO number is required.");
    if (!body.customer_id) return apiError("customer_id is required.");
    if (!body.order_date) return apiError("order_date is required.");
    if (!body.items?.length) return apiError("At least one line item is required.");

    const { count } = await supabase.from("sales_orders").select("*", { count: "exact", head: true }).eq("so_number", body.so_number.trim());
    if ((count ?? 0) > 0) return apiError("A sales order with this number already exists.", [{ field: "so_number", message: "Duplicate" }], 409);

    const total_amount = (body.items as any[]).reduce((s: number, i: any) => {
      return s + parseFloat(i.quantity) * parseFloat(i.unit_price) * (1 - (parseFloat(i.discount_pct || 0) / 100));
    }, 0);

    const { data: so, error: soErr } = await supabase.from("sales_orders").insert({
      so_number: body.so_number.trim(),
      customer_id: body.customer_id,
      order_date: body.order_date,
      delivery_date: body.delivery_date || null,
      currency: body.currency || "USD",
      notes: body.notes?.trim() || null,
      status: "draft",
      total_amount,
    }).select().single();

    if (soErr) return apiError(soErr.message);

    const soItems = (body.items as any[]).map((i: any) => ({
      so_id: so.id,
      product_id: i.product_id,
      quantity: parseFloat(i.quantity),
      unit_price: parseFloat(i.unit_price),
      discount_pct: parseFloat(i.discount_pct || 0),
      total_price: parseFloat(i.quantity) * parseFloat(i.unit_price) * (1 - (parseFloat(i.discount_pct || 0) / 100)),
    }));

    const { error: itemErr } = await supabase.from("sales_order_items").insert(soItems);
    if (itemErr) return apiError(itemErr.message);

    return apiSuccess(so, "Sales order created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}