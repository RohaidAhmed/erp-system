import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";
import type { SOStatus } from "@/types";

const TRANSITIONS: Record<SOStatus, SOStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["picking", "cancelled"],
  picking: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],   // terminal
  cancelled: [],   // terminal
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("sales_orders")
      .select("*, customers(id, name, customer_code, email, tier, credit_limit, currency), sales_order_items(*, products(id, sku, name, unit_of_measure, unit_price, quantity_on_hand))")
      .eq("id", params.id).single();
    if (error || !data) return apiNotFound("Sales order");
    return apiSuccess(data, "Sales order retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data: existing } = await supabase.from("sales_orders").select("id, status").eq("id", params.id).single();
    if (!existing) return apiNotFound("Sales order");
    if (existing.status !== "draft") return apiError(`Only draft SOs can be edited. Current: '${existing.status}'.`, [], 409);

    const body = await req.json();
    if (!body.customer_id) return apiError("customer_id is required.");
    if (!body.order_date) return apiError("order_date is required.");
    if (!body.items?.length) return apiError("At least one line item is required.");

    const total_amount = (body.items as any[]).reduce((s: number, i: any) =>
      s + parseFloat(i.quantity) * parseFloat(i.unit_price) * (1 - parseFloat(i.discount_pct || 0) / 100), 0);

    const { data: so, error: soErr } = await supabase.from("sales_orders").update({
      customer_id: body.customer_id,
      order_date: body.order_date,
      delivery_date: body.delivery_date || null,
      currency: body.currency || "USD",
      notes: body.notes?.trim() || null,
      total_amount,
    }).eq("id", params.id).select().single();

    if (soErr) return apiError(soErr.message);

    // Replace items
    await supabase.from("sales_order_items").delete().eq("so_id", params.id);
    const soItems = (body.items as any[]).map((i: any) => ({
      so_id: params.id,
      product_id: i.product_id,
      quantity: parseFloat(i.quantity),
      unit_price: parseFloat(i.unit_price),
      discount_pct: parseFloat(i.discount_pct || 0),
      total_price: parseFloat(i.quantity) * parseFloat(i.unit_price) * (1 - parseFloat(i.discount_pct || 0) / 100),
    }));
    const { error: itemErr } = await supabase.from("sales_order_items").insert(soItems);
    if (itemErr) return apiError(itemErr.message);

    const { data: full } = await supabase
      .from("sales_orders")
      .select("*, customers(id, name, customer_code), sales_order_items(*, products(id, sku, name, unit_of_measure))")
      .eq("id", params.id).single();

    return apiSuccess(full, "Sales order updated.");
  } catch (err) {
    return apiServerError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const body = await req.json();
    const targetStatus = body.status as SOStatus;
    if (!targetStatus) return apiError("'status' is required.");

    const { data: existing } = await supabase
      .from("sales_orders")
      .select("id, status, sales_order_items(product_id, quantity)")
      .eq("id", params.id).single();
    if (!existing) return apiNotFound("Sales order");

    const allowed = TRANSITIONS[existing.status as SOStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      return apiError(
        `Cannot transition from '${existing.status}' to '${targetStatus}'. Allowed: ${allowed.length ? allowed.join(", ") : "none (terminal)"}.`,
        [], 409
      );
    }

    // On 'shipped' — deduct stock from inventory
    if (targetStatus === "shipped") {
      const items = (existing as any).sales_order_items as any[];
      for (const item of items) {
        const { data: product } = await supabase.from("products").select("quantity_on_hand, name").eq("id", item.product_id).single();
        if (!product) continue;
        if (product.quantity_on_hand < item.quantity) {
          return apiError(
            `Insufficient stock for '${product.name}': on hand ${product.quantity_on_hand}, required ${item.quantity}.`,
            [], 422
          );
        }
        const newQty = product.quantity_on_hand - item.quantity;
        await supabase.from("products").update({ quantity_on_hand: newQty }).eq("id", item.product_id);
        // Log outbound movement
        await supabase.from("stock_movements").insert({
          product_id: item.product_id,
          warehouse_id: body.warehouse_id || null,
          type: "outbound",
          quantity: item.quantity,
          reference: `SO-${params.id.slice(0, 8).toUpperCase()}`,
          notes: `Shipped against Sales Order ${params.id}`,
        });
      }
    }

    const { data, error } = await supabase.from("sales_orders")
      .update({ status: targetStatus })
      .eq("id", params.id)
      .select("*, customers(id, name, customer_code), sales_order_items(*, products(id, sku, name, unit_of_measure))")
      .single();

    if (error) return apiError(error.message);
    return apiSuccess(data, `Sales order ${targetStatus.replace(/_/g, " ")}.`);
  } catch (err) {
    return apiServerError(err);
  }
}