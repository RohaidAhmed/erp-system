import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
    apiSuccess, apiError, apiServerError, getPagination, buildPagination,
} from "@/lib/utils/api-response";

// GET /api/finance/transactions
export async function GET(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(req.url);
        const { page, pageSize, from, to } = getPagination(searchParams);
        const status = searchParams.get("status");
        const type = searchParams.get("type");
        const account_id = searchParams.get("account_id");
        const date_from = searchParams.get("date_from");
        const date_to = searchParams.get("date_to");
        const search = searchParams.get("search");

        let query = supabase
            .from("transactions")
            .select("*, accounts(id, account_code, name, type)", { count: "exact" })
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, to);

        if (status) query = query.eq("status", status);
        if (type) query = query.eq("type", type);
        if (account_id) query = query.eq("account_id", account_id);
        if (date_from) query = query.gte("date", date_from);
        if (date_to) query = query.lte("date", date_to);
        if (search) query = query.ilike("reference", `%${search}%`);

        const { data, error, count } = await query;
        if (error) return apiError(error.message);

        return apiSuccess(data, "Transactions retrieved.", buildPagination(page, pageSize, count ?? 0));
    } catch (err) {
        return apiServerError(err);
    }
}

// POST /api/finance/transactions
export async function POST(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const body = await req.json();

        const { account_id, amount, type, date, reference, description, invoice_id } = body;

        // Validate required fields
        const missing: { field: string; message: string }[] = [];
        if (!account_id) missing.push({ field: "account_id", message: "Account is required." });
        if (!amount) missing.push({ field: "amount", message: "Amount is required." });
        if (!type) missing.push({ field: "type", message: "Type is required." });
        if (!date) missing.push({ field: "date", message: "Date is required." });
        if (!reference?.trim()) missing.push({ field: "reference", message: "Reference is required." });
        if (missing.length > 0) return apiError("Validation failed.", missing);

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return apiError("Amount must be a positive number.", [{ field: "amount", message: "Must be > 0" }]);
        }

        // Insert transaction
        const { data: txn, error: txnError } = await supabase
            .from("transactions")
            .insert({
                account_id,
                amount: parsedAmount,
                type,
                date,
                reference: reference.trim(),
                description: description?.trim() || null,
                invoice_id: invoice_id || null,
                status: "pending",
            })
            .select("*, accounts(id, account_code, name, type)")
            .single();

        if (txnError) return apiError(txnError.message);

        // Update account balance: debit increases assets/expenses, credit increases liabilities/equity/revenue
        const { data: account } = await supabase
            .from("accounts")
            .select("balance, type")
            .eq("id", account_id)
            .single();

        if (account) {
            const isNormalDebit = ["asset", "expense"].includes(account.type);
            const delta = type === "debit"
                ? (isNormalDebit ? parsedAmount : -parsedAmount)
                : (isNormalDebit ? -parsedAmount : parsedAmount);

            await supabase
                .from("accounts")
                .update({ balance: account.balance + delta })
                .eq("id", account_id);
        }

        return apiSuccess(txn, "Transaction created successfully.", undefined, 201);
    } catch (err) {
        return apiServerError(err);
    }
}