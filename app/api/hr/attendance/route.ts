import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, getPagination, buildPagination } from "@/lib/utils/api-response";

// GET /api/hr/attendance
export async function GET(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(req.url);
        const { page, pageSize, from, to } = getPagination(searchParams);

        const date_from = searchParams.get("date_from");
        const date_to = searchParams.get("date_to");
        const employee_id = searchParams.get("employee_id");
        const department_id = searchParams.get("department_id");
        const status = searchParams.get("status");

        let query = supabase
            .from("attendance")
            .select(`
        *,
        employees(id, full_name, employee_code, photo_url, department_id,
          departments(name)
        ),
        shifts(id, name, start_time, end_time)
      `, { count: "exact" })
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, to);

        if (date_from) query = query.gte("date", date_from);
        if (date_to) query = query.lte("date", date_to);
        if (employee_id) query = query.eq("employee_id", employee_id);
        if (status) query = query.eq("status", status);
        if (department_id) {
            // Filter by department via employee join
            const { data: empIds } = await supabase
                .from("employees")
                .select("id")
                .eq("department_id", department_id);
            const ids = (empIds || []).map((e: any) => e.id);
            if (ids.length === 0) return apiSuccess([], "No employees in this department.", buildPagination(page, pageSize, 0));
            query = query.in("employee_id", ids);
        }

        const { data, error, count } = await query;
        if (error) return apiError(error.message);
        return apiSuccess(data, "Attendance records retrieved.", buildPagination(page, pageSize, count ?? 0));
    } catch (err) {
        return apiServerError(err);
    }
}

// POST /api/hr/attendance — create a single attendance record (or bulk upsert for a date)
export async function POST(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const body = await req.json();

        // Bulk mode: { date, records: [{ employee_id, status, check_in?, check_out?, shift_id?, notes? }] }
        if (body.bulk && Array.isArray(body.records)) {
            if (!body.date) return apiError("date is required for bulk entry.");
            const rows = body.records.map((r: any) => ({
                employee_id: r.employee_id,
                date: body.date,
                check_in: r.check_in || null,
                check_out: r.check_out || null,
                shift_id: r.shift_id || null,
                status: r.status || "absent",
                overtime_mins: r.overtime_mins || 0,
                notes: r.notes || null,
            }));
            const { data, error } = await supabase
                .from("attendance")
                .upsert(rows, { onConflict: "employee_id,date" })
                .select("*, employees(id, full_name, employee_code)");
            if (error) return apiError(error.message);
            return apiSuccess(data, `${rows.length} attendance records saved.`, undefined, 201);
        }

        // Single record
        const { employee_id, date, check_in, check_out, shift_id, status, notes, overtime_mins } = body;
        if (!employee_id) return apiError("employee_id is required.");
        if (!date) return apiError("date is required.");
        if (!status) return apiError("status is required.");

        // Validate check_in < check_out
        if (check_in && check_out && new Date(check_out) <= new Date(check_in)) {
            return apiError("check_out must be after check_in.", [], 422);
        }

        // Verify employee exists
        const { data: emp } = await supabase.from("employees").select("id").eq("id", employee_id).single();
        if (!emp) return apiError("Employee not found.", [], 404);

        const { data, error } = await supabase
            .from("attendance")
            .upsert({
                employee_id,
                date,
                check_in: check_in || null,
                check_out: check_out || null,
                shift_id: shift_id || null,
                status,
                overtime_mins: overtime_mins || 0,
                notes: notes || null,
            }, { onConflict: "employee_id,date" })
            .select("*, employees(id, full_name, employee_code), shifts(id, name)")
            .single();

        if (error) return apiError(error.message);
        return apiSuccess(data, "Attendance record saved.", undefined, 201);
    } catch (err) {
        return apiServerError(err);
    }
}