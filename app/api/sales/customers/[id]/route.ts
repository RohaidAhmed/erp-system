import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("customers").select("*").eq("id", params.id).single();
    if (error || !data) return apiNotFound("Customer");
    return apiSuccess(data, "Customer retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data: existing } = await supabase.from("customers").select("id").eq("id", params.id).single();
    if (!existing) return apiNotFound("Customer");

    const body = await req.json();
    if (!body.name?.trim()) return apiError("Name is required.");
    if (!body.email?.trim()) return apiError("Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return apiError("Invalid email.");

    const { data, error } = await supabase.from("customers").update({
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      tier: body.tier || "standard",
      credit_limit: parseFloat(body.credit_limit || 0),
      currency: body.currency || "USD",
    }).eq("id", params.id).select().single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Customer updated.");
  } catch (err) {
    return apiServerError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { is_active } = await req.json();
    if (typeof is_active !== "boolean") return apiError("'is_active' boolean is required.");

    if (!is_active) {
      const { count } = await supabase
        .from("sales_orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", params.id)
        .not("status", "in", '("delivered","cancelled")');
      if ((count ?? 0) > 0) {
        return apiError(
          `Cannot deactivate a customer with ${count} open sales order(s). Close or cancel them first.`,
          [], 409
        );
      }
    }

    const { data, error } = await supabase.from("customers").update({ is_active }).eq("id", params.id).select().single();
    if (error) return apiError(error.message);
    return apiSuccess(data, is_active ? "Customer reactivated." : "Customer deactivated.");
  } catch (err) {
    return apiServerError(err);
  }
}