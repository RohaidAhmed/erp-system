import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(req.url);

        const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
        const department_id = searchParams.get("department_id");

        const [year, mon] = month.split("-").map(Number);
        const dateFrom = `${month}-01`;
        const dateTo = new Date(year, mon, 0).toISOString().split("T")[0];

        let empQuery = supabase
            .from("employees")
            .select("id, full_name, employee_code, photo_url, department_id, departments(name)")
            .eq("status", "active");
        if (department_id) empQuery = empQuery.eq("department_id", department_id);
        const { data: employees } = await empQuery;
        if (!employees?.length) return apiSuccess({ summary: [], overall: null }, "No employees.");

        const empIds = employees.map((e: any) => e.id);

        const { data: records } = await supabase
            .from("attendance")
            .select("employee_id, date, is_absent, is_half_day, is_late, is_extra_day, is_on_leave, is_missing_out, work_minutes, overtime_mins, check_in")
            .in("employee_id", empIds)
            .gte("date", dateFrom)
            .lte("date", dateTo);

        // Build working days (Mon–Fri)
        const workingDays: string[] = [];
        const cur = new Date(dateFrom), end = new Date(dateTo);
        while (cur <= end) {
            const dow = cur.getDay();
            if (dow !== 0 && dow !== 6) workingDays.push(cur.toISOString().split("T")[0]);
            cur.setDate(cur.getDate() + 1);
        }
        const totalWorkingDays = workingDays.length;

        const summary = employees.map((emp: any) => {
            const empRecs = (records || []).filter((r: any) => r.employee_id === emp.id);
            const cnt = (fn: (r: any) => boolean) => empRecs.filter(fn).length;

            const absent = cnt((r) => r.is_absent);
            const late = cnt((r) => r.is_late);
            const half_day = cnt((r) => r.is_half_day);
            const on_leave = cnt((r) => r.is_on_leave);
            const extra_days = cnt((r) => r.is_extra_day);
            // Present = has check_in and not absent/on_leave
            const present = cnt((r) => !!r.check_in && !r.is_absent && !r.is_on_leave);
            const total_work_mins = empRecs.reduce((s: number, r: any) => s + (r.work_minutes || 0), 0);
            const total_overtime = empRecs.reduce((s: number, r: any) => s + (r.overtime_mins || 0), 0);
            const attendance_pct = totalWorkingDays > 0
                ? Math.round(((present + half_day * 0.5) / totalWorkingDays) * 100) : 0;

            return {
                employee_id: emp.id,
                employee_code: emp.employee_code,
                full_name: emp.full_name,
                photo_url: emp.photo_url,
                department: emp.departments?.name || "—",
                present, absent, late, half_day, on_leave, extra_days,
                working_days: totalWorkingDays,
                total_work_hours: Math.round(total_work_mins / 60 * 10) / 10,
                total_overtime_hrs: Math.round(total_overtime / 60 * 10) / 10,
                attendance_pct,
            };
        });

        const overall = {
            month,
            working_days: totalWorkingDays,
            total_employees: employees.length,
            avg_attendance_pct: summary.length
                ? Math.round(summary.reduce((s: number, e: any) => s + e.attendance_pct, 0) / summary.length) : 0,
        };

        return apiSuccess({ summary, overall }, "Summary retrieved.");
    } catch (err) { return apiServerError(err); }
}