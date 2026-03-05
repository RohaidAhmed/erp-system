import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, getPagination, buildPagination } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const inactive = searchParams.get("inactive") === "true";

    let query = supabase
      .from("warehouses")
      .select("*, manager:manager_id(id, full_name, position)", { count: "exact" })
      .order("name", { ascending: true })
      .range(from, to);

    if (!inactive) query = query.eq("is_active", true);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);
    return apiSuccess(data, "Warehouses retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    if (!body.code?.trim()) return apiError("Warehouse code is required.");
    if (!body.name?.trim()) return apiError("Warehouse name is required.");
    if (!body.location?.trim()) return apiError("Location is required.");

    const { count } = await supabase.from("warehouses").select("*", { count: "exact", head: true }).eq("code", body.code.trim().toUpperCase());
    if ((count ?? 0) > 0) return apiError("A warehouse with this code already exists.", [{ field: "code", message: "Duplicate" }], 409);

    const { data, error } = await supabase.from("warehouses").insert({
      code:       body.code.trim().toUpperCase(),
      name:       body.name.trim(),
      location:   body.location.trim(),
      capacity:   parseFloat(body.capacity || 0),
      manager_id: body.manager_id || null,
    }).select("*, manager:manager_id(id, full_name, position)").single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Warehouse created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}