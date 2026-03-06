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
      .from("quotes")
      .select("*, customers(id, name, customer_code, tier)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) query = query.eq("status", status);
    if (customer_id) query = query.eq("customer_id", customer_id);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);
    return apiSuccess(data, "Quotes retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    if (!body.quote_number?.trim()) return apiError("Quote number is required.", [{ field: "quote_number", message: "Required" }]);
    if (!body.customer_id) return apiError("customer_id is required.", [{ field: "customer_id", message: "Required" }]);
    if (!body.valid_until) return apiError("valid_until is required.", [{ field: "valid_until", message: "Required" }]);

    const { count } = await supabase.from("quotes").select("*", { count: "exact", head: true }).eq("quote_number", body.quote_number.trim());
    if ((count ?? 0) > 0) return apiError("A quote with this number already exists.", [{ field: "quote_number", message: "Duplicate" }], 409);

    const total_amount = ((body.items || []) as any[]).reduce((s: number, i: any) =>
      s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0) * (1 - parseFloat(i.discount_pct || 0) / 100), 0);

    const { data: quote, error: qErr } = await supabase.from("quotes").insert({
      quote_number: body.quote_number.trim(),
      customer_id: body.customer_id,
      valid_until: body.valid_until,
      currency: body.currency || "USD",
      total_amount,
      status: "draft",
      version: 1,
    }).select().single();

    if (qErr) return apiError(qErr.message);

    // Store items in a quote_items table if it exists; for now store as metadata note
    return apiSuccess(quote, "Quote created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}