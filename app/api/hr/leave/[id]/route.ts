/**
 * app/api/hr/leave/[id]/route.ts
 *
 * GET    — view single request (own for employees, any for HR)
 * PUT    — edit pending request (employee: only own + only if pending)
 * PATCH  — status transition (HR only: approve/reject/cancel)
 * DELETE — not allowed
 *
 * Email notifications fire on PUT (employee edits) and PATCH (HR approves/rejects).
 */

import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";
import type { LeaveStatus } from "@/types";
import { notifyLeaveAction } from "@/lib/utils/notifications";

const HR_ROLES = ["super_admin", "hr_manager"];

const TRANSITIONS: Record<LeaveStatus, LeaveStatus[]> = {
    pending: ["approved", "rejected", "cancelled"],
    approved: ["cancelled"],
    rejected: [],
    cancelled: [],
};

async function getCallerInfo(db: ReturnType<typeof createServerClient>) {
    const ssr = createSupabaseServerClient();
    const { data: { session } } = await ssr.auth.getSession();
    if (!session) return { role: null, userId: null, employeeId: null, fullName: null };
    const [{ data: u }, { data: e }] = await Promise.all([
        db.from("users").select("role, full_name").eq("id", session.user.id).single(),
        db.from("employees").select("id").eq("email", session.user.email!).maybeSingle(),
    ]);
    return {
        role: u?.role || null,
        userId: session.user.id,
        employeeId: e?.id || null,
        fullName: u?.full_name || session.user.email || "Unknown",
    };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = createServerClient();
        const { role, employeeId } = await getCallerInfo(db);
        if (!role) return apiError("Not authenticated.", [], 401);

        const { data, error } = await db
            .from("leave_requests")
            .select("*, employees(id, full_name, employee_code, photo_url, department_id, departments(name))")
            .eq("id", params.id).single();
        if (error || !data) return apiNotFound("Leave request");

        // Employees can only view their own
        if (!HR_ROLES.includes(role) && (data as any).employee_id !== employeeId) {
            return apiError("Access denied.", [], 403);
        }
        return apiSuccess(data, "Leave request retrieved.");
    } catch (err) { return apiServerError(err); }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = createServerClient();
        const { role, employeeId, fullName } = await getCallerInfo(db);
        if (!role) return apiError("Not authenticated.", [], 401);

        const isHR = HR_ROLES.includes(role);

        const { data: existing } = await db
            .from("leave_requests")
            .select("id, status, employee_id, leave_type, start_date, end_date")
            .eq("id", params.id).single();
        if (!existing) return apiNotFound("Leave request");

        // Employees can only edit their own
        if (!isHR && (existing as any).employee_id !== employeeId) {
            return apiError("Access denied.", [], 403);
        }

        // Can only edit PENDING requests
        if ((existing as any).status !== "pending") {
            return apiError(
                `Leave request is '${(existing as any).status}' — only pending requests can be edited.`,
                [], 409
            );
        }

        const body = await req.json();
        const { leave_type, start_date, end_date, reason } = body;
        if (!leave_type) return apiError("leave_type is required.");
        if (!start_date) return apiError("start_date is required.");
        if (!end_date) return apiError("end_date is required.");
        if (!reason?.trim()) return apiError("Reason is required.");
        if (end_date < start_date) return apiError("end_date must be on or after start_date.", [], 422);

        const days_count = Math.ceil(
            (new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

        const { data, error } = await db
            .from("leave_requests")
            .update({ leave_type, start_date, end_date, days_count, reason: reason.trim() })
            .eq("id", params.id)
            .select("*, employees(id, full_name, employee_code, email, manager_id)")
            .single();
        if (error) return apiError(error.message);

        // ── Notify on edit ────────────────────────────────────────────────────
        const emp = (data as any).employees;
        // if (emp) {
        //     notifyLeaveAction(db, emp, fullName!, "leave_edit", {
        //         "Leave Type": leave_type.replace("_", " "),
        //         "New Dates": `${start_date} → ${end_date} (${days_count} day${days_count > 1 ? "s" : ""})`,
        //         "Reason": reason.trim(),
        //         "Changed From": `${(existing as any).leave_type} · ${(existing as any).start_date} → ${(existing as any).end_date}`,
        //     }).catch(console.error);
        // }

        return apiSuccess(data, "Leave request updated.");
    } catch (err) { return apiServerError(err); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = createServerClient();
        const { role, userId, fullName } = await getCallerInfo(db);
        if (!role) return apiError("Not authenticated.", [], 401);

        // Only HR can approve/reject/change status
        if (!HR_ROLES.includes(role)) {
            return apiError("HR Manager access required to change leave status.", [], 403);
        }

        const body = await req.json();
        const targetStatus = body.status as LeaveStatus;
        if (!targetStatus) return apiError("'status' is required.");

        const { data: existing } = await db
            .from("leave_requests")
            .select("id, status, employee_id")
            .eq("id", params.id).single();
        if (!existing) return apiNotFound("Leave request");

        const allowed = TRANSITIONS[(existing as any).status as LeaveStatus] ?? [];
        if (!allowed.includes(targetStatus)) {
            return apiError(
                `Cannot change status from '${(existing as any).status}' to '${targetStatus}'. ` +
                `Allowed: ${allowed.length ? allowed.join(", ") : "none"}.`,
                [], 409
            );
        }

        const updatePayload: Record<string, unknown> = { status: targetStatus };
        if (targetStatus === "approved") {
            updatePayload.approved_by = userId;
            updatePayload.approved_at = new Date().toISOString();
        }

        const { data, error } = await db
            .from("leave_requests")
            .update(updatePayload)
            .eq("id", params.id)
            .select("*, employees(id, full_name, employee_code, email, manager_id, status)")
            .single();
        if (error) return apiError(error.message);

        // Update employee status on approval/cancellation
        const emp = (data as any).employees;
        if (targetStatus === "approved" && emp) {
            await db.from("employees").update({ status: "on_leave" }).eq("id", emp.id);
        }
        if (targetStatus === "cancelled" && (existing as any).status === "approved" && emp) {
            await db.from("employees").update({ status: "active" }).eq("id", emp.id);
        }

        const messages: Record<string, string> = {
            approved: "Leave request approved.",
            rejected: "Leave request rejected.",
            cancelled: "Leave request cancelled.",
        };
        return apiSuccess(data, messages[targetStatus] || "Status updated.");
    } catch (err) { return apiServerError(err); }
}