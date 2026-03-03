import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  apiSuccess, apiError, apiServerError, getPagination, buildPagination,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const status = searchParams.get("status");

    let query = supabase
      .from("work_orders")
      .select("*, products(id, sku, name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);

    return apiSuccess(data, "Work orders retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    if (!body.wo_number || !body.product_id || !body.bom_id || !body.quantity || !body.planned_start || !body.planned_end) {
      return apiError("All required fields must be provided.");
    }

    const { data, error } = await supabase
      .from("work_orders")
      .insert({
        wo_number: body.wo_number,
        product_id: body.product_id,
        bom_id: body.bom_id,
        quantity: body.quantity,
        planned_start: body.planned_start,
        planned_end: body.planned_end,
        notes: body.notes,
        status: "planned",
      })
      .select("*, products(id, sku, name)")
      .single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Work order created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}
