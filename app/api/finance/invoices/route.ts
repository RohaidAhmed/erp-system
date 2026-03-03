import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  apiSuccess, apiError, apiServerError, getPagination, buildPagination,
} from "@/lib/utils/api-response";

// GET /api/finance/invoices
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    let query = supabase
      .from("invoices")
      .select("*, customers(id, name, customer_code)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);

    const { data, error, count } = await query;
    if (error) return apiError(error.message);

    return apiSuccess(data, "Invoices retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

// POST /api/finance/invoices
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const { invoice_number, type, amount, tax_amount, currency, issue_date, due_date, customer_id, supplier_id, notes } = body;
    if (!invoice_number || !type || !amount || !issue_date || !due_date) {
      return apiError("Required fields missing.");
    }

    const total_amount = (parseFloat(amount) + parseFloat(tax_amount || 0)).toFixed(2);

    const { data, error } = await supabase
      .from("invoices")
      .insert({ invoice_number, type, amount, tax_amount: tax_amount || 0, total_amount, currency: currency || "USD", issue_date, due_date, customer_id, supplier_id, notes, status: "draft" })
      .select()
      .single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Invoice created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}
