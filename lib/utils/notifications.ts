/**
 * lib/utils/notifications.ts
 *
 * Helper that builds the recipient list for an employee action:
 *   1. Employee's direct manager (from employees.manager_id)
 *   2. All HR managers and super_admins (always notified)
 *   3. If no manager → HR is also the "approver" (already included in step 2)
 *
 * Uses service-role client so it can always read user emails.
 */

import { createServerClient } from "@/lib/supabase/server";
import { sendNotification, buildAttendanceNotification, buildLeaveNotification } from "./email";

// ── Recipient resolution ──────────────────────────────────────────────────────

interface EmployeeInfo {
    id: string;
    full_name: string;
    employee_code: string;
    email: string;
    manager_id: string | null;
}

/**
 * Returns the email addresses that should be notified for an employee action.
 * Always includes HR managers + super_admins.
 * Also includes the direct manager if one exists.
 */
export async function resolveRecipients(
    supabase: ReturnType<typeof createServerClient>,
    employee: EmployeeInfo
): Promise<string[]> {
    const emails: string[] = [];

    // 1. Direct manager's email (if employee has a manager)
    if (employee.manager_id) {
        const { data: mgr } = await supabase
            .from("employees")
            .select("email")
            .eq("id", employee.manager_id)
            .single();
        if (mgr?.email) emails.push(mgr.email);
    }

    // 2. All HR managers and super_admins from public.users
    //    (these are the ERP system users with those roles)
    const { data: hrUsers } = await supabase
        .from("users")
        .select("email")
        .in("role", ["hr_manager", "super_admin"])
        .eq("is_active", true);

    (hrUsers || []).forEach((u: any) => {
        if (u.email) emails.push(u.email);
    });

    // Deduplicate + remove the employee's own email
    return [...new Set(emails)].filter((e) => e && e !== employee.email);
}

// ── Attendance notification ───────────────────────────────────────────────────

export async function notifyAttendanceEdit(
    supabase: ReturnType<typeof createServerClient>,
    employee: EmployeeInfo,
    changedByName: string,
    date: string,
    changes: Record<string, string>
): Promise<void> {
    const recipients = await resolveRecipients(supabase, employee);
    const payload = buildAttendanceNotification(employee, changedByName, date, changes, recipients);
    await sendNotification(payload);
}

// ── Leave notification ────────────────────────────────────────────────────────

export async function notifyLeaveAction(
    supabase: ReturnType<typeof createServerClient>,
    employee: EmployeeInfo,
    changedByName: string,
    actionType: "leave_request" | "leave_edit",
    leaveDetails: Record<string, string>
): Promise<void> {
    const recipients = await resolveRecipients(supabase, employee);
    const payload = buildLeaveNotification(employee, changedByName, actionType, leaveDetails, recipients);
    await sendNotification(payload);
}