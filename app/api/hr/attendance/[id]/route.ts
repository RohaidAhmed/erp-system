import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";

// GET /api/hr/attendance/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const { data, error } = await supabase
            .from("attendance")
            .select("*, employees(id, full_name, employee_code, photo_url, departments(name)), shifts(id, name, start_time, end_time)")
            .eq("id", params.id)
            .single();
        if (error || !data) return apiNotFound("Attendance record");
        return apiSuccess(data, "Record retrieved.");
    } catch (err) {
        return apiServerError(err);
    }
}

// PUT /api/hr/attendance/[id] — update a record
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const body = await req.json();
        const { check_in, check_out, shift_id, status, notes, overtime_mins } = body;

        const { data: existing } = await supabase.from("attendance").select("id").eq("id", params.id).single();
        if (!existing) return apiNotFound("Attendance record");

        if (!status) return apiError("status is required.");
        if (check_in && check_out && new Date(check_out) <= new Date(check_in)) {
            return apiError("check_out must be after check_in.", [], 422);
        }

        const { data, error } = await supabase
            .from("attendance")
            .update({
                check_in: check_in ?? null,
                check_out: check_out ?? null,
                shift_id: shift_id ?? null,
                status,
                overtime_mins: overtime_mins ?? 0,
                notes: notes ?? null,
            })
            .eq("id", params.id)
            .select("*, employees(id, full_name, employee_code), shifts(id, name)")
            .single();

        if (error) return apiError(error.message);
        return apiSuccess(data, "Attendance record updated.");
    } catch (err) {
        return apiServerError(err);
    }
}

// DELETE /api/hr/attendance/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const supabase = createServerClient();
        const { error } = await supabase.from("attendance").delete().eq("id", params.id);
        if (error) return apiError(error.message);
        return apiSuccess(null, "Attendance record deleted.");
    } catch (err) {
        return apiServerError(err);
    }
}