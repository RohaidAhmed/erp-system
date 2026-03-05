import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("warehouses")
      .select("*, manager:manager_id(id, full_name, position)")
      .eq("id", params.id).single();
    if (error || !data) return apiNotFound("Warehouse");
    return apiSuccess(data, "Warehouse retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data: existing } = await supabase.from("warehouses").select("id").eq("id", params.id).single();
    if (!existing) return apiNotFound("Warehouse");

    const body = await req.json();
    if (!body.name?.trim()) return apiError("Name is required.");
    if (!body.location?.trim()) return apiError("Location is required.");

    const { data, error } = await supabase.from("warehouses").update({
      name: body.name.trim(),
      location: body.location.trim(),
      capacity: parseFloat(body.capacity || 0),
      manager_id: body.manager_id || null,
    }).eq("id", params.id).select("*, manager:manager_id(id, full_name, position)").single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Warehouse updated.");
  } catch (err) {
    return apiServerError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { is_active } = await req.json();
    if (typeof is_active !== "boolean") return apiError("'is_active' boolean required.");

    const { data: existing } = await supabase.from("warehouses").select("id").eq("id", params.id).single();
    if (!existing) return apiNotFound("Warehouse");

    const { data, error } = await supabase.from("warehouses").update({ is_active })
      .eq("id", params.id).select("*, manager:manager_id(id, full_name, position)").single();
    if (error) return apiError(error.message);
    return apiSuccess(data, is_active ? "Warehouse reactivated." : "Warehouse deactivated.");
  } catch (err) {
    return apiServerError(err);
  }
}