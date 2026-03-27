import { createServerClient } from "@/lib/supabase/server";
import { apiError, apiServerError, apiSuccess, buildPagination, getPagination } from "@/lib/utils/api-response";
import { dayCount } from "@/lib/utils/util";
import { NextRequest } from "next/server";


export async function GET(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(req.url);
        const { page, pageSize, from, to } = getPagination(searchParams);
        const status = searchParams.get("status");

        let query = supabase
            .from("leave_requests")
            .select("*, employees(id, full_name, employee_code, photo_url, department_id, departments(name))")
            .order("employee_id", { ascending: true })
            .range(from, to);

        if (status) query = query.eq("status", status);

        const { data, error, count } = await query;
        if (error) return apiError(error.message);

        return apiSuccess(
            data,
            "Leave Requests retrieved",
            buildPagination(page, pageSize, count ?? 0)
        );
    } catch (error) {
        return apiServerError(error)
    }
}


// POST /api/he/leave
export async function POST(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const body = await req.json();

        const required = ["employee_id", "leave_type", "start_date", "end_date", "reason"];

        for (const field of required) {
            if (!body[field]) {
                return apiError(`${field} is required.`, [{
                    field,
                    message: "Required"
                }]);
            }
        }

        const { data, error } = await supabase
            .from("leave_requests")
            .insert({
                employee_id: body.employee_id,
                leave_type: body.leave_type,
                start_date: body.start_date,
                end_date: body.end_date,
                reason: body.reason,
                status: body.status,
                days_count: dayCount(body.start_date, body.end_date),
            })
            .select("*")
            .single();

        if (error) return apiError(error.message);

        return apiSuccess(data, "Leave Request Created.", undefined, 201);
    } catch (error) {
        return apiServerError(error)
    }
}