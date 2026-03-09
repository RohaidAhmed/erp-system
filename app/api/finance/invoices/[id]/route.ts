import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
    apiSuccess, apiError, apiServerError, apiNotFound,
} from "@/lib/utils/api-response";
import type { InvoiceStatus } from "@/types";

// Allowed status transitions per role
// Controllers should pass x-user-role header; for now we read it permissively.
const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
    draft: ["sent", "cancelled"],
    sent: ["approved", "cancelled"],
    approved: ["paid", "cancelled"],
    paid: [],                        // terminal — no further transitions
    overdue: ["paid", "cancelled"],
    cancelled: [],                        // terminal
};

// "void" is stored as "cancelled" — we accept both terms from the client
function normaliseStatus(s: string): InvoiceStatus {
    if (s === "void" || s === "voided") return "cancelled";
    return s as InvoiceStatus;
}

// GET /api/finance/invoices/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const { data, error } = await supabase
            .from("invoices")
            .select("*, customers(id, name, customer_code, email), suppliers(id, name, code)")
            .eq("id", params.id)
            .single();

        if (error || !data) return apiNotFound("Invoice");
        return apiSuccess(data, "Invoice retrieved.");
    } catch (err) {
        return apiServerError(err);
    }
}

// PUT /api/finance/invoices/[id]  — edit editable fields
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();

        const { data: existing } = await supabase
            .from("invoices")
            .select("id, status")
            .eq("id", params.id)
            .single();

        if (!existing) return apiNotFound("Invoice");

        // Only draft and sent invoices can be edited
        if (!["draft", "sent"].includes(existing.status)) {
            return apiError(
                `Invoice cannot be edited in '${existing.status}' status. Only draft or sent invoices are editable.`,
                [], 409
            );
        }

        const body = await req.json();
        const {
            invoice_number, type, amount, tax_amount, currency,
            issue_date, due_date, customer_id, supplier_id, notes,
        } = body;

        if (!invoice_number || !type || !amount || !issue_date || !due_date) {
            return apiError("invoice_number, type, amount, issue_date and due_date are required.");
        }

        const parsedAmount = parseFloat(amount);
        const parsedTax = parseFloat(tax_amount || 0);
        const total_amount = parsedAmount + parsedTax;

        const { data, error } = await supabase
            .from("invoices")
            .update({
                invoice_number,
                type,
                amount: parsedAmount,
                tax_amount: parsedTax,
                total_amount,
                currency: currency || "USD",
                issue_date,
                due_date,
                customer_id: customer_id || null,
                supplier_id: supplier_id || null,
                notes: notes?.trim() || null,
            })
            .eq("id", params.id)
            .select()
            .single();

        if (error) return apiError(error.message);
        return apiSuccess(data, "Invoice updated successfully.");
    } catch (err) {
        return apiServerError(err);
    }
}

// PATCH /api/finance/invoices/[id]  — status transition only
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const body = await req.json();
        const targetStatus = normaliseStatus(body.status);

        if (!targetStatus) {
            return apiError("'status' field is required.", [{ field: "status", message: "Required" }]);
        }

        const { data: existing } = await supabase
            .from("invoices")
            .select("id, status, total_amount")
            .eq("id", params.id)
            .single();

        if (!existing) return apiNotFound("Invoice");

        const currentStatus = existing.status as InvoiceStatus;
        const allowed = TRANSITIONS[currentStatus] ?? [];

        if (!allowed.includes(targetStatus)) {
            return apiError(
                `Cannot transition invoice from '${currentStatus}' to '${targetStatus}'. ` +
                `Allowed next statuses: ${allowed.length ? allowed.join(", ") : "none (terminal status)"}.`,
                [], 409
            );
        }

        const updatePayload: Record<string, unknown> = { status: targetStatus };
        if (targetStatus === "paid") updatePayload.paid_date = body.paid_date || new Date().toISOString().split("T")[0];

        const { data, error } = await supabase
            .from("invoices")
            .update(updatePayload)
            .eq("id", params.id)
            .select()
            .single();

        if (error) return apiError(error.message);

        const messages: Record<string, string> = {
            sent: "Invoice sent successfully.",
            approved: "Invoice approved.",
            paid: "Invoice marked as paid.",
            cancelled: "Invoice voided.",
        };

        return apiSuccess(data, messages[targetStatus] || "Status updated.");
    } catch (err) {
        return apiServerError(err);
    }
}