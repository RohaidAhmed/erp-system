"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    RefreshCw, Plus, Search, Clock, CheckCircle2, XCircle,
    AlertCircle, ChevronLeft, ChevronRight, Calendar,
    Users, BarChart3, Pencil, Loader2, X, ChevronRight as Chevron,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatDate } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { clsx } from "clsx";
import { Employee } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────
type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "on_leave" | "holiday" | "weekend";

interface AttendanceRecord {
    id: string;
    employee_id: string;
    date: string;
    check_in: string | null;
    check_out: string | null;
    status: AttendanceStatus;
    work_minutes: number;
    overtime_mins: number;
    shift_id: string | null;
    notes: string | null;
    employees?: { id: string; full_name: string; employee_code: string; photo_url?: string; departments?: { name: string } };
    shifts?: { id: string; name: string; start_time: string; end_time: string };
}

interface EmployeeSummary {
    employee_id: string; employee_code: string; full_name: string; photo_url?: string;
    department: string; present: number; absent: number; late: number;
    half_day: number; on_leave: number; working_days: number;
    total_work_hours: number; total_overtime_hrs: number; attendance_pct: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string; dot: string }> = {
    present: { label: "Present", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
    absent: { label: "Absent", color: "text-red-600", bg: "bg-red-50 border-red-200", dot: "bg-red-500" },
    late: { label: "Late", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" },
    half_day: { label: "Half Day", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500" },
    on_leave: { label: "On Leave", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500" },
    holiday: { label: "Holiday", color: "text-gray-600", bg: "bg-gray-100 border-gray-200", dot: "bg-gray-400" },
    weekend: { label: "Weekend", color: "text-gray-500", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-300" },
};

function StatusBadge({ status }: { status: AttendanceStatus }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.absent;
    return (
        <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border", cfg.bg, cfg.color)}>
            <span className={clsx("w-1.5 h-1.5 rounded-full", cfg.dot)} />
            {cfg.label}
        </span>
    );
}

function fmtTime(ts: string | null): string {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtMins(mins: number): string {
    if (!mins) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function monthStr() { return new Date().toISOString().slice(0, 7); }

// ── Employee Avatar ────────────────────────────────────────────────────────────
function EmpAvatar({ name, photoUrl, size = "sm" }: { name: string; photoUrl?: string; size?: "sm" | "md" }) {
    const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
    const cls = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
    return (
        <div className={clsx("rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 overflow-hidden", cls)}>
            {photoUrl
                ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                : <span className="font-bold text-brand-700">{initials}</span>}
        </div>
    );
}

// ── Drawer shell ───────────────────────────────────────────────────────────────
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

// ── Single Record Edit Drawer ──────────────────────────────────────────────────
function EditRecordDrawer({ record, onClose, onSaved, shifts }: {
    record: AttendanceRecord | null; onClose: () => void;
    onSaved: (r: AttendanceRecord) => void; shifts: any[];
}) {
    const open = !!record;
    const [status, setStatus] = useState<AttendanceStatus>("present");
    const [checkIn, setCheckIn] = useState("");
    const [checkOut, setCheckOut] = useState("");
    const [shiftId, setShiftId] = useState("");
    const [overtime, setOvertime] = useState("0");
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState(false);

    useEffect(() => {
        if (record) {
            setStatus(record.status);
            setCheckIn(record.check_in ? new Date(record.check_in).toISOString().slice(0, 16) : "");
            setCheckOut(record.check_out ? new Date(record.check_out).toISOString().slice(0, 16) : "");
            setShiftId(record.shift_id || "");
            setOvertime(String(record.overtime_mins || 0));
            setNotes(record.notes || "");
            setErr(""); setOk(false);
        }
    }, [record]);

    const handleSave = async () => {
        if (!record) return;
        setBusy(true); setErr("");
        try {
            const res = await fetch(`/api/hr/attendance/${record.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status,
                    check_in: checkIn || null,
                    check_out: checkOut || null,
                    shift_id: shiftId || null,
                    overtime_mins: parseInt(overtime) || 0,
                    notes: notes || null,
                }),
            });
            const data = await res.json();
            if (data.success) { setOk(true); onSaved(data.data); setTimeout(onClose, 800); }
            else setErr(data.message || "Failed to update.");
        } catch { setErr("Network error."); }
        finally { setBusy(false); }
    };

    const emp = record?.employees;

    return (
        <Drawer open={open} onClose={onClose} title="Edit Attendance"
            subtitle={emp ? `${emp.employee_code} · ${emp.full_name} · ${record?.date}` : ""}>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {emp && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
                        <EmpAvatar name={emp.full_name} photoUrl={emp.photo_url} size="md" />
                        <div>
                            <p className="text-sm font-semibold text-gray-900">{emp.full_name}</p>
                            <p className="text-xs text-gray-500">{emp.departments?.name} · {emp.employee_code}</p>
                        </div>
                        <div className="ml-auto">
                            <StatusBadge status={status} />
                        </div>
                    </div>
                )}

                <div>
                    <label className="label">Status</label>
                    <div className="grid grid-cols-4 gap-1.5">
                        {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((s) => (
                            <button key={s} type="button" onClick={() => setStatus(s)}
                                className={clsx("py-1.5 px-2 rounded-lg text-xs font-medium border transition-all",
                                    status === s ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color}` : "border-surface-300 text-gray-500 hover:bg-surface-100")}>
                                {STATUS_CONFIG[s].label}
                            </button>
                        ))}
                    </div>
                </div>

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

                {checkIn && checkOut && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                        <Clock className="w-3.5 h-3.5" />
                        Work time: {fmtMins(Math.max(0, Math.floor((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000) - 60))}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Shift</label>
                        <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="input">
                            <option value="">— No shift —</option>
                            {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Overtime (mins)</label>
                        <input type="number" min="0" value={overtime} onChange={(e) => setOvertime(e.target.value)} className="input tabular-nums" />
                    </div>
                </div>

                <div>
                    <label className="label">Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                        placeholder="Any notes about this attendance record…"
                        className="input resize-none" />
                </div>

                {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{err}</div>}
                {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Saved!</div>}
            </div>
            <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex justify-end gap-2 flex-shrink-0">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} disabled={busy || ok} className="btn-primary min-w-[110px] justify-center">
                    {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : ok ? <><CheckCircle2 className="w-3.5 h-3.5" />Saved!</> : "Save Changes"}
                </button>
            </div>
        </Drawer>
    );
}

// ── Bulk Entry Drawer ──────────────────────────────────────────────────────────
function BulkEntryDrawer({ open, onClose, onSaved, employees, shifts }: {
    open: boolean; onClose: () => void; onSaved: () => void;
    employees: any[]; shifts: any[];
}) {
    const [date, setDate] = useState(todayStr());
    const [shiftId, setShiftId] = useState("");
    const [rows, setRows] = useState<Record<string, { status: AttendanceStatus; check_in: string; check_out: string; notes: string }>>({});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState(false);

    useEffect(() => {
        if (open) {
            setDate(todayStr()); setErr(""); setOk(false);
            // Init all employees as "present"
            const init: typeof rows = {};
            employees.forEach((e) => { init[e.id] = { status: "present", check_in: "", check_out: "", notes: "" }; });
            setRows(init);
        }
    }, [open, employees]);

    const setRow = (id: string, field: string, val: string) => {
        setRows((p) => ({ ...p, [id]: { ...p[id], [field]: val } }));
    };

    const setAll = (status: AttendanceStatus) => {
        setRows((p) => {
            const next = { ...p };
            Object.keys(next).forEach((id) => { next[id] = { ...next[id], status }; });
            return next;
        });
    };

    const handleSubmit = async () => {
        setBusy(true); setErr("");
        try {
            const records = employees.map((e) => {
                const r = rows[e.id] || { status: "absent", check_in: "", check_out: "", notes: "" };
                return {
                    employee_id: e.id,
                    status: r.status,
                    check_in: r.check_in || null,
                    check_out: r.check_out || null,
                    shift_id: shiftId || null,
                    notes: r.notes || null,
                };
            });
            const res = await fetch("/api/hr/attendance", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bulk: true, date, records }),
            });
            const data = await res.json();
            if (data.success) { setOk(true); onSaved(); setTimeout(onClose, 1000); }
            else setErr(data.message || "Bulk save failed.");
        } catch { setErr("Network error."); }
        finally { setBusy(false); }
    };

    const statusCounts = employees.reduce((acc, e) => {
        const s = rows[e.id]?.status || "present";
        acc[s] = (acc[s] || 0) + 1; return acc;
    }, {} as Record<string, number>);

    return (
        <Drawer open={open} onClose={onClose} title="Bulk Attendance Entry" subtitle="Record attendance for all employees at once">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Date + shift */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Date <span className="text-red-500">*</span></label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
                    </div>
                    <div>
                        <label className="label">Default Shift</label>
                        <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="input">
                            <option value="">— No shift —</option>
                            {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Quick-set all */}
                <div>
                    <p className="label mb-2">Quick Set All</p>
                    <div className="flex flex-wrap gap-1.5">
                        {(["present", "absent", "on_leave", "holiday", "weekend"] as AttendanceStatus[]).map((s) => (
                            <button key={s} type="button" onClick={() => setAll(s)}
                                className={clsx("px-3 py-1 rounded-full text-xs font-medium border transition-all", STATUS_CONFIG[s].bg, STATUS_CONFIG[s].color)}>
                                All {STATUS_CONFIG[s].label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary pills */}
                <div className="flex flex-wrap gap-1.5">
                    {Object.entries(statusCounts).map(([s, count]) => (
                        <span key={s} className={clsx("text-xs px-2 py-0.5 rounded-full border font-medium", STATUS_CONFIG[s as AttendanceStatus]?.bg, STATUS_CONFIG[s as AttendanceStatus]?.color)}>
                            {count as number} {STATUS_CONFIG[s as AttendanceStatus]?.label}
                        </span>
                    ))}
                </div>

                {/* Employee rows */}
                <div className="border border-surface-300 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto] bg-surface-100 px-3 py-2 text-xs font-medium text-gray-500 border-b border-surface-200">
                        <span>Employee</span><span>Status</span>
                    </div>
                    <div className="divide-y divide-surface-200 max-h-80 overflow-y-auto">
                        {employees.map((emp) => {
                            const row = rows[emp.id] || { status: "present", check_in: "", check_out: "", notes: "" };
                            return (
                                <div key={emp.id} className="px-3 py-2.5 flex items-center gap-3">
                                    <EmpAvatar name={emp.full_name} photoUrl={emp.photo_url} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">{emp.full_name}</p>
                                        <p className="text-xs text-gray-400">{emp.departments?.name || emp.employee_code}</p>
                                    </div>
                                    <select value={row.status} onChange={(e) => setRow(emp.id, "status", e.target.value)}
                                        className={clsx("text-xs font-medium border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500/30",
                                            STATUS_CONFIG[row.status as AttendanceStatus]?.bg,
                                            STATUS_CONFIG[row.status as AttendanceStatus]?.color)}>
                                        {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((s) => (
                                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{err}</div>}
                {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Attendance saved for {employees.length} employees!</div>}
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

// ── Daily Log Tab ──────────────────────────────────────────────────────────────
function DailyLog({ shifts, departments }: { shifts: any[]; departments: any[] }) {
    const [date, setDate] = useState(todayStr());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [deptFilter, setDeptFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams({ date_from: date, date_to: date, pageSize: "200" });
        if (deptFilter) p.set("department_id", deptFilter);
        if (statusFilter) p.set("status", statusFilter);
        fetch(`/api/hr/attendance?${p}`)
            .then((r) => r.json())
            .then((res) => { if (res.success) setRecords(res.data); })
            .finally(() => setLoading(false));
    }, [date, deptFilter, statusFilter]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        // Load employees for bulk entry
        fetch("/api/hr/employees?pageSize=200&status=active")
            .then((r) => r.json())
            .then((res) => { if (res.success) setEmployees(res.data); });
    }, []);

    const shiftDate = (d: number) => {
        const nd = new Date(date); nd.setDate(nd.getDate() + d);
        setDate(nd.toISOString().split("T")[0]);
    };

    // Summary for this day
    const counts = records.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1; return acc;
    }, {} as Record<string, number>);

    return (
        <>
            <div className="space-y-4">
                {/* Date nav */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1 bg-white border border-surface-300 rounded-xl overflow-hidden">
                        <button onClick={() => shiftDate(-1)} className="px-3 py-2 hover:bg-surface-100 transition-colors"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                            className="px-3 py-2 text-sm font-medium text-gray-800 border-0 outline-none bg-transparent" />
                        <button onClick={() => shiftDate(1)} className="px-3 py-2 hover:bg-surface-100 transition-colors"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
                    </div>
                    <button onClick={() => setDate(todayStr())} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Today</button>

                    <div className="flex items-center gap-2 ml-auto">
                        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
                            <option value="">All Departments</option>
                            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
                            <option value="">All Statuses</option>
                            {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((s) => (
                                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                            ))}
                        </select>
                        <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setBulkOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />Bulk Entry</button>
                    </div>
                </div>

                {/* Day summary pills */}
                {!loading && records.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(counts).map(([s, count]) => (
                            <div key={s} className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium", STATUS_CONFIG[s as AttendanceStatus]?.bg, STATUS_CONFIG[s as AttendanceStatus]?.color)}>
                                <span className={clsx("w-1.5 h-1.5 rounded-full", STATUS_CONFIG[s as AttendanceStatus]?.dot)} />
                                {count} {STATUS_CONFIG[s as AttendanceStatus]?.label}
                            </div>
                        ))}
                    </div>
                )}

                <SectionTitle title={`Attendance — ${new Date(date + "T12:00:00").toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`} count={records.length} />

                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-100">
                                    {["Employee", "Department", "Shift", "Check In", "Check Out", "Work Time", "Overtime", "Status", ""].map((h) => (
                                        <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={9}><TableSkeleton rows={6} cols={9} /></td></tr>
                                ) : records.length === 0 ? (
                                    <tr><td colSpan={9}>
                                        <EmptyState title="No attendance records" description="Use Bulk Entry to record today's attendance."
                                            action={<button onClick={() => setBulkOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />Bulk Entry</button>} />
                                    </td></tr>
                                ) : records.map((r) => (
                                    <tr key={r.id} onClick={() => setEditRecord(r)}
                                        className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <EmpAvatar name={r.employees?.full_name || "?"} photoUrl={r.employees?.photo_url} />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{r.employees?.full_name}</p>
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
                                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                                        <td className="px-4 py-3"><Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <EditRecordDrawer record={editRecord} onClose={() => setEditRecord(null)}
                onSaved={(updated) => { setRecords((p) => p.map((r) => r.id === updated.id ? { ...r, ...updated } : r)); }}
                shifts={shifts} />
            <BulkEntryDrawer open={bulkOpen} onClose={() => setBulkOpen(false)} onSaved={load}
                employees={employees} shifts={shifts} />
        </>
    );
}

// ── Monthly Summary Tab ────────────────────────────────────────────────────────
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
            {/* Month nav */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-white border border-surface-300 rounded-xl overflow-hidden">
                    <button onClick={() => shiftMonth(-1)} className="px-3 py-2 hover:bg-surface-100 transition-colors"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                        className="px-3 py-2 text-sm font-medium text-gray-800 border-0 outline-none bg-transparent" />
                    <button onClick={() => shiftMonth(1)} className="px-3 py-2 hover:bg-surface-100 transition-colors"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
                </div>
                <button onClick={() => setMonth(monthStr())} className="text-xs text-brand-600 hover:text-brand-700 font-medium">This Month</button>

                <div className="flex items-center gap-2 ml-auto">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search employee…" className="input pl-8 text-xs py-1.5 w-44" />
                    </div>
                    <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
                        <option value="">All Departments</option>
                        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            {/* Overall KPIs */}
            {overall && (
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: "Working Days", value: overall.working_days, color: "text-gray-900" },
                        { label: "Total Employees", value: overall.total_employees, color: "text-brand-700" },
                        { label: "Avg Attendance", value: `${overall.avg_attendance_pct}%`, color: overall.avg_attendance_pct >= 85 ? "text-emerald-700" : "text-amber-600" },
                        { label: "Month", value: new Date(month + "-15").toLocaleDateString("en", { month: "long", year: "numeric" }), color: "text-gray-700" },
                    ].map((k) => (
                        <div key={k.label} className="card px-4 py-3 flex items-center justify-between">
                            <span className="text-xs text-gray-500">{k.label}</span>
                            <span className={clsx("text-lg font-bold tabular-nums", k.color)}>{k.value}</span>
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
                                {["Employee", "Department", "Present", "Absent", "Late", "Half Day", "Leave", "Work Hours", "Overtime", "Attendance %"].map((h) => (
                                    <th key={h} className={clsx("table-header px-4 py-3", ["Present", "Absent", "Late", "Half Day", "Leave", "Work Hours", "Overtime", "Attendance %"].includes(h) ? "text-center" : "text-left")}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={10}><TableSkeleton rows={6} cols={10} /></td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={10}><EmptyState title="No data" description="No attendance records for this period." /></td></tr>
                            ) : filtered.map((e) => (
                                <tr key={e.employee_id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <EmpAvatar name={e.full_name} photoUrl={e.photo_url} />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{e.full_name}</p>
                                                <p className="text-xs text-gray-400 font-mono">{e.employee_code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">{e.department}</td>
                                    <td className="px-4 py-3 text-center text-xs font-bold text-emerald-700">{e.present}</td>
                                    <td className="px-4 py-3 text-center text-xs font-bold text-red-600">{e.absent}</td>
                                    <td className="px-4 py-3 text-center text-xs font-bold text-amber-600">{e.late}</td>
                                    <td className="px-4 py-3 text-center text-xs text-blue-700">{e.half_day}</td>
                                    <td className="px-4 py-3 text-center text-xs text-purple-700">{e.on_leave}</td>
                                    <td className="px-4 py-3 text-center text-xs tabular-nums text-gray-700">{e.total_work_hours}h</td>
                                    <td className="px-4 py-3 text-center text-xs tabular-nums text-purple-700">{e.total_overtime_hrs > 0 ? `${e.total_overtime_hrs}h` : "—"}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 justify-center">
                                            <div className="w-16 h-1.5 bg-surface-200 rounded-full overflow-hidden">
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
    const { user, loading: authLoading } = useAuth();
    const [tab, setTab] = useState<"daily" | "summary">("daily");
    const [shifts, setShifts] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);

    useEffect(() => {
        Promise.all([
            fetch("/api/hr/shifts").then((r) => r.json()),
            fetch("/api/hr/departments?pageSize=100").then((r) => r.json()),
        ]).then(([sh, dp]) => {
            if (sh.success) setShifts(sh.data);
            if (dp.success) setDepartments(dp.data);
        });
    }, []);

    return (
        <>
            <Header title="Attendance" subtitle="Human Resources Module"
                actions={
                    <div className="flex items-center gap-1 p-1 bg-surface-100 border border-surface-300 rounded-xl">
                        {([["daily", "Daily Log", Clock], ["summary", "Monthly Summary", BarChart3]] as const).map(([id, label, Icon]) => (
                            <button key={id} onClick={() => setTab(id)}
                                className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                    tab === id ? "bg-white shadow-sm text-gray-900 border border-surface-300" : "text-gray-500 hover:text-gray-700")}>
                                <Icon className="w-3.5 h-3.5" />{label}
                            </button>
                        ))}
                    </div>
                }
            />
            <PageWrapper>
                {tab === "daily" && <DailyLog shifts={shifts} departments={departments} />}
                {tab === "summary" && <MonthlySummary departments={departments} />}
            </PageWrapper>
        </>
    );
}