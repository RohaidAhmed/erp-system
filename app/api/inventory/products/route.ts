import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  apiSuccess, apiError, apiServerError, getPagination, buildPagination,
} from "@/lib/utils/api-response";

// GET /api/inventory/products
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const low_stock = searchParams.get("low_stock");

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .order("name", { ascending: true })
      .range(from, to);

    if (category) query = query.eq("category", category);
    if (search) query = query.ilike("name", `%${search}%`);
    if (low_stock === "true") query = query.lte("quantity_on_hand", supabase.rpc as any);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);

    return apiSuccess(data, "Products retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

// POST /api/inventory/products
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const required = ["sku", "name", "category", "unit_of_measure"];
    for (const field of required) {
      if (!body[field]) return apiError(`${field} is required.`, [{ field, message: "Required" }]);
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        sku: body.sku,
        name: body.name,
        description: body.description,
        category: body.category,
        unit_of_measure: body.unit_of_measure,
        unit_cost: body.unit_cost || 0,
        unit_price: body.unit_price || 0,
        quantity_on_hand: body.quantity_on_hand || 0,
        reorder_point: body.reorder_point || 0,
        reorder_quantity: body.reorder_quantity || 0,
      })
      .select()
      .single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Product created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}
