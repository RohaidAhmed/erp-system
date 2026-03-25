/**
 * POST /api/hr/attendance/sync
 *
 * Calls the local Python Anviz bridge (anviz_bridge.py) running on the
 * same server at localhost:7070 — which speaks the binary EP300 protocol.
 *
 * The bridge returns:
 *   { success, count, data: [{ code, datetime, date, time, type, ... }] }
 *   type = 0 → check-in   type = 1 → check-out
 *
 * Records are grouped by (employee, date), matched via
 *   employees.machine_employee_id = record.code
 * and upserted into public.attendance.
 *
 * Env:
 *   ANVIZ_BRIDGE_URL   default: http://127.0.0.1:7070
 *
 * GET /api/hr/attendance/sync  — last 20 sync logs
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const BRIDGE = process.env.ANVIZ_BRIDGE_URL || "http://127.0.0.1:7070";

export async function GET() {
    const db = createServerClient();
    const { data } = await db
        .from("attendance_sync_log")
        .select("*")
        .order("synced_at", { ascending: false })
        .limit(20);
    return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(req: NextRequest) {
    const db = createServerClient();
    const { searchParams } = new URL(req.url);

    const employeeId = searchParams.get("employee_id");
    const dateFrom = searchParams.get("date_from") || (() => {
        const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0];
    })();
    const dateTo = searchParams.get("date_to") || new Date().toISOString().split("T")[0];

    const log: any = {
        machine_ip: BRIDGE, records_found: 0,
        records_new: 0, records_updated: 0,
        status: "ok", error_message: undefined,
    };

    try {
        // ── 1. Call bridge ────────────────────────────────────────────────────
        let res: Response;
        try {
            res = await fetch(`${BRIDGE}/records?from=${dateFrom}&to=${dateTo}`, {
                signal: AbortSignal.timeout(60_000), cache: "no-store",
            });
        } catch (e: any) {
            throw new Error(
                `Cannot reach Anviz bridge at ${BRIDGE}. ` +
                `Is anviz_bridge.py running on this server? Error: ${e.message}`
            );
        }

        if (!res.ok) throw new Error(`Bridge HTTP ${res.status}: ${await res.text()}`);
        const bridgeJson = await res.json();
        if (!bridgeJson.success) throw new Error(`Bridge: ${bridgeJson.error || "unknown error"}`);

        const rawRecords: Array<{
            code: number; datetime: string; date: string; time: string; type: number;
        }> = bridgeJson.data || [];
        log.records_found = rawRecords.length;

        if (rawRecords.length === 0) {
            await db.from("attendance_sync_log").insert(log);
            return NextResponse.json({ success: true, message: "No records in range.", data: log });
        }

        // ── 2. Load employees with machine IDs ────────────────────────────────
        let eq = db.from("employees")
            .select("id, machine_employee_id, employee_code")
            .eq("status", "active")
            .not("machine_employee_id", "is", null);
        if (employeeId) eq = eq.eq("id", employeeId);
        const { data: emps } = await eq;

        if (!emps?.length) {
            throw new Error(
                "No employees have a Machine ID set. " +
                "Edit each employee in HR → Employees and fill in the Machine ID field."
            );
        }

        // machine_code (string) → employee UUID
        const codeMap: Record<string, string> = {};
        for (const e of emps) codeMap[String((e as any).machine_employee_id)] = e.id;

        // ── 3. Group: earliest check-in + latest check-out per (emp, date) ───
        const grouped: Record<string, { check_in: string | null; check_out: string | null }> = {};

        for (const r of rawRecords) {
            const empId = codeMap[String(r.code)];
            if (!empId) continue;
            const k = `${empId}::${r.date}`;
            if (!grouped[k]) grouped[k] = { check_in: null, check_out: null };
            const ts = r.datetime; // "YYYY-MM-DD HH:MM:SS"
            if (r.type === 0) {   // check-in  → keep earliest
                if (!grouped[k].check_in || ts < grouped[k].check_in!) grouped[k].check_in = ts;
            } else {               // check-out → keep latest
                if (!grouped[k].check_out || ts > grouped[k].check_out!) grouped[k].check_out = ts;
            }
        }

        // ── 4. Detect existing rows ───────────────────────────────────────────
        const empIds = [...new Set(Object.keys(grouped).map((k) => k.split("::")[0]))];
        const { data: existing } = await db.from("attendance")
            .select("employee_id, date").in("employee_id", empIds)
            .gte("date", dateFrom).lte("date", dateTo);
        const existingSet = new Set((existing || []).map((r: any) => `${r.employee_id}::${r.date}`));

        // ── 5. Build upsert rows ──────────────────────────────────────────────
        // Late threshold from your config.txt: 09:45:00
        // Half-day: work > 4h and < 6h  (config: tt>4*3600 and tt<6*3600)
        const LATE_THRESHOLD = "09:45:00";

        const rows: any[] = [];
        for (const [key, times] of Object.entries(grouped)) {
            const [empId, date] = key.split("::");
            if (existingSet.has(key)) log.records_updated++; else log.records_new++;

            let workMins = 0;
            if (times.check_in && times.check_out) {
                const ci = new Date(times.check_in.replace(" ", "T")).getTime();
                const co = new Date(times.check_out.replace(" ", "T")).getTime();
                workMins = Math.max(0, Math.floor((co - ci) / 60000));
            }

            const ciTime = times.check_in ? times.check_in.slice(11) : null; // "HH:MM:SS"
            const isAbsent = !times.check_in && !times.check_out;
            const isMissing = !isAbsent && (!times.check_in || !times.check_out);
            const isLate = !isAbsent && !!ciTime && ciTime > LATE_THRESHOLD;
            const isHalfDay = workMins > 240 && workMins < 360;
            const dow = new Date(date + "T12:00:00").getDay(); // 0=Sun, 6=Sat
            const isExtraDay = (dow === 0 || dow === 6) && !isAbsent;

            rows.push({
                employee_id: empId,
                date,
                check_in: times.check_in ? times.check_in.replace(" ", "T") : null,
                check_out: times.check_out ? times.check_out.replace(" ", "T") : null,
                is_absent: isAbsent,
                is_missing_out: isMissing,
                is_half_day: isHalfDay,
                is_late: isLate && !isExtraDay,
                is_extra_day: isExtraDay,
                is_on_leave: false,
                work_minutes: workMins,
                source: "machine",
            });
        }

        // ── 6. Upsert in batches ──────────────────────────────────────────────
        for (let i = 0; i < rows.length; i += 50) {
            const { error } = await db.from("attendance")
                .upsert(rows.slice(i, i + 50), { onConflict: "employee_id,date", ignoreDuplicates: false });
            if (error) throw new Error(`DB upsert: ${error.message}`);
        }

        await db.from("attendance_sync_log").insert(log);
        return NextResponse.json({
            success: true,
            message: `Sync complete — ${log.records_new} new, ${log.records_updated} updated.`,
            data: log,
        });

    } catch (err: any) {
        log.status = "error"; log.error_message = err.message;
        const {error} = await db.from("attendance_sync_log").insert(log);
        if (error){
            console.log(error.message);
        }
        return NextResponse.json({ success: false, message: err.message, data: log }, { status: 500 });
    }
}