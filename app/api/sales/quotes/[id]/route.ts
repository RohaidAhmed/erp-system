import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent", "rejected"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],   // terminal — convert to SO
  rejected: [],   // terminal
  expired: [],   // terminal
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("quotes")
      .select("*, customers(id, name, customer_code, email, tier, credit_limit, currency)")
      .eq("id", params.id).single();
    if (error || !data) return apiNotFound("Quote");
    return apiSuccess(data, "Quote retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data: existing } = await supabase.from("quotes").select("id, status").eq("id", params.id).single();
    if (!existing) return apiNotFound("Quote");
    if (existing.status !== "draft") return apiError(`Only draft quotes can be edited. Current: '${existing.status}'.`, [], 409);

    const body = await req.json();
    if (!body.customer_id) return apiError("customer_id is required.");
    if (!body.valid_until) return apiError("valid_until is required.");

    const total_amount = ((body.items || []) as any[]).reduce((s: number, i: any) =>
      s + parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0) * (1 - parseFloat(i.discount_pct || 0) / 100), 0);

    const { data, error } = await supabase.from("quotes").update({
      customer_id: body.customer_id,
      valid_until: body.valid_until,
      currency: body.currency || "USD",
      total_amount,
    }).eq("id", params.id).select("*, customers(id, name, customer_code, tier)").single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Quote updated.");
  } catch (err) {
    return apiServerError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const body = await req.json();
    const targetStatus = body.status as QuoteStatus;
    if (!targetStatus) return apiError("'status' is required.");

    const { data: existing } = await supabase.from("quotes").select("id, status, quote_number, customer_id, total_amount, currency").eq("id", params.id).single();
    if (!existing) return apiNotFound("Quote");

    const allowed = TRANSITIONS[existing.status as QuoteStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      return apiError(
        `Cannot transition from '${existing.status}' to '${targetStatus}'. Allowed: ${allowed.length ? allowed.join(", ") : "none (terminal)"}.`,
        [], 409
      );
    }

    const { data, error } = await supabase.from("quotes")
      .update({ status: targetStatus })
      .eq("id", params.id)
      .select("*, customers(id, name, customer_code, tier)")
      .single();

    if (error) return apiError(error.message);
    return apiSuccess(data, `Quote ${targetStatus}.`);
  } catch (err) {
    return apiServerError(err);
  }
}

// POST /api/sales/quotes/[id] — convert accepted quote to sales order
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const body = await req.json();
    if (body.action !== "convert_to_so") return apiError("Unknown action. Use action: 'convert_to_so'.");

    const { data: quote } = await supabase
      .from("quotes")
      .select("*, customers(id, name, customer_code, currency)")
      .eq("id", params.id).single();

    if (!quote) return apiNotFound("Quote");
    if (quote.status !== "accepted") {
      return apiError(`Only accepted quotes can be converted to sales orders. Current status: '${quote.status}'.`, [], 409);
    }

    // Auto-generate SO number from quote number
    const soNumber = `SO-${quote.quote_number.replace(/^Q(UO?T?E?-?)?/i, "")}`.toUpperCase();
    const orderDate = new Date().toISOString().split("T")[0];

    const { data: so, error: soErr } = await supabase.from("sales_orders").insert({
      so_number: body.so_number || soNumber,
      customer_id: quote.customer_id,
      order_date: orderDate,
      delivery_date: body.delivery_date || null,
      currency: quote.currency,
      total_amount: quote.total_amount,
      notes: `Converted from Quote ${quote.quote_number}`,
      status: "draft",
    }).select("*, customers(id, name, customer_code)").single();

    if (soErr) {
      if (soErr.message.includes("unique")) return apiError(`SO number '${soNumber}' already exists. Provide a custom so_number.`, [], 409);
      return apiError(soErr.message);
    }

    return apiSuccess({ quote, sales_order: so }, "Quote converted to sales order.");
  } catch (err) {
    return apiServerError(err);
  }
}