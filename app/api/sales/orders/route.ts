import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  apiSuccess, apiError, apiServerError, getPagination, buildPagination,
} from "@/lib/utils/api-response";

// GET /api/sales/orders
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const status = searchParams.get("status");
    const customer_id = searchParams.get("customer_id");

    let query = supabase
      .from("sales_orders")
      .select("*, customers(id, name, customer_code), sales_order_items(*, products(id, sku, name))", { count: "exact" })
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

// POST /api/sales/orders
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    if (!body.so_number || !body.customer_id || !body.order_date) {
      return apiError("so_number, customer_id and order_date are required.");
    }

    const items = body.items || [];
    const total_amount = items.reduce((sum: number, item: any) => {
      const lineTotal = item.quantity * item.unit_price;
      return sum + lineTotal * (1 - (item.discount_pct || 0) / 100);
    }, 0);

    const { data: so, error: soError } = await supabase
      .from("sales_orders")
      .insert({
        so_number: body.so_number,
        customer_id: body.customer_id,
        order_date: body.order_date,
        delivery_date: body.delivery_date,
        currency: body.currency || "USD",
        notes: body.notes,
        status: "draft",
        total_amount,
      })
      .select()
      .single();

    if (soError) return apiError(soError.message);

    if (items.length > 0) {
      const soItems = items.map((item: any) => ({
        so_id: so.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_pct: item.discount_pct || 0,
        total_price: item.quantity * item.unit_price * (1 - (item.discount_pct || 0) / 100),
      }));
      const { error: itemsError } = await supabase.from("sales_order_items").insert(soItems);
      if (itemsError) return apiError(itemsError.message);
    }

    return apiSuccess(so, "Sales order created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}
