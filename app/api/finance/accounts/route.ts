import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiError,
  apiServerError,
  apiNotFound,
  getPagination,
  buildPagination,
} from "@/lib/utils/api-response";

// GET /api/finance/accounts
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    let query = supabase
      .from("accounts")
      .select("*", { count: "exact" })
      .order("account_code", { ascending: true })
      .range(from, to);

    if (type) query = query.eq("type", type);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);

    return apiSuccess(data, "Accounts retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

// POST /api/finance/accounts
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const { account_code, name, type, currency, description, parent_id } = body;
    if (!account_code || !name || !type) {
      return apiError("account_code, name, and type are required.", [
        { field: "account_code", message: "Required" },
        { field: "name", message: "Required" },
        { field: "type", message: "Required" },
      ]);
    }

    const { data, error } = await supabase
      .from("accounts")
      .insert({ account_code, name, type, currency: currency || "USD", description, parent_id })
      .select()
      .single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Account created successfully.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}
