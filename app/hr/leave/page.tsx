"use client";
/**
 * app/hr/leave/page.tsx
 *
 * HR managers see all employees' leave requests with full management.
 * Employees (role="employee") see only their own requests and can
 * submit / edit pending ones before approval.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, X, AlertCircle,
  CheckCircle2, Loader2, Shield, Calendar, Clock,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatDate } from "@/components/ui";
import {
  Drawer, DrawerFooter, ErrorBanner, SuccessBanner,
  AccessDeniedBanner, AuthStrip, FieldError, StatusActionButton,
} from "@/components/hr/Hrdrawer";
import { useAuth } from "@/hooks/useAuth";
import type { LeaveRequest, Employee } from "@/types";
import { clsx } from "clsx";

type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
type LeaveType = "annual" | "sick" | "maternity" | "paternity" | "unpaid";

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
];

const STATUS_META: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-600 border-red-200" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full border", m.cls)}>{m.label}</span>;
}

const today = () => new Date().toISOString().split("T")[0];

interface FormFields {
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
}
interface FormErrors {
  employee_id?: string; leave_type?: string;
  start_date?: string; end_date?: string; reason?: string;
}

function validate(f: FormFields, isEmployee: boolean): FormErrors {
  const e: FormErrors = {};
  if (!isEmployee && !f.employee_id) e.employee_id = "Select an employee.";
  if (!f.leave_type) e.leave_type = "Select a leave type.";
  if (!f.start_date) e.start_date = "Start date is required.";
  if (!f.end_date) e.end_date = "End date is required.";
  else if (f.end_date < f.start_date) e.end_date = "End must be on or after start.";
  if (!f.reason?.trim()) e.reason = "Reason is required.";
  return e;
}

function dayCount(s: string, e: string): number {
  if (!s || !e || e < s) return 0;
  return Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// ── Add / Edit drawer ─────────────────────────────────────────────────────────
function LeaveDrawer({ open, mode, request, isEmployee, myEmployeeId, employees, onClose, onSuccess }: {
  open: boolean;
  mode: "add" | "edit";
  request?: LeaveRequest | null;
  isEmployee: boolean;
  myEmployeeId: string | null;
  employees: Employee[];
  onClose: () => void;
  onSuccess: (r: LeaveRequest) => void;
}) {
  const EMPTY: FormFields = {
    employee_id: isEmployee ? (myEmployeeId ?? "") : "",
    leave_type: "annual",
    start_date: today(),
    end_date: today(),
    reason: "",
  };

  const [fields, setFields] = useState<FormFields>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && request) {
        setFields({
          employee_id: request.employee_id,
          leave_type: request.leave_type as LeaveType,
          start_date: request.start_date,
          end_date: request.end_date,
          reason: request.reason,
        });
      } else {
        setFields({ ...EMPTY, employee_id: isEmployee ? (myEmployeeId || "") : "" });
      }
      setErrors({}); setOk(false); setErr("");
      setTimeout(() => firstRef.current?.focus(), 120);
    }
  }, [open, mode, request]);

  const set = (k: keyof FormFields, v: string) => {
    setFields((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const handleSubmit = async () => {
    const errs = validate(fields, isEmployee);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setBusy(true); setErr("");
    try {
      const url = mode === "add" ? "/api/hr/leave" : `/api/hr/leave/${request!.id}`;
      const method = mode === "add" ? "POST" : "PUT";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.success) { setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else setErr(data.message || "Failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  const days = dayCount(fields.start_date, fields.end_date);

  return (
    <Drawer open={open} onClose={onClose}
      title={mode === "add" ? "Request Leave" : "Edit Leave Request"}
      subtitle={mode === "edit" ? `Editing pending request` : "Submit a new leave request"}
      breadcrumb={mode === "add" ? "New Request" : "Edit Request"}>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {isEmployee && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50 border border-brand-200 text-xs text-brand-700">
            <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>You can edit this request any time before it is approved or rejected by HR.</span>
          </div>
        )}

        {/* Employee selector — HR only */}
        {!isEmployee && (
          <div>
            <label className="label">Employee <span className="text-red-500">*</span></label>
            <select ref={firstRef} value={fields.employee_id} onChange={(e) => set("employee_id", e.target.value)}
              disabled={mode === "edit"}
              className={clsx("input", errors.employee_id && "border-red-400", mode === "edit" && "opacity-60 cursor-not-allowed")}>
              <option value="">— Select employee —</option>
              {employees.filter((e) => e.status !== "terminated").map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} · {e.employee_code}</option>
              ))}
            </select>
            {mode === "edit" && <p className="mt-1 text-xs text-gray-400">Employee cannot be changed.</p>}
            <FieldError message={errors.employee_id} />
          </div>
        )}


        {/* Leave type */}
        <div>
          <label className="label">Leave Type <span className="text-red-500">*</span></label>
          <select value={fields.leave_type} onChange={(e) => set("leave_type", e.target.value as LeaveType)}
            className={clsx("input", errors.leave_type && "border-red-400")}>
            {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <FieldError message={errors.leave_type} />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start Date <span className="text-red-500">*</span></label>
            <input type="date" value={fields.start_date} onChange={(e) => set("start_date", e.target.value)}
              className={clsx("input", errors.start_date && "border-red-400")} />
            <FieldError message={errors.start_date} />
          </div>
          <div>
            <label className="label">End Date <span className="text-red-500">*</span></label>
            <input type="date" value={fields.end_date} min={fields.start_date}
              onChange={(e) => set("end_date", e.target.value)}
              className={clsx("input", errors.end_date && "border-red-400")} />
            <FieldError message={errors.end_date} />
          </div>
        </div>

        {/* Days preview */}
        {days > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300 text-xs text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-brand-500" />
            <span><strong className="text-gray-900">{days}</strong> calendar day{days > 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="label">Reason <span className="text-red-500">*</span></label>
          <textarea value={fields.reason} onChange={(e) => set("reason", e.target.value)} rows={3}
            placeholder="Please describe the reason for your leave request…"
            className={clsx("input resize-none", errors.reason && "border-red-400")} />
          <FieldError message={errors.reason} />
        </div>

        {err && <ErrorBanner message={err} />}
        {ok && <SuccessBanner message={mode === "add" ? "Leave request submitted!" : "Request updated!"} />}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSubmit} submitting={busy}
        success={ok} submitLabel={mode === "add" ? "Submit Request" : "Save Changes"} />
    </Drawer>
  );
}

// ── HR action drawer (approve/reject) ─────────────────────────────────────────
function ActionDrawer({ request, onClose, onSuccess }: {
  request: LeaveRequest | null;
  onClose: () => void;
  onSuccess: (r: LeaveRequest) => void;
}) {
  const open = !!request;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const transition = async (status: LeaveStatus) => {
    if (!request) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/hr/leave/${request.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { onSuccess(data.data); onClose(); }
      else setErr(data.message || "Failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Review Leave Request"
      subtitle={request?.employees ? `${request?.employees.employee_code} · ${request?.employees.full_name}` : ""} breadcrumb="Review">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {request && (
          <>
            <div className="space-y-3 p-4 rounded-xl bg-surface-100 border border-surface-300">
              {[
                ["Employee", request.employees?.full_name || "—"],
                ["Department", request.employees?.departments?.name || "—"],
                ["Leave Type", LEAVE_TYPES.find((t) => t.value === request.leave_type)?.label || request.leave_type],
                ["Dates", `${formatDate(request.start_date)} → ${formatDate(request.end_date)}`],
                ["Duration", `${request.days_count} day${request.days_count > 1 ? "s" : ""}`],
                ["Status", <LeaveStatusBadge key="s" status={request.status as LeaveStatus} />],
                ["Reason", request.reason],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex gap-3 text-sm">
                  <span className="w-28 text-xs font-medium text-gray-400 flex-shrink-0 pt-0.5">{label}</span>
                  <span className="text-gray-900">{value}</span>
                </div>
              ))}
            </div>

            {request.status === "pending" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
                <button onClick={() => transition("approved")} disabled={busy}
                  className="w-full btn-primary justify-center py-2.5">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Approve Leave
                </button>
                <button onClick={() => transition("rejected")} disabled={busy}
                  className="w-full btn-secondary justify-center py-2.5 text-red-600 border-red-200 hover:bg-red-50">
                  Reject Leave
                </button>
                <button onClick={() => transition("cancelled")} disabled={busy}
                  className="w-full btn-secondary justify-center py-2.5 text-gray-500">
                  Cancel Request
                </button>
              </div>
            )}

            {request.status === "approved" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
                <button onClick={() => transition("cancelled")} disabled={busy}
                  className="w-full btn-secondary justify-center py-2.5 text-red-600 border-red-200 hover:bg-red-50">
                  Cancel Approved Leave
                </button>
              </div>
            )}
          </>
        )}
        {err && <ErrorBanner message={err} />}
      </div>
      <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex justify-end">
        <button onClick={onClose} className="btn-secondary">Close</button>
      </div>
    </Drawer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeavePage() {
  const { user, role, can, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editRequest, setEditRequest] = useState<LeaveRequest | null>(null);
  const [viewRequest, setViewRequest] = useState<LeaveRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [myEmpId, setMyEmpId] = useState<string | null>(null);

  const isHR = role && ["super_admin", "hr_manager"].includes(role);
  const isEmployee = role === "employee";

  const drawerOpen = (addOpen || !!editRequest) && (!isEmployee || myEmpId !== null);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (isHR && statusFilter) p.set("status", statusFilter);
    if (isHR && typeFilter) p.set("leave_type", typeFilter);
    fetch(`/api/hr/leave?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setRequests(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter, isHR]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isHR) {
      fetch("/api/hr/employees?pageSize=300")
        .then((r) => r.json()).then((res) => { if (res.success) setEmployees(res.data); });
    }
    // For employees: find their own employee_id
    if (user?.email) {
      fetch(`/api/hr/employees?search=${encodeURIComponent(user.email)}&pageSize=1`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data[0]) setMyEmpId(res.data[0].id);
        });
    }
  }, [isHR, user]);

  const handleAdded = (r: LeaveRequest) => { setRequests((p) => [r, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (r: LeaveRequest) => { setRequests((p) => p.map((x) => x.id === r.id ? r : x)); };

  const visible = requests.filter((r) => {
    if (!search) return true;
    const empName = (r as any).employees?.full_name?.toLowerCase() || "";
    return empName.includes(search.toLowerCase());
  });

  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
  };

  return (
    <>
      <Header title={isEmployee ? "My Leave Requests" : "Leave Management"} subtitle="Human Resources Module"
        actions={
          <div className="flex items-center gap-2">
            {isHR && (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search employee…" className="input pl-8 text-xs py-1.5 w-40" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
                  <option value="">All Statuses</option>
                  {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                </select>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
                  <option value="">All Types</option>
                  {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </>
            )}
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAddOpen(true)} className="btn-primary">
              <Plus className="w-3.5 h-3.5" />{isEmployee ? "Request Leave" : "Add Request"}
            </button>
          </div>
        }
      />

      <PageWrapper>
        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600">{counts.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-200" />
            </div>
            <div className="card px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{isEmployee ? "Approved" : "Currently Approved"}</p>
                <p className="text-2xl font-bold text-emerald-600">{counts.approved}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-200" />
            </div>
          </div>
        )}

        <SectionTitle title={isEmployee ? "My Requests" : "Leave Requests"} count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {(isHR
                    ? ["Employee", "Type", "Dates", "Days", "Reason", "Status", ""]
                    : ["Type", "Dates", "Days", "Reason", "Status", ""]
                  ).map((h) => (
                    <th key={h} className="table-header px-4 py-3 text-left text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isHR ? 7 : 6}><TableSkeleton rows={5} cols={isHR ? 7 : 6} /></td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={isHR ? 7 : 6}>
                    <EmptyState title="No leave requests"
                      description={isEmployee ? "Submit your first leave request." : "No requests match your filters."}
                      action={<button onClick={() => setAddOpen(true)} className="btn-primary">
                        <Plus className="w-3.5 h-3.5" />{isEmployee ? "Request Leave" : "Add Request"}
                      </button>} />
                  </td></tr>
                ) : visible.map((r) => {
                  const emp = (r as any).employees;
                  const isPending = r.status === "pending";
                  const canEdit = isEmployee && isPending;

                  return (
                    <tr key={r.id}
                      onClick={() => isHR ? setViewRequest(r) : (canEdit ? setEditRequest(r) : null)}
                      className={clsx("border-b border-surface-200 transition-colors group",
                        (isHR || canEdit) ? "hover:bg-surface-50 cursor-pointer" : "")}>
                      {isHR && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 flex-shrink-0 overflow-hidden">
                              {emp?.photo_url
                                ? <img src={emp.photo_url} alt="" className="w-full h-full object-cover" />
                                : emp?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-900">{emp?.full_name}</p>
                              <p className="text-xs text-gray-400">{(emp as any)?.departments?.name}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-gray-700 font-medium">
                        {LEAVE_TYPES.find((t) => t.value === r.leave_type)?.label || r.leave_type}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <p>{formatDate(r.start_date)}</p>
                        <p className="text-gray-400">to {formatDate(r.end_date)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-900 text-center">{r.days_count}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="px-4 py-3">
                        <LeaveStatusBadge status={r.status as LeaveStatus} />
                      </td>
                      <td className="px-4 py-3">
                        {(isHR || canEdit) && (
                          <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" />
                        )}
                        {isEmployee && !canEdit && isPending === false && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>

      {/* Add / employee-edit drawer */}
      <LeaveDrawer
        open={drawerOpen}
        mode={editRequest ? "edit" : "add"}
        request={editRequest}
        isEmployee={!!isEmployee}
        myEmployeeId={myEmpId}
        employees={employees}
        onClose={() => { setAddOpen(false); setEditRequest(null); }}
        onSuccess={(r) => { editRequest ? handleUpdated(r) : handleAdded(r); }}
      />

      {/* HR review drawer */}
      {isHR && (
        <ActionDrawer
          request={viewRequest}
          onClose={() => setViewRequest(null)}
          onSuccess={handleUpdated}
        />
      )}
    </>
  );
}