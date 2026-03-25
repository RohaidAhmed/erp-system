/**
 * POST /api/hr/attendance/sync
 *
 * Fetches attendance data from the physical machine at ATTENDANCE_MACHINE_URL
 * and upserts records into public.attendance.
 *
 * The machine's web interface returns an HTML table with columns:
 *   date | day | in_time | out_time | tot_time | absent | missing | halfday | late | extra_day | planned_leaves
 *
 * We parse that HTML, map to our schema, and upsert per (employee_id, date).
 *
 * Query params:
 *   ?employee_id=<uuid>   — sync a single employee (uses their machine_employee_id)
 *   ?date_from=YYYY-MM-DD — start date filter
 *   ?date_to=YYYY-MM-DD   — end date filter
 *   (no params = sync all employees for last 30 days)
 *
 * Environment variables:
 *   ATTENDANCE_MACHINE_URL  — e.g. http://192.168.10.116
 *   ATTENDANCE_MACHINE_USER — basic auth username (if required)
 *   ATTENDANCE_MACHINE_PASS — basic auth password (if required)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const MACHINE_URL = process.env.ATTENDANCE_MACHINE_URL || "http://192.168.10.116";
const MACHINE_USER = process.env.ATTENDANCE_MACHINE_USER || "";
const MACHINE_PASS = process.env.ATTENDANCE_MACHINE_PASS || "";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build auth header if credentials are configured */
function authHeader(): Record<string, string> {
    if (!MACHINE_USER) return {};
    const b64 = Buffer.from(`${MACHINE_USER}:${MACHINE_PASS}`).toString("base64");
    return { Authorization: `Basic ${b64}` };
}

/**
 * Parse "HH:MM:SS" or "HH:MM" into total minutes. Returns 0 if blank.
 */
function parseTimeToMins(t: string): number {
    if (!t || !t.trim()) return 0;
    const parts = t.trim().split(":").map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

/**
 * Combine a date string (YYYY-MM-DD) and a time string (HH:MM:SS) into
 * an ISO timestamp. Returns null if time is empty.
 */
function toTimestamp(date: string, time: string): string | null {
    if (!time || !time.trim()) return null;
    return `${date}T${time.trim()}`;
}

/** Read a cell value from an HTML table row, strip tags */
function cellText(cell: string): string {
    return cell.replace(/<[^>]*>/g, "").trim();
}

/**
 * Fetch the machine's HTML page for a given employee + date range,
 * and parse the table rows.
 *
 * The machine typically exposes:
 *   GET /   with query params: uid=<machine_id>&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Adjust MACHINE_PATH if your device uses a different endpoint.
 */
async function fetchMachineRecords(
    machineEmpId: string,
    dateFrom: string,
    dateTo: string
): Promise<MachineRow[]> {
    const MACHINE_PATH = process.env.ATTENDANCE_MACHINE_PATH || "/";

    const url = new URL(MACHINE_URL + MACHINE_PATH);
    url.searchParams.set("uid", machineEmpId);
    url.searchParams.set("from", dateFrom);
    url.searchParams.set("to", dateTo);

    const res = await fetch(url.toString(), {
        headers: { ...authHeader(), "Accept": "text/html" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
    });

    if (!res.ok) throw new Error(`Machine returned HTTP ${res.status}`);

    const html = await res.text();
    return parseMachineHtml(html);
}

interface MachineRow {
    date: string;       // YYYY-MM-DD
    in_time: string;       // HH:MM:SS or ""
    out_time: string;
    tot_time: string;
    is_absent: boolean;
    is_missing: boolean;
    is_half_day: boolean;
    is_late: boolean;
    is_extra_day: boolean;
    is_on_leave: boolean;
}

/**
 * Parse the machine's HTML table.
 * Columns (0-indexed): date | day | in_time | out_time | tot_time |
 *                      absent | missing | halfday | late | extra_day | planned_leaves
 */
function parseMachineHtml(html: string): MachineRow[] {
    const rows: MachineRow[] = [];

    // Extract table rows (skip header)
    const trMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    let rowIndex = 0;

    for (const match of trMatches) {
        rowIndex++;
        if (rowIndex === 1) continue; // skip header row

        const rowHtml = match[1];
        const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
            .map((m) => cellText(m[1]));

        if (cells.length < 6) continue;

        const dateRaw = cells[0];
        if (!dateRaw || !/^\d{4}-\d{2}-\d{2}/.test(dateRaw)) continue;

        const flag = (v: string) => v.toLowerCase() === "true" || v === "1" || v.toLowerCase() === "yes";

        rows.push({
            date: dateRaw.slice(0, 10),
            in_time: cells[2] || "",
            out_time: cells[3] || "",
            tot_time: cells[4] || "",
            is_absent: flag(cells[5] || ""),
            is_missing: flag(cells[6] || ""),
            is_half_day: flag(cells[7] || ""),
            is_late: flag(cells[8] || ""),
            is_extra_day: flag(cells[9] || ""),
            is_on_leave: flag(cells[10] || ""),
        });
    }

    return rows;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    const employeeId = searchParams.get("employee_id"); // optional
    const dateFrom = searchParams.get("date_from") || (() => {
        const d = new Date(); d.setDate(d.getDate() - 30);
        return d.toISOString().split("T")[0];
    })();
    const dateTo = searchParams.get("date_to") || new Date().toISOString().split("T")[0];

    const syncLog = {
        machine_ip: MACHINE_URL,
        records_found: 0,
        records_new: 0,
        records_updated: 0,
        status: "ok" as "ok" | "error",
        error_message: undefined as string | undefined,
    };

    try {
        // Load employees to sync
        let empQuery = supabase
            .from("employees")
            .select("id, full_name, employee_code, machine_employee_id")
            .eq("status", "active")
            .not("machine_employee_id", "is", null);

        if (employeeId) empQuery = empQuery.eq("id", employeeId);

        const { data: employees, error: empErr } = await empQuery;
        if (empErr) throw new Error(empErr.message);
        if (!employees?.length) {
            return NextResponse.json({
                success: true,
                message: "No employees with machine IDs configured.",
                data: syncLog,
            });
        }

        // Get existing attendance for conflict detection
        const { data: existing } = await supabase
            .from("attendance")
            .select("id, employee_id, date")
            .in("employee_id", employees.map((e: any) => e.id))
            .gte("date", dateFrom)
            .lte("date", dateTo);

        const existingSet = new Set(
            (existing || []).map((r: any) => `${r.employee_id}::${r.date}`)
        );

        // Fetch from machine and build upsert rows
        const upsertRows: any[] = [];

        for (const emp of employees) {
            const machineId = (emp as any).machine_employee_id;
            if (!machineId) continue;

            let rows: MachineRow[];
            try {
                rows = await fetchMachineRecords(machineId, dateFrom, dateTo);
            } catch (fetchErr: any) {
                console.error(`Failed to fetch for ${emp.employee_code}:`, fetchErr.message);
                continue;
            }

            syncLog.records_found += rows.length;

            for (const row of rows) {
                const key = `${emp.id}::${row.date}`;
                const isUpdate = existingSet.has(key);
                if (isUpdate) syncLog.records_updated++;
                else syncLog.records_new++;

                const workMins = parseTimeToMins(row.tot_time);

                upsertRows.push({
                    employee_id: emp.id,
                    date: row.date,
                    check_in: toTimestamp(row.date, row.in_time),
                    check_out: toTimestamp(row.date, row.out_time),
                    is_absent: row.is_absent,
                    is_missing_out: row.is_missing,
                    is_half_day: row.is_half_day,
                    is_late: row.is_late,
                    is_extra_day: row.is_extra_day,
                    is_on_leave: row.is_on_leave,
                    work_minutes: workMins,
                    source: "machine",
                });
            }
        }

        // Upsert in batches of 100
        const BATCH = 100;
        for (let i = 0; i < upsertRows.length; i += BATCH) {
            const batch = upsertRows.slice(i, i + BATCH);
            const { error: upsertErr } = await supabase
                .from("attendance")
                .upsert(batch, {
                    onConflict: "employee_id,date",
                    ignoreDuplicates: false,
                });
            if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`);
        }

        // Save sync log
        await supabase.from("attendance_sync_log").insert(syncLog);

        return NextResponse.json({
            success: true,
            message: `Sync complete. ${syncLog.records_new} new, ${syncLog.records_updated} updated.`,
            data: syncLog,
        });
    } catch (err: any) {
        syncLog.status = "error";
        syncLog.error_message = err.message;
        const { error } = await supabase.from("attendance_sync_log").insert(syncLog);

        if (error) {
            console.error("Failed to insert sync log:", error.message);
        }

        return NextResponse.json(
            { success: false, message: err.message, data: syncLog },
            { status: 500 }
        );
    }
}

/**
 * GET /api/hr/attendance/sync — return last sync logs
 */
export async function GET(_req: NextRequest) {
    const supabase = createServerClient();
    const { data } = await supabase
        .from("attendance_sync_log")
        .select("*")
        .order("synced_at", { ascending: false })
        .limit(20);
    return NextResponse.json({ success: true, data: data || [] });
}
