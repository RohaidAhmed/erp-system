/**
 * lib/utils/email.ts
 * 
 * Email notification utility using Nodemailer (SMTP).
 * 
 * Env vars required:
 *   SMTP_HOST     e.g. smtp.gmail.com
 *   SMTP_PORT     e.g. 587
 *   SMTP_SECURE   "true" for port 465, "false" for others
 *   SMTP_USER     your email address
 *   SMTP_PASS     your email password / app password
 *   SMTP_FROM     display name + address e.g. "ERP System <erp@company.com>"
 *   NEXT_PUBLIC_APP_URL  e.g. https://erp.company.com (used for links in emails)
 */

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false }, // allow self-signed certs on LAN
});

const FROM = process.env.SMTP_FROM || `"ERP System" <${process.env.SMTP_USER}>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotifyPayload {
    to: string[];           // deduplicated list of recipient emails
    subject: string;
    employeeName: string;
    employeeCode: string;
    actionType: "attendance_edit" | "leave_request" | "leave_edit";
    changedBy: string;             // name of person who made the change
    details: Record<string, string>; // key-value pairs shown in email body
    linkPath: string;             // e.g. "/hr/attendance" or "/hr/leave"
}

// ── Email templates ──────────────────────────────────────────────────────────

function emailHtml(payload: NotifyPayload): string {
    const ACTION_LABELS: Record<string, string> = {
        attendance_edit: "Attendance Record Edited",
        leave_request: "New Leave Request Submitted",
        leave_edit: "Leave Request Edited",
    };

    const ACTION_COLORS: Record<string, string> = {
        attendance_edit: "#2563eb",  // blue
        leave_request: "#7c3aed",  // purple
        leave_edit: "#d97706",  // amber
    };

    const label = ACTION_LABELS[payload.actionType] || "HR Notification";
    const color = ACTION_COLORS[payload.actionType] || "#1e293b";
    const link = `${APP_URL}${payload.linkPath}`;

    const rows = Object.entries(payload.details)
        .map(([k, v]) => `
      <tr>
        <td style="padding:6px 12px;font-weight:600;color:#64748b;white-space:nowrap;width:140px;">${k}</td>
        <td style="padding:6px 12px;color:#1e293b;">${v || "—"}</td>
      </tr>`)
        .join("");

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:${color};padding:24px 32px;">
            <p style="margin:0;font-size:11px;font-weight:600;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">HR Notification</p>
            <h1 style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${label}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
              <strong style="color:#1e293b;">${payload.changedBy}</strong> has made a change for employee
              <strong style="color:#1e293b;">${payload.employeeName}</strong> (${payload.employeeCode}).
              Please review the details below.
            </p>
            <!-- Details table -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;overflow:hidden;">
              ${rows}
            </table>
            <!-- CTA -->
            <div style="margin-top:24px;">
              <a href="${link}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;
                font-size:13px;font-weight:600;padding:10px 22px;border-radius:8px;">
                View in ERP →
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              This is an automated notification from your ERP system. Do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Send function ────────────────────────────────────────────────────────────

export async function sendNotification(payload: NotifyPayload): Promise<void> {
    const to = [...new Set(payload.to.filter(Boolean))]; // deduplicate, remove empty
    if (!to.length) return;

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        console.warn("[email] SMTP not configured — skipping notification to:", to);
        return;
    }

    try {
        await transporter.sendMail({
            from: FROM,
            to: to.join(", "),
            subject: payload.subject,
            html: emailHtml(payload),
        });
        console.log(`[email] Sent "${payload.subject}" → ${to.join(", ")}`);
    } catch (err) {
        // Log but don't throw — email failure should not block the main action
        console.error("[email] Failed to send notification:", err);
    }
}

// ── Convenience builders ─────────────────────────────────────────────────────

export function buildAttendanceNotification(
    employee: { full_name: string; employee_code: string },
    changedBy: string,
    date: string,
    changes: Record<string, string>,
    recipients: string[]
): NotifyPayload {
    return {
        to: recipients,
        subject: `Attendance Edited: ${employee.full_name} — ${date}`,
        employeeName: employee.full_name,
        employeeCode: employee.employee_code,
        actionType: "attendance_edit",
        changedBy,
        details: {
            "Date": date,
            ...changes,
        },
        linkPath: "/hr/attendance",
    };
}

export function buildLeaveNotification(
    employee: { full_name: string; employee_code: string },
    changedBy: string,
    actionType: "leave_request" | "leave_edit",
    leaveDetails: Record<string, string>,
    recipients: string[]
): NotifyPayload {
    const subject = actionType === "leave_request"
        ? `Leave Request: ${employee.full_name} (${leaveDetails["Type"] || ""} · ${leaveDetails["Dates"] || ""})`
        : `Leave Request Edited: ${employee.full_name}`;

    return {
        to: recipients,
        subject,
        employeeName: employee.full_name,
        employeeCode: employee.employee_code,
        actionType,
        changedBy,
        details: leaveDetails,
        linkPath: "/hr/leave",
    };
}