import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, getPagination, buildPagination } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const tier = searchParams.get("tier");
    const search = searchParams.get("search");
    const inactive = searchParams.get("inactive") === "true";

    let query = supabase
      .from("customers")
      .select("*", { count: "exact" })
      .order("name", { ascending: true })
      .range(from, to);

    if (!inactive) query = query.eq("is_active", true);
    if (tier) query = query.eq("tier", tier);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,customer_code.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);
    return apiSuccess(data, "Customers retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    if (!body.customer_code?.trim()) return apiError("Customer code is required.", [{ field: "customer_code", message: "Required" }]);
    if (!body.name?.trim()) return apiError("Name is required.", [{ field: "name", message: "Required" }]);
    if (!body.email?.trim()) return apiError("Email is required.", [{ field: "email", message: "Required" }]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return apiError("Invalid email.", [{ field: "email", message: "Invalid" }]);

    const { count } = await supabase.from("customers").select("*", { count: "exact", head: true }).eq("customer_code", body.customer_code.trim().toUpperCase());
    if ((count ?? 0) > 0) return apiError("A customer with this code already exists.", [{ field: "customer_code", message: "Duplicate" }], 409);

    const { data, error } = await supabase.from("customers").insert({
      customer_code: body.customer_code.trim().toUpperCase(),
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      tier: body.tier || "standard",
      credit_limit: parseFloat(body.credit_limit || 0),
      currency: body.currency || "USD",
    }).select().single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Customer created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}