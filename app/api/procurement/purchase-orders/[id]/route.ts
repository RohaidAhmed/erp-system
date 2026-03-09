import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";
import type { POStatus } from "@/types";

const TRANSITIONS: Record<POStatus, POStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["received", "cancelled"],
  received: [],   // terminal
  cancelled: [],   // terminal
};

// GET /api/procurement/purchase-orders/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*, suppliers(id, name, code, email, currency, payment_terms), purchase_order_items(*, products(id, sku, name, unit_of_measure, unit_cost))")
      .eq("id", params.id).single();
    if (error || !data) return apiNotFound("Purchase order");
    return apiSuccess(data, "Purchase order retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}

// PUT /api/procurement/purchase-orders/[id] — edit header + replace items (draft only)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const { data: existing } = await supabase.from("purchase_orders").select("id, status").eq("id", params.id).single();
    if (!existing) return apiNotFound("Purchase order");
    if (existing.status !== "draft") return apiError(`Only draft POs can be edited. Current status: '${existing.status}'.`, [], 409);

    const body = await req.json();
    const { supplier_id, order_date, expected_date, currency, notes, items } = body;

    if (!supplier_id) return apiError("supplier_id is required.");
    if (!order_date) return apiError("order_date is required.");
    if (!expected_date) return apiError("expected_date is required.");
    if (!items?.length) return apiError("At least one line item is required.");

    const total_amount = (items as any[]).reduce((s: number, i: any) => s + (parseFloat(i.quantity) * parseFloat(i.unit_cost)), 0);

    const { data: po, error: poErr } = await supabase.from("purchase_orders").update({
      supplier_id, order_date, expected_date,
      currency: currency || "USD", notes: notes?.trim() || null, total_amount,
    }).eq("id", params.id).select().single();
    if (poErr) return apiError(poErr.message);

    // Replace all items
    await supabase.from("purchase_order_items").delete().eq("po_id", params.id);
    const poItems = (items as any[]).map((i: any) => ({
      po_id: params.id,
      product_id: i.product_id,
      quantity: parseFloat(i.quantity),
      unit_cost: parseFloat(i.unit_cost),
      total_cost: parseFloat(i.quantity) * parseFloat(i.unit_cost),
      received_quantity: 0,
    }));
    const { error: itemErr } = await supabase.from("purchase_order_items").insert(poItems);
    if (itemErr) return apiError(itemErr.message);

    const { data: full } = await supabase
      .from("purchase_orders")
      .select("*, suppliers(id, name, code), purchase_order_items(*, products(id, sku, name, unit_of_measure))")
      .eq("id", params.id).single();

    return apiSuccess(full, "Purchase order updated.");
  } catch (err) {
    return apiServerError(err);
  }
}

// PATCH /api/procurement/purchase-orders/[id] — status transition
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const body = await req.json();
    const targetStatus = body.status as POStatus;
    if (!targetStatus) return apiError("'status' is required.");

    const { data: existing } = await supabase.from("purchase_orders").select("id, status, supplier_id").eq("id", params.id).single();
    if (!existing) return apiNotFound("Purchase order");

    const allowed = TRANSITIONS[existing.status as POStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      return apiError(
        `Cannot transition from '${existing.status}' to '${targetStatus}'. Allowed: ${allowed.length ? allowed.join(", ") : "none (terminal)"}.`,
        [], 409
      );
    }

    const updatePayload: Record<string, unknown> = { status: targetStatus };
    if (targetStatus === "approved") {
      updatePayload.approved_by = body.approved_by || null;
      updatePayload.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase.from("purchase_orders")
      .update(updatePayload).eq("id", params.id)
      .select("*, suppliers(id, name, code), purchase_order_items(*, products(id, sku, name, unit_of_measure))").single();

    if (error) return apiError(error.message);

    const messages: Record<string, string> = {
      pending_approval: "PO submitted for approval.",
      approved: "PO approved.",
      ordered: "PO marked as ordered — awaiting delivery.",
      received: "PO fully received.",
      cancelled: "PO cancelled.",
    };
    return apiSuccess(data, messages[targetStatus] || "Status updated.");
  } catch (err) {
    return apiServerError(err);
  }
}

// POST /api/procurement/purchase-orders/[id]/receive
// Handles goods receipt — updates received_quantity on items and optionally adds stock movements
// We embed this in the main [id] route via query param ?action=receive
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    if (body.action !== "receive") return apiError("Unknown action. Use action: 'receive'.");

    const { data: po } = await supabase
      .from("purchase_orders")
      .select("id, status, supplier_id, purchase_order_items(id, product_id, quantity, received_quantity)")
      .eq("id", params.id).single();

    if (!po) return apiNotFound("Purchase order");
    if (!["approved", "ordered"].includes(po.status)) {
      return apiError(`Goods receipt requires PO to be in 'approved' or 'ordered' status. Current: '${po.status}'.`, [], 409);
    }

    const receipts: { item_id: string; qty: number }[] = body.receipts || [];
    if (!receipts.length) return apiError("receipts array is required.");

    const items = (po as any).purchase_order_items as any[];
    let allReceived = true;

    for (const receipt of receipts) {
      const item = items.find((i: any) => i.id === receipt.item_id);
      if (!item) return apiError(`Item ${receipt.item_id} not found on this PO.`);

      const remaining = item.quantity - item.received_quantity;
      if (receipt.qty > remaining) {
        return apiError(`Cannot receive ${receipt.qty} for item — only ${remaining} remaining.`, [], 422);
      }

      const newReceived = item.received_quantity + receipt.qty;
      await supabase.from("purchase_order_items").update({ received_quantity: newReceived }).eq("id", receipt.item_id);

      // Update stock on hand
      const { data: product } = await supabase.from("products").select("quantity_on_hand").eq("id", item.product_id).single();
      if (product) {
        await supabase.from("products").update({ quantity_on_hand: product.quantity_on_hand + receipt.qty }).eq("id", item.product_id);
      }

      // Log stock movement
      await supabase.from("stock_movements").insert({
        product_id: item.product_id,
        warehouse_id: body.warehouse_id || null,
        type: "inbound",
        quantity: receipt.qty,
        reference: `GRN-${po.id.slice(0, 8).toUpperCase()}`,
        notes: `Goods received against PO ${params.id}`,
      });

      if (newReceived < item.quantity) allReceived = false;
    }

    // Auto-advance status to 'received' if all items fully received
    if (allReceived) {
      // Check all items are fully received
      const { data: allItems } = await supabase.from("purchase_order_items").select("quantity, received_quantity").eq("po_id", params.id);
      const fullyDone = (allItems || []).every((i: any) => i.received_quantity >= i.quantity);
      if (fullyDone) {
        await supabase.from("purchase_orders").update({ status: "received" }).eq("id", params.id);
      }
    }

    const { data: updated } = await supabase
      .from("purchase_orders")
      .select("*, suppliers(id, name, code), purchase_order_items(*, products(id, sku, name, unit_of_measure))")
      .eq("id", params.id).single();

    return apiSuccess(updated, "Goods received and stock updated.");
  } catch (err) {
    return apiServerError(err);
  }
}