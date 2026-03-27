import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";

async function getCallerInfo(supabase: ReturnType<typeof createServerClient>) {
    const ssr = createSupabaseServerClient();
    const { data: { session } } = await ssr.auth.getSession();
    if (!session) return { role: null, employeeId: null };
    const [{ data: u }, { data: e }] = await Promise.all([
        supabase.from("users").select("role").eq("id", session.user.id).single(),
        supabase.from("employees").select("id").eq("email", session.user.email!).maybeSingle(),
    ]);
    return { role: u?.role || null, employeeId: e?.id || null };
}

const MGR = ["super_admin", "hr_manager"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = createServerClient();
        const { role, employeeId } = await getCallerInfo(db);
        const { data, error } = await db
            .from("attendance")
            .select("*, employees(id, full_name, employee_code, photo_url, departments(name)), shifts(*)")
            .eq("id", params.id).single();
        if (error || !data) return apiNotFound("Attendance record");
        if (!MGR.includes(role!) && (data as any).employee_id !== employeeId) return apiError("Access denied.", [], 403);
        return apiSuccess(data, "Record retrieved.");
    } catch (err) { return apiServerError(err); }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = createServerClient();
        const { role, employeeId } = await getCallerInfo(db);
        const isManager = MGR.includes(role!);

        const { data: existing } = await db.from("attendance").select("id, employee_id, work_minutes, check_in, check_out").eq("id", params.id).single();
        if (!existing) return apiNotFound("Attendance record");
        if (!isManager && (existing as any).employee_id !== employeeId) return apiError("Access denied.", [], 403);

        const body = await req.json();
        const { check_in, check_out } = body;
        if (check_in && check_out && new Date(check_out) <= new Date(check_in)) return apiError("check_out must be after check_in.", [], 422);

        const ci = check_in ?? (existing as any).check_in;
        const co = check_out ?? (existing as any).check_out;
        const work_minutes = (ci && co)
            ? Math.max(0, Math.floor((new Date(co).getTime() - new Date(ci).getTime()) / 60000))
            : (existing as any).work_minutes || 0;

        const update: Record<string, any> = { check_in: ci || null, check_out: co || null, work_minutes, notes: body.notes ?? null };

        if (isManager) {
            // Managers can edit all flags + shift + overtime
            Object.assign(update, {
                shift_id: body.shift_id ?? null,
                is_absent: !!body.is_absent,
                is_missing_out: !!body.is_missing_out,
                is_half_day: !!body.is_half_day,
                is_late: !!body.is_late,
                is_extra_day: !!body.is_extra_day,
                is_on_leave: !!body.is_on_leave,
                overtime_mins: body.overtime_mins ?? 0,
            });
        } else {
            // Employees can only edit: check_in, check_out, is_extra_day, notes
            Object.assign(update, { is_extra_day: !!body.is_extra_day, source: "manual" });
        }

        const { data, error } = await db.from("attendance").update(update).eq("id", params.id)
            .select("*, employees(id, full_name, employee_code), shifts(id, name)").single();
        if (error) return apiError(error.message);
        return apiSuccess(data, "Record updated.");
    } catch (err) { return apiServerError(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = createServerClient();
        const { role } = await getCallerInfo(db);
        if (!MGR.includes(role!)) return apiError("Manager access required.", [], 403);
        const { error } = await db.from("attendance").delete().eq("id", params.id);
        if (error) return apiError(error.message);
        return apiSuccess(null, "Record deleted.");
    } catch (err) { return apiServerError(err); }
}