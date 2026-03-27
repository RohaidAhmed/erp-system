import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { apiSuccess, apiError, apiServerError, getPagination, buildPagination } from "@/lib/utils/api-response";

async function getCallerInfo(supabase: ReturnType<typeof createServerClient>) {
    const ssr = createSupabaseServerClient();
    const { data: { session } } = await ssr.auth.getSession();
    if (!session) return { role: null, employeeId: null };
    const [{ data: userRow }, { data: empRow }] = await Promise.all([
        supabase.from("users").select("role").eq("id", session.user.id).single(),
        supabase.from("employees").select("id").eq("email", session.user.email!).maybeSingle(),
    ]);
    return { role: userRow?.role || null, employeeId: empRow?.id || null };
}

const MANAGER_ROLES = ["super_admin", "hr_manager"];

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
        const source = searchParams.get("source");

        const { role, employeeId: callerId } = await getCallerInfo(supabase);
        const isManager = role && MANAGER_ROLES.includes(role);

        // Non-managers only see their own records
        const effectiveEmpId = isManager ? (employee_id || null) : (callerId || null);
        if (!effectiveEmpId && !isManager) return apiError("Not authenticated.", [], 401);

        let query = supabase
            .from("attendance")
            .select(`*, employees(id, full_name, employee_code, photo_url, departments(id, name)), shifts(id, name, start_time, end_time)`, { count: "exact" })
            .order("date", { ascending: false })
            .range(from, to);

        if (effectiveEmpId) query = query.eq("employee_id", effectiveEmpId);
        if (date_from) query = query.gte("date", date_from);
        if (date_to) query = query.lte("date", date_to);
        if (source) query = query.eq("source", source);

        if (isManager && department_id) {
            const { data: empIds } = await supabase.from("employees").select("id").eq("department_id", department_id);
            const ids = (empIds || []).map((e: any) => e.id);
            if (!ids.length) return apiSuccess([], "No employees.", buildPagination(page, pageSize, 0));
            query = query.in("employee_id", ids);
        }

        const { data, error, count } = await query;
        if (error) return apiError(error.message);
        return apiSuccess(data, "Attendance retrieved.", buildPagination(page, pageSize, count ?? 0));
    } catch (err) { return apiServerError(err); }
}

// POST /api/hr/attendance
export async function POST(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const body = await req.json();
        const { role, employeeId: callerId } = await getCallerInfo(supabase);
        const isManager = role && MANAGER_ROLES.includes(role);

        // Bulk (manager only)
        if (body.bulk && Array.isArray(body.records)) {
            if (!isManager) return apiError("Manager access required for bulk entry.", [], 403);
            if (!body.date) return apiError("date is required.");
            const rows = body.records.map((r: any) => ({
                employee_id: r.employee_id, date: body.date, source: "manual",
                check_in: r.check_in || null,
                check_out: r.check_out || null,
                shift_id: r.shift_id || null,
                is_absent: !!r.is_absent,
                is_missing_out: !!r.is_missing_out,
                is_half_day: !!r.is_half_day,
                is_late: !!r.is_late,
                is_extra_day: !!r.is_extra_day,
                is_on_leave: !!r.is_on_leave,
                work_minutes: r.work_minutes || 0,
                overtime_mins: r.overtime_mins || 0,
                notes: r.notes || null,
            }));
            const { data, error } = await supabase.from("attendance").upsert(rows, { onConflict: "employee_id,date" }).select("id, employee_id, date");
            if (error) return apiError(error.message);
            return apiSuccess(data, `${rows.length} records saved.`, undefined, 201);
        }

        // Single record
        const { employee_id, date, check_in, check_out, shift_id,
            is_absent, is_missing_out, is_half_day, is_late,
            is_extra_day, is_on_leave, overtime_mins, notes } = body;
        if (!employee_id) return apiError("employee_id is required.");
        if (!date) return apiError("date is required.");
        if (!isManager && callerId !== employee_id) return apiError("You can only update your own attendance.", [], 403);
        if (check_in && check_out && new Date(check_out) <= new Date(check_in)) return apiError("check_out must be after check_in.", [], 422);

        const work_minutes = (check_in && check_out)
            ? Math.max(0, Math.floor((new Date(check_out).getTime() - new Date(check_in).getTime()) / 60000))
            : 0;

        const { data, error } = await supabase.from("attendance")
            .upsert({
                employee_id, date, source: "manual",
                check_in: check_in || null, check_out: check_out || null, shift_id: shift_id || null,
                is_absent: !!is_absent, is_missing_out: !!is_missing_out, is_half_day: !!is_half_day,
                is_late: !!is_late, is_extra_day: !!is_extra_day, is_on_leave: !!is_on_leave,
                work_minutes, overtime_mins: overtime_mins || 0, notes: notes || null,
            }, { onConflict: "employee_id,date" })
            .select("*, employees(id, full_name, employee_code), shifts(id, name)")
            .single();

        if (error) return apiError(error.message);
        return apiSuccess(data, "Record saved.", undefined, 201);
    } catch (err) { return apiServerError(err); }
}