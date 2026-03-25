import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError } from "@/lib/utils/api-response";

// GET /api/hr/attendance/summary?month=2026-03&department_id=...
export async function GET(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(req.url);

        // Default: current month
        const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
        const department_id = searchParams.get("department_id");

        const [year, mon] = month.split("-").map(Number);
        const dateFrom = `${month}-01`;
        const dateTo = new Date(year, mon, 0).toISOString().split("T")[0]; // last day of month

        // Get all active employees (optionally filtered by dept)
        let empQuery = supabase
            .from("employees")
            .select("id, full_name, employee_code, photo_url, department_id, departments(name)")
            .eq("status", "active");
        if (department_id) empQuery = empQuery.eq("department_id", department_id);
        const { data: employees } = await empQuery;

        if (!employees?.length) return apiSuccess([], "No employees found.");

        const empIds = employees.map((e: any) => e.id);

        // Fetch attendance for the month for these employees
        const { data: records } = await supabase
            .from("attendance")
            .select("employee_id, date, status, work_minutes, overtime_mins")
            .in("employee_id", empIds)
            .gte("date", dateFrom)
            .lte("date", dateTo);

        // Build working days in month (Mon–Fri)
        const workingDays: string[] = [];
        const cur = new Date(dateFrom);
        const end = new Date(dateTo);
        while (cur <= end) {
            const dow = cur.getDay();
            if (dow !== 0 && dow !== 6) workingDays.push(cur.toISOString().split("T")[0]);
            cur.setDate(cur.getDate() + 1);
        }
        const totalWorkingDays = workingDays.length;

        // Aggregate per employee
        const summary = employees.map((emp: any) => {
            const empRecords = (records || []).filter((r: any) => r.employee_id === emp.id);
            const byStatus = (s: string) => empRecords.filter((r: any) => r.status === s).length;

            const present = byStatus("present") + byStatus("late");
            const absent = byStatus("absent");
            const late = byStatus("late");
            const half_day = byStatus("half_day");
            const on_leave = byStatus("on_leave");
            const total_work_mins = empRecords.reduce((s: number, r: any) => s + (r.work_minutes || 0), 0);
            const total_overtime = empRecords.reduce((s: number, r: any) => s + (r.overtime_mins || 0), 0);
            const attendance_pct = totalWorkingDays > 0
                ? Math.round(((present + half_day * 0.5) / totalWorkingDays) * 100)
                : 0;

            return {
                employee_id: emp.id,
                employee_code: emp.employee_code,
                full_name: emp.full_name,
                photo_url: emp.photo_url,
                department: emp.departments?.name || "—",
                present,
                absent,
                late,
                half_day,
                on_leave,
                working_days: totalWorkingDays,
                total_work_hours: Math.round(total_work_mins / 60 * 10) / 10,
                total_overtime_hrs: Math.round(total_overtime / 60 * 10) / 10,
                attendance_pct,
            };
        });

        // Overall stats
        const overall = {
            month,
            working_days: totalWorkingDays,
            total_employees: employees.length,
            avg_attendance_pct: summary.length
                ? Math.round(summary.reduce((s: number, e: any) => s + e.attendance_pct, 0) / summary.length)
                : 0,
        };

        return apiSuccess({ summary, overall }, "Attendance summary retrieved.");
    } catch (err) {
        return apiServerError(err);
    }
}