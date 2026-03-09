import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, getPagination, buildPagination } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const category  = searchParams.get("category");
    const search    = searchParams.get("search");
    const low_stock = searchParams.get("low_stock") === "true";
    const inactive  = searchParams.get("inactive") === "true";

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .order("name", { ascending: true })
      .range(from, to);

    if (!inactive) query = query.eq("is_active", true);
    if (category)  query = query.eq("category", category);
    if (search)    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);

    // client-side low_stock filter (qty <= reorder_point)
    const result = low_stock
      ? (data ?? []).filter((p: any) => p.quantity_on_hand <= p.reorder_point)
      : (data ?? []);

    return apiSuccess(result, "Products retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();
    const required = ["sku", "name", "category", "unit_of_measure"];
    for (const f of required) {
      if (!body[f]?.toString().trim()) return apiError(`${f} is required.`, [{ field: f, message: "Required" }]);
    }
    // Duplicate SKU check
    const { count } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("sku", body.sku.trim());
    if ((count ?? 0) > 0) return apiError("A product with this SKU already exists.", [{ field: "sku", message: "Duplicate SKU" }], 409);

    const { data, error } = await supabase.from("products").insert({
      sku:              body.sku.trim().toUpperCase(),
      name:             body.name.trim(),
      description:      body.description?.trim() || null,
      category:         body.category.trim(),
      unit_of_measure:  body.unit_of_measure.trim(),
      unit_cost:        parseFloat(body.unit_cost || 0),
      unit_price:       parseFloat(body.unit_price || 0),
      quantity_on_hand: parseFloat(body.quantity_on_hand || 0),
      reorder_point:    parseFloat(body.reorder_point || 0),
      reorder_quantity: parseFloat(body.reorder_quantity || 0),
    }).select().single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Product created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}