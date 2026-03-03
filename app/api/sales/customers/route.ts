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
    const tier = searchParams.get("tier");
    const search = searchParams.get("search");

    let query = supabase
      .from("customers")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .order("name", { ascending: true })
      .range(from, to);

    if (tier) query = query.eq("tier", tier);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

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

    if (!body.customer_code || !body.name || !body.email) {
      return apiError("customer_code, name and email are required.");
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        customer_code: body.customer_code,
        name: body.name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        tier: body.tier || "standard",
        credit_limit: body.credit_limit || 0,
        currency: body.currency || "USD",
      })
      .select()
      .single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Customer created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}
