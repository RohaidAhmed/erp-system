"use client";

import { useEffect, useState, useCallback } from "react";
import {
    RefreshCw, Plus, Search, Clock, BarChart3,
    ChevronLeft, ChevronRight, AlertCircle, CheckCircle2,
    Loader2, X, Pencil, Wifi, WifiOff, Shield,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatDate } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { clsx } from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AttendanceRecord {
    id: string;
    employee_id: string;
    date: string;
    check_in: string | null;
    check_out: string | null;
    shift_id: string | null;
    is_absent: boolean;
    is_missing_out: boolean;
    is_half_day: boolean;
    is_late: boolean;
    is_extra_day: boolean;
    is_on_leave: boolean;
    work_minutes: number;
    overtime_mins: number;
    source: "machine" | "manual";
    notes: string | null;
    employees?: { id: string; full_name: string; employee_code: string; photo_url?: string; departments?: { name: string } };
    shifts?: { id: string; name: string; start_time: string; end_time: string };
}

interface EmployeeSummary {
    employee_id: string; employee_code: string; full_name: string; photo_url?: string;
    department: string; present: number; absent: number; late: number;
    half_day: number; on_leave: number; extra_days: number;
    working_days: number; total_work_hours: number; total_overtime_hrs: number;
    attendance_pct: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(ts: string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtMins(m: number) {
    if (!m) return "—";
    const h = Math.floor(m / 60), min = m % 60;
    return min > 0 ? `${h}h ${min}m` : `${h}h`;
}
function todayStr() { return new Date().toISOString().split("T")[0]; }
function monthStr() { return new Date().toISOString().slice(0, 7); }

// Derive a readable "status" label from the boolean flags
function getStatusLabel(r: AttendanceRecord) {
    if (r.is_on_leave) return { label: "On Leave", cls: "bg-purple-50 text-purple-700 border-purple-200" };
    if (r.is_absent) return { label: "Absent", cls: "bg-red-50 text-red-600 border-red-200" };
    if (r.is_half_day) return { label: "Half Day", cls: "bg-blue-50 text-blue-700 border-blue-200" };
    if (r.is_extra_day) return { label: "Extra Day", cls: "bg-orange-50 text-orange-700 border-orange-200" };
    if (r.is_missing_out) return { label: "Missing Out", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    if (r.is_late) return { label: "Late", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" };
    if (r.check_in) return { label: "Present", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    return { label: "—", cls: "bg-gray-50 text-gray-400 border-gray-200" };
}

function StatusPill({ record }: { record: AttendanceRecord }) {
    const { label, cls } = getStatusLabel(record);
    return <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full border", cls)}>{label}</span>;
}

function SourceBadge({ source }: { source: "machine" | "manual" }) {
    return source === "machine"
        ? <span className="flex items-center gap-1 text-xs text-teal-600"><Wifi className="w-3 h-3" />Machine</span>
        : <span className="flex items-center gap-1 text-xs text-gray-400"><Pencil className="w-3 h-3" />Manual</span>;
}

function EmpAvatar({ name, url }: { name: string; url?: string }) {
    const init = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    return (
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {url ? <img src={url} alt={name} className="w-full h-full object-cover" />
                : <span className="text-xs font-bold text-brand-700">{init}</span>}
        </div>
    );
}

// ── Drawer ─────────────────────────────────────────────────────────────────────
function Drawer({ open, onClose, title, subtitle, children }: {
    open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode;
}) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [onClose]);
    return (
        <>
            <div onClick={onClose} className={clsx("fixed inset-0 bg-black/30 z-40 transition-opacity", open ? "opacity-100" : "opacity-0 pointer-events-none")} />
            <div className={clsx("fixed top-0 right-0 h-full w-[520px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400"><X className="w-4 h-4" /></button>
                </div>
                {children}
            </div>
        </>
    );
}

// ── Edit Record Drawer ─────────────────────────────────────────────────────────
function EditRecordDrawer({ record, isManager, shifts, onClose, onSaved }: {
    record: AttendanceRecord | null;
    isManager: boolean;
    shifts: any[];
    onClose: () => void;
    onSaved: (r: AttendanceRecord) => void;
}) {
    const open = !!record;
    const [checkIn, setCheckIn] = useState("");
    const [checkOut, setCheckOut] = useState("");
    const [shiftId, setShiftId] = useState("");
    const [isAbsent, setIsAbsent] = useState(false);
    const [isMissing, setIsMissing] = useState(false);
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [isLate, setIsLate] = useState(false);
    const [isExtraDay, setIsExtraDay] = useState(false);
    const [isOnLeave, setIsOnLeave] = useState(false);
    const [overtime, setOvertime] = useState("0");
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState(false);

    useEffect(() => {
        if (record) {
            setCheckIn(record.check_in ? new Date(record.check_in).toISOString().slice(0, 16) : "");
            setCheckOut(record.check_out ? new Date(record.check_out).toISOString().slice(0, 16) : "");
            setShiftId(record.shift_id || "");
            setIsAbsent(record.is_absent);
            setIsMissing(record.is_missing_out);
            setIsHalfDay(record.is_half_day);
            setIsLate(record.is_late);
            setIsExtraDay(record.is_extra_day);
            setIsOnLeave(record.is_on_leave);
            setOvertime(String(record.overtime_mins || 0));
            setNotes(record.notes || "");
            setErr(""); setOk(false);
        }
    }, [record]);

    const liveWork = (checkIn && checkOut)
        ? Math.max(0, Math.floor((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000))
        : null;

    const handleSave = async () => {
        if (!record) return;
        setBusy(true); setErr("");
        const body: any = {
            check_in: checkIn || null,
            check_out: checkOut || null,
            is_extra_day: isExtraDay,
            notes: notes || null,
        };
        if (isManager) {
            Object.assign(body, {
                shift_id: shiftId || null,
                is_absent: isAbsent, is_missing_out: isMissing,
                is_half_day: isHalfDay, is_late: isLate, is_on_leave: isOnLeave,
                overtime_mins: parseInt(overtime) || 0,
            });
        }
        try {
            const res = await fetch(`/api/hr/attendance/${record.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) { setOk(true); onSaved(data.data); setTimeout(onClose, 800); }
            else setErr(data.message || "Failed.");
        } catch { setErr("Network error."); }
        finally { setBusy(false); }
    };

    const emp = record?.employees;

    const FlagRow = ({ label, val, onChange, disabled = false }: { label: string; val: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
        <label className={clsx("flex items-center gap-3 cursor-pointer", disabled && "opacity-40 cursor-not-allowed")}>
            <div className={clsx("w-10 h-5 rounded-full transition-colors flex-shrink-0", val ? "bg-brand-600" : "bg-surface-400")}
                onClick={() => !disabled && onChange(!val)}>
                <div className={clsx("w-4 h-4 rounded-full bg-white shadow mt-0.5 transition-transform", val ? "translate-x-5" : "translate-x-0.5")} />
            </div>
            <span className="text-sm text-gray-700">{label}</span>
        </label>
    );

    return (
        <Drawer open={open} onClose={onClose} title="Edit Attendance"
            subtitle={emp ? `${emp.employee_code} · ${emp.full_name} · ${record?.date}` : ""}>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Employee card */}
                {emp && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
                        <EmpAvatar name={emp.full_name} url={emp.photo_url} />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{emp.full_name}</p>
                            <p className="text-xs text-gray-500">{emp.departments?.name} · {emp.employee_code}</p>
                        </div>
                        <StatusPill record={record!} />
                    </div>
                )}

                {/* Employee self-service notice */}
                {!isManager && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50 border border-brand-200 text-xs text-brand-700">
                        <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>You can edit your check-in/out times, mark extra days (weekends/holidays worked), and add notes. Other flags are managed by HR.</span>
                    </div>
                )}

                {/* Times */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Check In</label>
                        <input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="input" />
                    </div>
                    <div>
                        <label className="label">Check Out</label>
                        <input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="input" />
                    </div>
                </div>

                {liveWork !== null && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                        <Clock className="w-3.5 h-3.5" />Work time: {fmtMins(liveWork)}
                    </div>
                )}

                {/* Flags */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Flags</p>

                    {/* Extra day — editable by everyone */}
                    <FlagRow label="Extra Day (weekend / public holiday worked)" val={isExtraDay} onChange={setIsExtraDay} />

                    {/* Manager-only flags */}
                    {isManager && (
                        <>
                            <FlagRow label="Absent" val={isAbsent} onChange={setIsAbsent} />
                            <FlagRow label="Missing Out" val={isMissing} onChange={setIsMissing} />
                            <FlagRow label="Half Day" val={isHalfDay} onChange={setIsHalfDay} />
                            <FlagRow label="Late" val={isLate} onChange={setIsLate} />
                            <FlagRow label="On Leave" val={isOnLeave} onChange={setIsOnLeave} />
                        </>
                    )}
                    {!isManager && (
                        // Show read-only versions of flags employee can't edit
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                ["Absent", isAbsent],
                                ["Late", isLate],
                                ["Half Day", isHalfDay],
                                ["On Leave", isOnLeave],
                                ["Missing Out", isMissing],
                            ].map(([label, val]) => (
                                <div key={label as string} className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
                                    val ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-surface-100 border-surface-200 text-gray-400")}>
                                    <span className={clsx("w-2 h-2 rounded-full", val ? "bg-amber-500" : "bg-gray-300")} />
                                    {label as string}: {val ? "Yes" : "No"} <span className="ml-auto text-gray-400">(HR managed)</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Manager extras */}
                {isManager && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Shift</label>
                            <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="input">
                                <option value="">— No shift —</option>
                                {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Overtime (mins)</label>
                            <input type="number" min="0" value={overtime} onChange={(e) => setOvertime(e.target.value)} className="input tabular-nums" />
                        </div>
                    </div>
                )}

                <div>
                    <label className="label">Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                        placeholder="Optional notes…" className="input resize-none" />
                </div>

                {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{err}</div>}
                {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Saved!</div>}
            </div>
            <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex justify-end gap-2 flex-shrink-0">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} disabled={busy || ok} className="btn-primary min-w-[110px] justify-center">
                    {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : ok ? "Saved!" : "Save Changes"}
                </button>
            </div>
        </Drawer>
    );
}

// ── Bulk Entry Drawer (manager only) ──────────────────────────────────────────
function BulkEntryDrawer({ open, onClose, onSaved, employees, shifts }: {
    open: boolean; onClose: () => void; onSaved: () => void; employees: any[]; shifts: any[];
}) {
    type Status = "present" | "absent" | "half_day" | "late" | "on_leave" | "holiday";
    const STATUS_OPTS: { value: Status; label: string; cls: string }[] = [
        { value: "present", label: "Present", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
        { value: "absent", label: "Absent", cls: "text-red-600 bg-red-50 border-red-200" },
        { value: "half_day", label: "Half Day", cls: "text-blue-700 bg-blue-50 border-blue-200" },
        { value: "late", label: "Late", cls: "text-amber-700 bg-amber-50 border-amber-200" },
        { value: "on_leave", label: "On Leave", cls: "text-purple-700 bg-purple-50 border-purple-200" },
        { value: "holiday", label: "Holiday", cls: "text-gray-600 bg-gray-100 border-gray-200" },
    ];

    const [date, setDate] = useState(todayStr());
    const [shiftId, setShiftId] = useState("");
    const [rows, setRows] = useState<Record<string, Status>>({});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState(false);

    useEffect(() => {
        if (open) {
            setDate(todayStr()); setErr(""); setOk(false);
            const init: Record<string, Status> = {};
            employees.forEach((e) => { init[e.id] = "present"; });
            setRows(init);
        }
    }, [open, employees]);

    const handleSubmit = async () => {
        setBusy(true); setErr("");
        const records = employees.map((e) => {
            const s = rows[e.id] || "present";
            return {
                employee_id: e.id,
                is_absent: s === "absent",
                is_half_day: s === "half_day",
                is_late: s === "late",
                is_on_leave: s === "on_leave",
                shift_id: shiftId || null,
            };
        });
        try {
            const res = await fetch("/api/hr/attendance", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bulk: true, date, records }),
            });
            const data = await res.json();
            if (data.success) { setOk(true); onSaved(); setTimeout(onClose, 1000); }
            else setErr(data.message || "Failed.");
        } catch { setErr("Network error."); }
        finally { setBusy(false); }
    };

    const counts = Object.values(rows).reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {} as Record<string, number>);

    return (
        <Drawer open={open} onClose={onClose} title="Bulk Attendance Entry" subtitle="Record attendance for all employees">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Date <span className="text-red-500">*</span></label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
                    </div>
                    <div>
                        <label className="label">Default Shift</label>
                        <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="input">
                            <option value="">— No shift —</option>
                            {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Quick set */}
                <div>
                    <p className="label mb-2">Quick Set All</p>
                    <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTS.map((s) => (
                            <button key={s.value} type="button"
                                onClick={() => setRows((p) => { const n = { ...p }; employees.forEach((e) => { n[e.id] = s.value; }); return n; })}
                                className={clsx("px-3 py-1 rounded-full text-xs font-medium border", s.cls)}>
                                All {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Count summary */}
                <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTS.filter((s) => counts[s.value]).map((s) => (
                        <span key={s.value} className={clsx("text-xs px-2 py-0.5 rounded-full border font-medium", s.cls)}>
                            {counts[s.value]} {s.label}
                        </span>
                    ))}
                </div>

                {/* Employee rows */}
                <div className="border border-surface-300 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto] bg-surface-100 px-3 py-2 text-xs font-medium text-gray-500 border-b border-surface-200">
                        <span>Employee</span><span className="pr-1">Status</span>
                    </div>
                    <div className="divide-y divide-surface-200 max-h-80 overflow-y-auto">
                        {employees.map((emp) => (
                            <div key={emp.id} className="px-3 py-2.5 flex items-center gap-3">
                                <EmpAvatar name={emp.full_name} url={emp.photo_url} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate">{emp.full_name}</p>
                                    <p className="text-xs text-gray-400">{(emp as any).departments?.name || emp.employee_code}</p>
                                </div>
                                <select value={rows[emp.id] || "present"} onChange={(e) => setRows((p) => ({ ...p, [emp.id]: e.target.value as any }))}
                                    className={clsx("text-xs font-medium border rounded-lg px-2 py-1 focus:outline-none",
                                        STATUS_OPTS.find((s) => s.value === (rows[emp.id] || "present"))?.cls)}>
                                    {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{err}</div>}
                {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Saved for {employees.length} employees!</div>}
            </div>
            <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex justify-end gap-2 flex-shrink-0">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button onClick={handleSubmit} disabled={busy || ok} className="btn-primary min-w-[130px] justify-center">
                    {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : ok ? "Saved!" : `Save ${employees.length} Records`}
                </button>
            </div>
        </Drawer>
    );
}

// ── Machine Sync Panel ────────────────────────────────────────────────────────
function SyncPanel({ onSynced }: { onSynced: () => void }) {
    const [syncing, setSyncing] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; });
    const [dateTo, setDateTo] = useState(todayStr());

    useEffect(() => {
        fetch("/api/hr/attendance/sync").then((r) => r.json()).then((res) => { if (res.success) setLogs(res.data); });
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const p = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
            const res = await fetch(`/api/hr/attendance/sync?${p}`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setLogs((prev) => [data.data, ...prev].slice(0, 10));
                onSynced();
            }
        } catch (error) {
            console.log((error as Error).message)
        }
        finally { setSyncing(false); }
    };

    const lastLog = logs[0];
    console.log("attendance data: ", lastLog)

    return (
        <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Machine Sync</h3>
                    <span className="text-xs text-gray-400">
                        { (process.env.NEXT_ATTENDANCE_MACHINE_IP) ?? "192.168.10.116" }
                    </span>
                </div>
                {lastLog && (
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full border font-medium",
                        lastLog.status === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200")}>
                        {lastLog.status === "ok" ? `Last sync: ${lastLog.records_new} new, ${lastLog.records_updated} updated` : `Error: ${lastLog.error_message}`}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input !w-auto text-xs py-1.5" />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input !w-auto text-xs py-1.5" />
                </div>
                <button onClick={handleSync} disabled={syncing}
                    className="btn-primary ml-auto">
                    {syncing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Syncing…</> : <><Wifi className="w-3.5 h-3.5" />Sync Now</>}
                </button>
            </div>
            {logs.length > 0 && (
                <div className="text-xs text-gray-500 space-y-0.5">
                    {logs.slice(0, 3).map((log, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className={clsx("w-1.5 h-1.5 rounded-full", log.status === "ok" ? "bg-emerald-500" : "bg-red-500")} />
                            <span>{new Date(log.synced_at).toLocaleString("en", { dateStyle: "short", timeStyle: "short" })}</span>
                            <span>· {log.records_found} found · {log.records_new} new · {log.records_updated} updated</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Daily Log ──────────────────────────────────────────────────────────────────
function DailyLog({ isManager, myEmployeeId, shifts, departments }: {
    isManager: boolean; myEmployeeId: string | null; shifts: any[]; departments: any[];
}) {
    const [date, setDate] = useState(todayStr());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [deptFilter, setDeptFilter] = useState("");
    const [search, setSearch] = useState("");
    const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [employees, setEmployees] = useState<any[]>([]);

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams({ date_from: date, date_to: date, pageSize: "300" });
        if (isManager && deptFilter) p.set("department_id", deptFilter);
        fetch(`/api/hr/attendance?${p}`)
            .then((r) => r.json())
            .then((res) => { if (res.success) setRecords(res.data); })
            .finally(() => setLoading(false));
    }, [date, deptFilter, isManager]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (isManager) {
            fetch("/api/hr/employees?pageSize=300&status=active")
                .then((r) => r.json()).then((res) => { if (res.success) setEmployees(res.data); });
        }
    }, [isManager]);

    const shiftDate = (d: number) => {
        const nd = new Date(date); nd.setDate(nd.getDate() + d);
        setDate(nd.toISOString().split("T")[0]);
    };

    const filtered = records.filter((r) =>
        !search ||
        r.employees?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.employees?.employee_code?.toLowerCase().includes(search.toLowerCase())
    );

    const counts = filtered.reduce((acc, r) => {
        const { label } = getStatusLabel(r);
        acc[label] = (acc[label] || 0) + 1; return acc;
    }, {} as Record<string, number>);

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-0 bg-white border border-surface-300 rounded-xl overflow-hidden">
                        <button onClick={() => shiftDate(-1)} className="px-3 py-2 hover:bg-surface-100 transition-colors border-r border-surface-300">
                            <ChevronLeft className="w-4 h-4 text-gray-500" />
                        </button>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                            className="px-3 py-2 text-sm font-medium text-gray-800 border-0 outline-none bg-transparent" />
                        <button onClick={() => shiftDate(1)} className="px-3 py-2 hover:bg-surface-100 transition-colors border-l border-surface-300">
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                    <button onClick={() => setDate(todayStr())} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Today</button>

                    <div className="flex items-center gap-2 ml-auto">
                        {isManager && (
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search…" className="input pl-8 text-xs py-1.5 w-40" />
                            </div>
                        )}
                        {isManager && departments.length > 0 && (
                            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
                                <option value="">All Departments</option>
                                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        )}
                        <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /></button>
                        {isManager && <button onClick={() => setBulkOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />Bulk Entry</button>}
                    </div>
                </div>

                {/* Day summary */}
                {!loading && filtered.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(counts).map(([label, count]) => (
                            <span key={label} className="text-xs px-3 py-1.5 rounded-xl border bg-white text-gray-600 font-medium border-surface-300">
                                {count} {label}
                            </span>
                        ))}
                    </div>
                )}

                <SectionTitle title={`Attendance — ${new Date(date + "T12:00:00").toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`} count={filtered.length} />

                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-100">
                                    {(isManager
                                        ? ["Employee", "Dept", "Shift", "Check In", "Check Out", "Tot. Time", "OT", "Flags", "Source", ""]
                                        : ["Date", "Shift", "Check In", "Check Out", "Tot. Time", "Status", "Flags", ""]
                                    ).map((h) => (
                                        <th key={h} className="table-header px-4 py-3 text-left text-xs">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? <tr><td colSpan={isManager ? 10 : 8}><TableSkeleton rows={6} cols={isManager ? 10 : 8} /></td></tr>
                                    : filtered.length === 0 ? (
                                        <tr><td colSpan={isManager ? 10 : 8}>
                                            <EmptyState title="No records" description={isManager ? "Use Bulk Entry to record attendance." : "No attendance record for this date."}
                                                action={isManager ? <button onClick={() => setBulkOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />Bulk Entry</button> : undefined} />
                                        </td></tr>
                                    ) : filtered.map((r) => {
                                        const flags = [
                                            r.is_absent && { label: "Absent", cls: "bg-red-100 text-red-700" },
                                            r.is_missing_out && { label: "No Checkout", cls: "bg-amber-100 text-amber-700" },
                                            r.is_half_day && { label: "Half", cls: "bg-blue-100 text-blue-700" },
                                            r.is_late && { label: "Late", cls: "bg-yellow-100 text-yellow-700" },
                                            r.is_extra_day && { label: "Extra Day", cls: "bg-orange-100 text-orange-700" },
                                            r.is_on_leave && { label: "Leave", cls: "bg-purple-100 text-purple-700" },
                                        ].filter(Boolean) as { label: string; cls: string }[];

                                        return (
                                            <tr key={r.id} onClick={() => setEditRecord(r)}
                                                className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group">
                                                {isManager ? (
                                                    <>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <EmpAvatar name={r.employees?.full_name || "?"} url={r.employees?.photo_url} />
                                                                <div>
                                                                    <p className="text-xs font-medium text-gray-900">{r.employees?.full_name}</p>
                                                                    <p className="text-xs text-gray-400 font-mono">{r.employees?.employee_code}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-600">{r.employees?.departments?.name || "—"}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-600">{r.shifts?.name || "—"}</td>
                                                        <td className={clsx("px-4 py-3 text-xs tabular-nums font-medium", r.check_in ? "text-emerald-700" : "text-gray-300")}>{fmtTime(r.check_in)}</td>
                                                        <td className={clsx("px-4 py-3 text-xs tabular-nums font-medium", r.check_out ? "text-red-600" : "text-gray-300")}>{fmtTime(r.check_out)}</td>
                                                        <td className="px-4 py-3 text-xs tabular-nums text-gray-700">{fmtMins(r.work_minutes - 60)}</td>
                                                        <td className="px-4 py-3 text-xs tabular-nums text-purple-700">{r.overtime_mins > 0 ? fmtMins(r.overtime_mins) : "—"}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap gap-1">
                                                                {flags.map((f) => <span key={f.label} className={clsx("text-xs px-1.5 py-0.5 rounded font-medium", f.cls)}>{f.label}</span>)}
                                                                {flags.length === 0 && r.check_in && <span className="text-xs text-emerald-600 font-medium">✓ Present</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3"><SourceBadge source={r.source} /></td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-4 py-3 text-xs text-gray-700">{new Date(r.date + "T12:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-600">{r.shifts?.name || "—"}</td>
                                                        <td className={clsx("px-4 py-3 text-xs tabular-nums font-medium", r.check_in ? "text-emerald-700" : "text-gray-300")}>{fmtTime(r.check_in)}</td>
                                                        <td className={clsx("px-4 py-3 text-xs tabular-nums font-medium", r.check_out ? "text-red-600" : "text-gray-300")}>{fmtTime(r.check_out)}</td>
                                                        <td className="px-4 py-3 text-xs tabular-nums text-gray-700">{fmtMins(r.work_minutes)}</td>
                                                        <td className="px-4 py-3"><StatusPill record={r} /></td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap gap-1">
                                                                {flags.map((f) => <span key={f.label} className={clsx("text-xs px-1.5 py-0.5 rounded font-medium", f.cls)}>{f.label}</span>)}
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                                <td className="px-4 py-3"><Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" /></td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <EditRecordDrawer record={editRecord} isManager={isManager} shifts={shifts}
                onClose={() => setEditRecord(null)}
                onSaved={(updated) => setRecords((p) => p.map((r) => r.id === updated.id ? { ...r, ...updated } : r))} />
            {isManager && (
                <BulkEntryDrawer open={bulkOpen} onClose={() => setBulkOpen(false)} onSaved={load}
                    employees={employees} shifts={shifts} />
            )}
        </>
    );
}

// ── Monthly Summary (manager only) ────────────────────────────────────────────
function MonthlySummary({ departments }: { departments: any[] }) {
    const [month, setMonth] = useState(monthStr());
    const [deptFilter, setDeptFilter] = useState("");
    const [summary, setSummary] = useState<EmployeeSummary[]>([]);
    const [overall, setOverall] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams({ month });
        if (deptFilter) p.set("department_id", deptFilter);
        fetch(`/api/hr/attendance/summary?${p}`)
            .then((r) => r.json())
            .then((res) => { if (res.success) { setSummary(res.data.summary || []); setOverall(res.data.overall); } })
            .finally(() => setLoading(false));
    }, [month, deptFilter]);

    useEffect(() => { load(); }, [load]);

    const shiftMonth = (d: number) => {
        const [y, m] = month.split("-").map(Number);
        const nd = new Date(y, m - 1 + d, 1);
        setMonth(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`);
    };

    const filtered = summary.filter((e) =>
        !search || e.full_name.toLowerCase().includes(search.toLowerCase()) || e.employee_code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-0 bg-white border border-surface-300 rounded-xl overflow-hidden">
                    <button onClick={() => shiftMonth(-1)} className="px-3 py-2 hover:bg-surface-100 border-r border-surface-300"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                        className="px-3 py-2 text-sm font-medium text-gray-800 border-0 outline-none bg-transparent" />
                    <button onClick={() => shiftMonth(1)} className="px-3 py-2 hover:bg-surface-100 border-l border-surface-300"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
                </div>
                <button onClick={() => setMonth(monthStr())} className="text-xs text-brand-600 hover:text-brand-700 font-medium">This Month</button>
                <div className="flex items-center gap-2 ml-auto">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="input pl-8 text-xs py-1.5 w-40" />
                    </div>
                    <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
                        <option value="">All Departments</option>
                        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            {overall && (
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: "Working Days", value: overall.working_days, color: "text-gray-900" },
                        { label: "Employees", value: overall.total_employees, color: "text-brand-700" },
                        { label: "Avg Attendance", value: `${overall.avg_attendance_pct}%`, color: overall.avg_attendance_pct >= 85 ? "text-emerald-700" : "text-amber-600" },
                        { label: "Month", value: new Date(month + "-15").toLocaleDateString("en", { month: "long", year: "numeric" }), color: "text-gray-700" },
                    ].map((k) => (
                        <div key={k.label} className="card px-4 py-3 flex items-center justify-between">
                            <span className="text-xs text-gray-500">{k.label}</span>
                            <span className={clsx("text-lg font-bold", k.color)}>{k.value}</span>
                        </div>
                    ))}
                </div>
            )}

            <SectionTitle title="Employee Summary" count={filtered.length} />
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-200 bg-surface-100">
                                {["Employee", "Dept", "Present", "Absent", "Late", "Half", "Leave", "Extra", "Work Hrs", "OT Hrs", "Attendance"].map((h) => (
                                    <th key={h} className="table-header px-3 py-3 text-left text-xs">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan={11}><TableSkeleton rows={5} cols={11} /></td></tr>
                                : filtered.length === 0 ? <tr><td colSpan={11}><EmptyState title="No data" description="No records for this period." /></td></tr>
                                    : filtered.map((e) => (
                                        <tr key={e.employee_id} className="border-b border-surface-200 hover:bg-surface-50">
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2">
                                                    <EmpAvatar name={e.full_name} url={e.photo_url} />
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-900">{e.full_name}</p>
                                                        <p className="text-xs text-gray-400 font-mono">{e.employee_code}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-xs text-gray-600">{e.department}</td>
                                            <td className="px-3 py-3 text-xs font-bold text-emerald-700 text-center">{e.present}</td>
                                            <td className="px-3 py-3 text-xs font-bold text-red-600 text-center">{e.absent}</td>
                                            <td className="px-3 py-3 text-xs font-bold text-amber-600 text-center">{e.late}</td>
                                            <td className="px-3 py-3 text-xs text-blue-700 text-center">{e.half_day}</td>
                                            <td className="px-3 py-3 text-xs text-purple-700 text-center">{e.on_leave}</td>
                                            <td className="px-3 py-3 text-xs text-orange-700 text-center">{e.extra_days || 0}</td>
                                            <td className="px-3 py-3 text-xs tabular-nums text-gray-700 text-center">{e.total_work_hours}h</td>
                                            <td className="px-3 py-3 text-xs tabular-nums text-purple-700 text-center">{e.total_overtime_hrs > 0 ? `${e.total_overtime_hrs}h` : "—"}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-14 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                                                        <div className={clsx("h-full rounded-full", e.attendance_pct >= 90 ? "bg-emerald-500" : e.attendance_pct >= 75 ? "bg-amber-500" : "bg-red-500")}
                                                            style={{ width: `${e.attendance_pct}%` }} />
                                                    </div>
                                                    <span className={clsx("text-xs font-bold tabular-nums", e.attendance_pct >= 90 ? "text-emerald-700" : e.attendance_pct >= 75 ? "text-amber-600" : "text-red-600")}>
                                                        {e.attendance_pct}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AttendancePage() {
    const { user, role, loading: authLoading } = useAuth();
    const [tab, setTab] = useState<"daily" | "summary">("daily");
    const [shifts, setShifts] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [myEmpId, setMyEmpId] = useState<string | null>(null);

    const isManager = role && ["super_admin", "hr_manager"].includes(role);

    useEffect(() => {
        Promise.all([
            fetch("/api/hr/attendance/shifts").then((r) => r.json()),
            fetch("/api/hr/departments?pageSize=100").then((r) => r.json()),
        ]).then(([sh, dp]) => {
            if (sh.success) setShifts(sh.data);
            if (dp.success) setDepartments(dp.data);
        });
        // Get caller's employee ID for self-service
        if (user) {
            fetch(`/api/hr/employees?search=${encodeURIComponent(user.email || "")}&pageSize=1`)
                .then((r) => r.json())
                .then((res) => { if (res.success && res.data[0]) setMyEmpId(res.data[0].id); });
        }
    }, [user]);

    return (
        <>
            <Header title="Attendance" subtitle="Human Resources Module"
                actions={
                    <div className="flex items-center gap-1 p-1 bg-surface-100 border border-surface-300 rounded-xl">
                        {([["daily", "Daily Log", Clock], ["summary", "Monthly Summary", BarChart3]] as const)
                            .filter(([id]) => id === "daily" || isManager)
                            .map(([id, label, Icon]) => (
                                <button key={id} onClick={() => setTab(id as any)}
                                    className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                        tab === id ? "bg-white shadow-sm text-gray-900 border border-surface-300" : "text-gray-500 hover:text-gray-700")}>
                                    <Icon className="w-3.5 h-3.5" />{label}
                                </button>
                            ))}
                    </div>
                }
            />
            <PageWrapper>
                {isManager && tab === "daily" && (
                    <SyncPanel onSynced={() => { /* re-render triggers via load */ }} />
                )}
                {tab === "daily" && (
                    <div className={isManager ? "mt-4" : ""}>
                        <DailyLog isManager={!!isManager} myEmployeeId={myEmpId} shifts={shifts} departments={departments} />
                    </div>
                )}
                {tab === "summary" && isManager && <MonthlySummary departments={departments} />}
            </PageWrapper>
        </>
    );
}
