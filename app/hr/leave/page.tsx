"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, ThumbsUp, ThumbsDown, X as Cancel, Calendar,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatDate } from "@/components/ui";
import {
  Drawer, DrawerFooter, ErrorBanner, SuccessBanner,
  AccessDeniedBanner, AuthStrip, FieldError, StatusActionButton,
} from "@/components/hr/Hrdrawer";
import { useAuth } from "@/hooks/useAuth";
import type { LeaveRequest, LeaveStatus, LeaveType, Employee } from "@/types";
import { clsx } from "clsx";

// ── Constants ──────────────────────────────────────────────────────────────────

const LEAVE_TYPES: { value: LeaveType; label: string; color: string }[] = [
  { value: "annual", label: "Annual Leave", color: "bg-blue-50 text-blue-700" },
  { value: "sick", label: "Sick Leave", color: "bg-red-50 text-red-700" },
  { value: "maternity", label: "Maternity Leave", color: "bg-pink-50 text-pink-700" },
  { value: "paternity", label: "Paternity Leave", color: "bg-indigo-50 text-indigo-700" },
  { value: "unpaid", label: "Unpaid Leave", color: "bg-gray-100 text-gray-600" },
];

const LEAVE_STATUS_ACTIONS: {
  status: LeaveStatus; label: string; icon: React.ElementType; color: string;
  from: LeaveStatus[]; perm: "edit" | "approve" | "full";
}[] = [
    { status: "approved", label: "Approve Request", icon: ThumbsUp, color: "text-green-600", from: ["pending"], perm: "approve" },
    { status: "rejected", label: "Reject Request", icon: ThumbsDown, color: "text-red-600", from: ["pending"], perm: "approve" },
    { status: "cancelled", label: "Cancel Request", icon: Cancel, color: "text-gray-600", from: ["pending", "approved"], perm: "edit" },
  ];

// ── Form ───────────────────────────────────────────────────────────────────────

interface FormFields {
  employee_id: string;
  leave_type: LeaveType | "";
  start_date: string;
  end_date: string;
  reason: string;
  days_count: string;
}
interface FormErrors {
  employee_id?: string;
  leave_type?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  days_count?: string;
}

const today = () => new Date().toISOString().split("T")[0];
const EMPTY_FORM: FormFields = { employee_id: "", leave_type: "", start_date: today(), end_date: "", reason: "", days_count: "" };

function validateLeave(f: FormFields): FormErrors {
  const e: FormErrors = {};
  if (!f.employee_id) e.employee_id = "Select an employee.";
  if (!f.leave_type) e.leave_type = "Select leave type.";
  if (!f.start_date) e.start_date = "Start date is required.";
  if (!f.end_date) e.end_date = "End date is required.";
  else if (f.end_date < f.start_date) e.end_date = "End date must be on or after start.";
  if (!f.reason?.trim()) e.reason = "Reason is required.";
  if (!f.days_count) e.days_count = "Days count required";
  return e;
}

// ── Days count preview ─────────────────────────────────────────────────────────

function DaysPreview({ start, end, days_count }: { start: string; end: string; days_count: string }) {
  if (!start || !end || end < start) return null;
  const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  days_count = days.toString();
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-50 border border-brand-200 text-xs">
      <Calendar className="w-3.5 h-3.5 text-brand-500" />
      <span className="text-brand-700 font-medium">{days} day{days !== 1 ? "s" : ""} of leave</span>
    </div>
  );
}

// ── Leave form body ────────────────────────────────────────────────────────────

function LeaveForm({ fields, errors, set, employees, mode, firstRef, readOnly }: {
  fields: FormFields; errors: FormErrors;
  set: (k: keyof FormFields, v: string) => void;
  employees: Employee[]; mode: "add" | "edit";
  firstRef?: React.Ref<HTMLSelectElement>; readOnly?: boolean;
}) {
  const ro = (extra?: string) => clsx("input", extra, readOnly && "opacity-60 cursor-not-allowed");
  return (
    <div className="space-y-5">
      {/* Employee */}
      <div>
        <label className="label">Employee <span className="text-red-500">*</span></label>
        <select ref={firstRef} value={fields.employee_id} onChange={(e) => set("employee_id", e.target.value)}
          disabled={readOnly || mode === "edit"} className={clsx("input", errors.employee_id && "border-red-400", (readOnly || mode === "edit") && "opacity-60 cursor-not-allowed")}>
          <option value="">— Select employee —</option>
          {employees.filter((e) => e.status !== "terminated").map((e) => (
            <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>
          ))}
        </select>
        {mode === "edit" && !readOnly && <p className="mt-1 text-xs text-gray-400">Employee cannot be changed.</p>}
        <FieldError message={errors.employee_id} />
      </div>

      {/* Leave type — card selector */}
      <div>
        <label className="label">Leave Type <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          {LEAVE_TYPES.map((lt) => (
            <button key={lt.value} type="button"
              onClick={() => !readOnly && set("leave_type", lt.value)}
              disabled={readOnly}
              className={clsx(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-all",
                fields.leave_type === lt.value
                  ? "border-brand-500 bg-brand-50 ring-1 ring-brand-400"
                  : "border-surface-400 bg-white hover:bg-surface-50",
                readOnly && "cursor-default"
              )}>
              <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", fields.leave_type === lt.value ? "bg-brand-500" : "bg-surface-400")} />
              <span className={clsx("text-xs font-medium", fields.leave_type === lt.value ? "text-brand-700" : "text-gray-700")}>{lt.label}</span>
            </button>
          ))}
        </div>
        <FieldError message={errors.leave_type} />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Start Date <span className="text-red-500">*</span></label>
          <input type="date" value={fields.start_date} onChange={(e) => set("start_date", e.target.value)}
            disabled={readOnly} className={ro(errors.start_date && "border-red-400")} />
          <FieldError message={errors.start_date} />
        </div>
        <div>
          <label className="label">End Date <span className="text-red-500">*</span></label>
          <input type="date" value={fields.end_date} onChange={(e) => set("end_date", e.target.value)}
            min={fields.start_date} disabled={readOnly} className={ro(errors.end_date && "border-red-400")} />
          <FieldError message={errors.end_date} />
        </div>
      </div>
      <DaysPreview start={fields.start_date} end={fields.end_date} days_count={fields.days_count}/>

      {/* Reason */}
      <div>
        <label className="label">Reason <span className="text-red-500">*</span></label>
        <textarea value={fields.reason} onChange={(e) => set("reason", e.target.value)}
          placeholder="Briefly explain the reason for this leave request…"
          rows={3} disabled={readOnly} className={clsx("input resize-none", errors.reason && "border-red-400", readOnly && "opacity-60 cursor-not-allowed")} />
        <FieldError message={errors.reason} />
      </div>
    </div>
  );
}

// ── Shared form state hook ─────────────────────────────────────────────────────

function useForm() {
  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const set = (k: keyof FormFields, v: string) => { setFields((p) => ({ ...p, [k]: v })); if (errors[k as keyof FormErrors]) setErrors((p) => ({ ...p, [k]: undefined })); };
  const reset = (f: FormFields) => { setFields(f); setErrors({}); setSubmitStatus("idle"); setServerError(""); };
  return { fields, errors, setErrors, set, reset, submitting, setSubmitting, submitStatus, setSubmitStatus, serverError, setServerError };
}

// ── Add Leave Drawer ───────────────────────────────────────────────────────────

function AddLeaveDrawer({ open, onClose, onSuccess, employees }: {
  open: boolean; onClose: () => void; onSuccess: (l: LeaveRequest) => void; employees: Employee[];
}) {
  const { can } = useAuth();
  const canCreate = can.create("hr");
  const form = useForm();
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (open) { form.reset({ ...EMPTY_FORM, start_date: today() }); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const errs = validateLeave(form.fields);
    if (Object.keys(errs).length) { form.setErrors(errs); return; }
    form.setSubmitting(true); form.setServerError("");
    try {
      const res = await fetch("/api/hr/leave", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.fields, reason: form.fields.reason.trim() }),
      });
      const data = await res.json();
      if (data.success) { form.setSubmitStatus("success"); onSuccess(data.data); setTimeout(onClose, 900); }
      else { form.setSubmitStatus("error"); form.setServerError(data.message || "Failed."); }
    } catch { form.setSubmitStatus("error"); form.setServerError("Network error."); }
    finally { form.setSubmitting(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Submit Leave Request" subtitle="New leave request for an employee" breadcrumb="New Leave Request">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate ? <AccessDeniedBanner action="submit leave requests" role="HR Manager" /> :
          <LeaveForm fields={form.fields} errors={form.errors} set={form.set} employees={employees} mode="add" firstRef={firstRef} />}
        {form.serverError && <ErrorBanner message={form.serverError} />}
        {form.submitStatus === "success" && <SuccessBanner message="Leave request submitted!" />}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSubmit} submitting={form.submitting} success={form.submitStatus === "success"} submitLabel="Submit Request" disabled={!canCreate} />
    </Drawer>
  );
}

// ── Edit Leave Drawer ──────────────────────────────────────────────────────────

function EditLeaveDrawer({ leave: lv, onClose, onSuccess, employees }: {
  leave: LeaveRequest | null; onClose: () => void; onSuccess: (l: LeaveRequest) => void; employees: Employee[];
}) {
  const open = !!lv;
  const { can } = useAuth();
  const canEdit = can.edit("hr");
  const canApprove = can.approve("hr");
  const form = useForm();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (lv) {
      form.reset({
        employee_id: lv.employee_id,
        leave_type: lv.leave_type,
        start_date: lv.start_date.split("T")[0],
        end_date: lv.end_date.split("T")[0],
        reason: lv.reason,
        days_count: lv.days_count.toString(),
      });
    }
  }, [lv]);

  const isEditable = lv?.status === "pending";
  const permMap = { edit: canEdit, approve: canApprove, full: canApprove };

  const handleSave = async () => {
    const errs = validateLeave(form.fields);
    if (Object.keys(errs).length || !lv) { form.setErrors(errs); return; }
    form.setSubmitting(true); form.setServerError("");
    try {
      const res = await fetch(`/api/hr/leave/${lv.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.fields, reason: form.fields.reason.trim() }),
      });
      const data = await res.json();
      if (data.success) { form.setSubmitStatus("success"); onSuccess(data.data); setTimeout(onClose, 900); }
      else { form.setSubmitStatus("error"); form.setServerError(data.message || "Update failed."); }
    } catch { form.setSubmitStatus("error"); form.setServerError("Network error."); }
    finally { form.setSubmitting(false); }
  };

  const handleAction = async (status: LeaveStatus) => {
    if (!lv) return;
    setActionLoading(status); form.setServerError("");
    try {
      const res = await fetch(`/api/hr/leave/${lv.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { onSuccess(data.data); setTimeout(onClose, 300); }
      else form.setServerError(data.message || "Action failed.");
    } catch { form.setServerError("Network error."); }
    finally { setActionLoading(null); }
  };

  const availableActions = LEAVE_STATUS_ACTIONS.filter((a) => lv && a.from.includes(lv.status as LeaveStatus));
  const leaveTypeMeta = LEAVE_TYPES.find((lt) => lt.value === lv?.leave_type);

  return (
    <Drawer open={open} onClose={onClose} title="Leave Request"
      subtitle={lv ? `${(lv as any).employees?.full_name} · ${lv.days_count} day(s)` : ""}
      breadcrumb="Edit Leave">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {lv && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-100 border border-surface-300">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-gray-600">Status:</span>
              <StatusBadge status={lv.status} />
              {leaveTypeMeta && (
                <span className={clsx("badge text-xs", leaveTypeMeta.color)}>{leaveTypeMeta.label}</span>
              )}
            </div>
            {lv.approved_at && (
              <span className="text-xs text-gray-400">Reviewed {formatDate(lv.approved_at)}</span>
            )}
          </div>
        )}
        {!canEdit && isEditable && <AccessDeniedBanner action="edit leave requests" role="HR Manager" />}
        <LeaveForm fields={form.fields} errors={form.errors} set={form.set} employees={employees} mode="edit" readOnly={!canEdit || !isEditable} />

        {availableActions.length > 0 && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
            {availableActions.map((action) => {
              const hasAccess = permMap[action.perm];
              return (
                <StatusActionButton key={action.status} label={action.label} icon={action.icon} colorClass={action.color}
                  onClick={() => handleAction(action.status)} loading={actionLoading === action.status}
                  restricted={!hasAccess} requiresRole="HR Manager" />
              );
            })}
          </div>
        )}
        {form.serverError && <ErrorBanner message={form.serverError} />}
        {form.submitStatus === "success" && <SuccessBanner message="Leave request updated!" />}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSave} submitting={form.submitting}
        success={form.submitStatus === "success"} submitLabel="Save Changes" disabled={!canEdit || !isEditable} />
    </Drawer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LeavePage() {
  const { can, user, loading: authLoading } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editLeave, setEditLeave] = useState<LeaveRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (statusFilter) p.set("status", statusFilter);
    if (typeFilter) p.set("leave_type", typeFilter);
    fetch(`/api/hr/leave?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setLeaves(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetch("/api/hr/employees?pageSize=200").then((r) => r.json()).then((res) => { if (res.success) setEmployees(res.data); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdded = (l: LeaveRequest) => { setLeaves((p) => [l, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (l: LeaveRequest) => { setLeaves((p) => p.map((x) => x.id === l.id ? l : x)); };

  // Filter by name client-side (API filters by employee_id not name)
  const visible = search
    ? leaves.filter((l) => (l as any).employees?.full_name?.toLowerCase().includes(search.toLowerCase()))
    : leaves;

  const counts = {
    pending: leaves.filter((l) => l.status === "pending").length,
    approved: leaves.filter((l) => l.status === "approved").length,
    total: leaves.reduce((s, l) => s + l.days_count, 0),
  };

  return (
    <>
      <Header title="Leave Requests" subtitle="Human Resources Module"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            {can.create("hr") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Request</button>}
          </div>
        }
      />
      <PageWrapper>
        {!authLoading && user && (
          <AuthStrip userName={user.full_name} userRole={user.role} permissions={[
            { label: "Submit", allowed: can.create("hr") },
            { label: "Edit", allowed: can.edit("hr") },
            { label: "Approve", allowed: can.approve("hr") },
          ]} />
        )}

        {!loading && leaves.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              ["Pending Review", counts.pending, "text-amber-700", "bg-amber-50 border-amber-200"],
              ["Approved", counts.approved, "text-green-700", "bg-green-50 border-green-200"],
              ["Total Days", counts.total, "text-brand-700", "bg-brand-50 border-brand-200"],
            ].map(([label, value, color, bg]) => (
              <div key={String(label)} className={clsx("rounded-xl border px-4 py-3 flex items-center justify-between", bg)}>
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <span className={clsx("text-2xl font-bold", color)}>{value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…" className="input pl-8 text-xs py-1.5" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Types</option>
            {LEAVE_TYPES.map((lt) => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Statuses</option>
            {["pending", "approved", "rejected", "cancelled"].map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>

        <SectionTitle title="Leave Requests" count={total} />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["Employee", "Leave Type", "Start Date", "End Date", "Days", "Reason", "Status", ""].map((h) => (
                    <th key={h} className={clsx("table-header px-4 py-3", h === "Days" ? "text-center" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8}><TableSkeleton rows={6} cols={8} /></td></tr>
                  : visible.length === 0 ? <tr><td colSpan={8}><EmptyState title="No leave requests" description="Submit the first leave request." action={can.create("hr") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Request</button> : undefined} /></td></tr>
                    : visible.map((lv) => {
                      const emp = (lv as any).employees;
                      const typeMeta = LEAVE_TYPES.find((lt) => lt.value === lv.leave_type);
                      const isOverlap = new Date(lv.start_date) <= new Date() && new Date(lv.end_date) >= new Date() && lv.status === "approved";
                      return (
                        <tr key={lv.id} onClick={() => setEditLeave(lv)} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{emp?.full_name || "—"}</p>
                            <p className="text-xs text-gray-500 font-mono">{emp?.employee_code}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={clsx("badge text-xs", typeMeta?.color || "bg-gray-100 text-gray-600")}>{typeMeta?.label || lv.leave_type}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(lv.start_date)}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(lv.end_date)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={clsx("inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                              isOverlap ? "bg-amber-100 text-amber-700" : "bg-surface-200 text-gray-700")}>
                              {lv.days_count}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">{lv.reason}</td>
                          <td className="px-4 py-3"><StatusBadge status={lv.status} /></td>
                          <td className="px-4 py-3"><Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" /></td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>
      <AddLeaveDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} employees={employees} />
      <EditLeaveDrawer leave={editLeave} onClose={() => setEditLeave(null)} onSuccess={handleUpdated} employees={employees} />
    </>
  );
}