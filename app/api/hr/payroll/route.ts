import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
    apiSuccess, apiError, apiServerError, getPagination, buildPagination,
} from "@/lib/utils/api-response";
// import { supabase } from "@/lib/supabase/client";

// GET /api/hr/payrolls
export async function GET(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(req.url);
        const { page, pageSize, from, to } = getPagination(searchParams);
        const status = searchParams.get("status")
        const department_id = searchParams.get("department_id");
        const search = searchParams.get("search");

        let query = supabase
            .from("payrolls")
            .select("*", { count: "exact" })
            .order("employee_id", { ascending: true })
            .range(from, to);
        if (status) query = query.eq("status", status);

        const { data, error, count } = await query;
        if (error) return apiError(error.message);
        return apiSuccess(data, "Payrolls retrieved.", buildPagination(page, pageSize, count ?? 0));
    } catch (err) {
        return apiServerError(err);
    }
}

// POST /api/hr/payrolls
export async function POST(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const body = await req.json();

        const required = ["employee_id", "period_start", "period_end", "gross_salary"];
        for (const field of required) {
            if (!body[field]) {
                return apiError(`${field} is required.`, [{
                    field,
                    message: "Required",
                }]);
            }
        }

        if (body.gross_salary <= 0) {
            return apiError("Gross Salary must be positive.", [{
                field: "Gross Salary",
                message: "Must be >= 0."
            }]);
        }

        const { data, error } = await supabase
            .from("payrolls")
            .insert({
                employee_id: body.employee_id,
                period_start: body.period_start,
                period_end: body.period_end,
                gross_salary: body.gross_salary,
                currency: body.currency || "PKR",
                deductions: body.deductions || 0,
                tax_amount: body.tax_amount || 0,
                net_salary: body.net_salary || String(Number(body.gross_salary) - Number(body.deductions) - Number(body.tax_amount)),
            })
            .select("*")
            .single();

        if (error) return apiError(error.message);

        return apiSuccess(data, "Payroll Created", undefined, 201);

    } catch (error) {
        return apiServerError(error);
    }
}