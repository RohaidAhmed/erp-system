"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, ThumbsUp, Banknote, Ban, Lock,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import {
  Drawer, DrawerFooter, ErrorBanner, SuccessBanner,
  AccessDeniedBanner, AuthStrip, FieldError, StatusActionButton,
} from "@/components/hr/Hrdrawer";
import { useAuth } from "@/hooks/useAuth";
import type { Payroll, Employee, Currency } from "@/types";
import { clsx } from "clsx";

type PayrollStatus = "draft" | "approved" | "disbursed" | "voided";

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR", "AED"];

// ── Helpers ────────────────────────────────────────────────────────────────────

const firstOfMonth = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split("T")[0];
};
const lastOfMonth = () => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  return d.toISOString().split("T")[0];
};

// ── Form ───────────────────────────────────────────────────────────────────────

interface FormFields {
  employee_id: string;
  period_start: string;
  period_end: string;
  gross_salary: string;
  deductions: string;
  tax_amount: string;
  currency: Currency;
}
interface FormErrors {
  employee_id?: string;
  period_start?: string;
  period_end?: string;
  gross_salary?: string;
  net?: string;
}

const EMPTY_FORM: FormFields = {
  employee_id: "", period_start: firstOfMonth(), period_end: lastOfMonth(),
  gross_salary: "", deductions: "0", tax_amount: "0", currency: "USD",
};

function validatePayroll(f: FormFields): FormErrors {
  const e: FormErrors = {};
  if (!f.employee_id) e.employee_id = "Select an employee.";
  if (!f.period_start) e.period_start = "Period start is required.";
  if (!f.period_end) e.period_end = "Period end is required.";
  else if (f.period_end < f.period_start) e.period_end = "End must be after start.";
  const gross = parseFloat(f.gross_salary);
  if (!f.gross_salary || isNaN(gross) || gross <= 0) e.gross_salary = "Enter a valid gross salary.";
  else {
    const ded = parseFloat(f.deductions || "0");
    const tax = parseFloat(f.tax_amount || "0");
    if (gross - ded - tax < 0) e.net = "Net salary cannot be negative. Reduce deductions/tax.";
  }
  return e;
}

// ── Computed net preview ───────────────────────────────────────────────────────

function NetPreview({ fields }: { fields: FormFields }) {
  const gross = parseFloat(fields.gross_salary || "0");
  const ded = parseFloat(fields.deductions || "0");
  const tax = parseFloat(fields.tax_amount || "0");
  const net = gross - ded - tax;
  if (!gross) return null;
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-50 overflow-hidden">
      {[["Gross Salary", gross], ["Deductions", -ded], ["Tax", -tax]].map(([label, val]) => (
        <div key={String(label)} className="px-4 py-2.5 flex justify-between text-xs text-gray-600 border-b border-surface-200 last:border-0">
          <span>{label}</span>
          <span className={clsx("tabular-nums", Number(val) < 0 ? "text-red-600" : "")}>
            {Number(val) < 0 ? `- ${formatCurrency(Math.abs(Number(val)), fields.currency)}` : formatCurrency(Number(val), fields.currency)}
          </span>
        </div>
      ))}
      <div className="px-4 py-3 flex justify-between text-sm font-bold text-gray-900 bg-surface-100">
        <span>Net Salary</span>
        <span className={clsx("tabular-nums", net < 0 ? "text-red-600" : "text-emerald-700")}>{formatCurrency(net, fields.currency)}</span>
      </div>
    </div>
  );
}

// ── Payroll form body ──────────────────────────────────────────────────────────

function PayrollForm({ fields, errors, set, employees, mode, firstRef, readOnly }: {
  fields: FormFields; errors: FormErrors;
  set: (k: keyof FormFields, v: string) => void;
  employees: Employee[]; mode: "add" | "edit";
  firstRef?: React.Ref<HTMLSelectElement>; readOnly?: boolean;
}) {
  const ro = (extra?: string) => clsx("input", extra, readOnly && "opacity-60 cursor-not-allowed");
  return (
    <div className="space-y-5">
      <div>
        <label className="label">Employee <span className="text-red-500">*</span></label>
        <select ref={firstRef} value={fields.employee_id} onChange={(e) => set("employee_id", e.target.value)}
          disabled={readOnly || mode === "edit"} className={clsx("input", errors.employee_id && "border-red-400", (readOnly || mode === "edit") && "opacity-60 cursor-not-allowed")}>
          <option value="">— Select employee —</option>
          {employees.filter((e) => e.status !== "terminated").map((e) => (
            <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name} ({e.position})</option>
          ))}
        </select>
        {mode === "edit" && !readOnly && <p className="mt-1 text-xs text-gray-400">Employee cannot be changed.</p>}
        <FieldError message={errors.employee_id} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Period Start <span className="text-red-500">*</span></label>
          <input type="date" value={fields.period_start} onChange={(e) => set("period_start", e.target.value)}
            disabled={readOnly} className={ro(errors.period_start && "border-red-400")} />
          <FieldError message={errors.period_start} />
        </div>
        <div>
          <label className="label">Period End <span className="text-red-500">*</span></label>
          <input type="date" value={fields.period_end} onChange={(e) => set("period_end", e.target.value)}
            min={fields.period_start} disabled={readOnly} className={ro(errors.period_end && "border-red-400")} />
          <FieldError message={errors.period_end} />
        </div>
      </div>
      <div>
        <label className="label">Currency</label>
        <select value={fields.currency} onChange={(e) => set("currency", e.target.value)} disabled={readOnly} className={ro()}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Gross Salary <span className="text-red-500">*</span></label>
        <input type="number" min="0" step="0.01" value={fields.gross_salary} onChange={(e) => set("gross_salary", e.target.value)}
          placeholder="0.00" disabled={readOnly} className={ro(`tabular-nums ${errors.gross_salary ? "border-red-400" : ""}`)} />
        <FieldError message={errors.gross_salary} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Deductions</label>
          <input type="number" min="0" step="0.01" value={fields.deductions} onChange={(e) => set("deductions", e.target.value)}
            placeholder="0.00" disabled={readOnly} className={ro("tabular-nums")} />
        </div>
        <div>
          <label className="label">Tax Amount</label>
          <input type="number" min="0" step="0.01" value={fields.tax_amount} onChange={(e) => set("tax_amount", e.target.value)}
            placeholder="0.00" disabled={readOnly} className={ro("tabular-nums")} />
        </div>
      </div>
      {errors.net && <FieldError message={errors.net} />}
      <NetPreview fields={fields} />
    </div>
  );
}

// ── Drawer state hook ──────────────────────────────────────────────────────────

function useForm(init: FormFields) {
  const [fields, setFields] = useState(init);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const set = (k: keyof FormFields, v: string) => { setFields((p) => ({ ...p, [k]: v })); if (errors[k as keyof FormErrors]) setErrors((p) => ({ ...p, [k]: undefined })); };
  const reset = (f: FormFields) => { setFields(f); setErrors({}); setSubmitStatus("idle"); setServerError(""); };
  return { fields, errors, setErrors, set, reset, submitting, setSubmitting, submitStatus, setSubmitStatus, serverError, setServerError };
}

// ── Add Payroll Drawer ─────────────────────────────────────────────────────────

function AddPayrollDrawer({ open, onClose, onSuccess, employees }: {
  open: boolean; onClose: () => void; onSuccess: (p: Payroll) => void; employees: Employee[];
}) {
  const { can } = useAuth();
  const canCreate = can.create("hr");
  const form = useForm(EMPTY_FORM);
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (open) { form.reset({ ...EMPTY_FORM, period_start: firstOfMonth(), period_end: lastOfMonth() }); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const errs = validatePayroll(form.fields);
    if (Object.keys(errs).length) { form.setErrors(errs); return; }
    form.setSubmitting(true); form.setServerError("");
    try {
      const res = await fetch("/api/hr/payroll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.fields, gross_salary: parseFloat(form.fields.gross_salary), deductions: parseFloat(form.fields.deductions || "0"), tax_amount: parseFloat(form.fields.tax_amount || "0") }),
      });
      const data = await res.json();
      if (data.success) { form.setSubmitStatus("success"); onSuccess(data.data); setTimeout(onClose, 900); }
      else { form.setSubmitStatus("error"); form.setServerError(data.message || "Failed."); }
    } catch { form.setSubmitStatus("error"); form.setServerError("Network error."); }
    finally { form.setSubmitting(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Create Payroll" subtitle="New payroll record for an employee" breadcrumb="New Payroll">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate ? <AccessDeniedBanner action="create payroll" role="HR Manager" /> :
          <PayrollForm fields={form.fields} errors={form.errors} set={form.set} employees={employees} mode="add" firstRef={firstRef} />}
        {form.serverError && <ErrorBanner message={form.serverError} />}
        {form.submitStatus === "success" && <SuccessBanner message="Payroll record created!" />}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSubmit} submitting={form.submitting} success={form.submitStatus === "success"} submitLabel="Create Payroll" disabled={!canCreate} />
    </Drawer>
  );
}

// ── Edit Payroll Drawer ────────────────────────────────────────────────────────

const STATUS_ACTIONS_PAYROLL: { status: PayrollStatus; label: string; icon: React.ElementType; color: string; from: PayrollStatus[]; perm: "edit" | "approve" | "full" }[] = [
  { status: "approved", label: "Approve Payroll", icon: ThumbsUp, color: "text-green-600", from: ["draft"], perm: "approve" },
  { status: "disbursed", label: "Mark as Disbursed", icon: Banknote, color: "text-emerald-600", from: ["approved"], perm: "full" },
  { status: "voided", label: "Void Payroll", icon: Ban, color: "text-red-600", from: ["draft", "approved"], perm: "full" },
];

function EditPayrollDrawer({ payroll: pr, onClose, onSuccess, employees }: {
  payroll: Payroll | null; onClose: () => void; onSuccess: (p: Payroll) => void; employees: Employee[];
}) {
  const open = !!pr;
  const { can } = useAuth();
  const canEdit = can.edit("hr");
  const canApprove = can.approve("hr");
  const canFull = can.full("hr");
  const form = useForm(EMPTY_FORM);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmVoid, setConfirmVoid] = useState(false);

  useEffect(() => {
    if (pr) {
      form.reset({
        employee_id: pr.employee_id,
        period_start: pr.period_start.split("T")[0],
        period_end: pr.period_end.split("T")[0],
        gross_salary: String(pr.gross_salary),
        deductions: String(pr.deductions),
        tax_amount: String(pr.tax_amount),
        currency: pr.currency,
      });
      setConfirmVoid(false);
    }
  }, [pr]);

  const isEditable = pr?.status === "draft";
  const permMap = { edit: canEdit, approve: canApprove, full: canFull };

  const handleSave = async () => {
    const errs = validatePayroll(form.fields);
    if (Object.keys(errs).length || !pr) { form.setErrors(errs); return; }
    form.setSubmitting(true); form.setServerError("");
    try {
      const res = await fetch(`/api/hr/payroll/${pr.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.fields, gross_salary: parseFloat(form.fields.gross_salary), deductions: parseFloat(form.fields.deductions || "0"), tax_amount: parseFloat(form.fields.tax_amount || "0") }),
      });
      const data = await res.json();
      if (data.success) { form.setSubmitStatus("success"); onSuccess(data.data); setTimeout(onClose, 900); }
      else { form.setSubmitStatus("error"); form.setServerError(data.message || "Update failed."); }
    } catch { form.setSubmitStatus("error"); form.setServerError("Network error."); }
    finally { form.setSubmitting(false); }
  };

  const handleAction = async (status: PayrollStatus) => {
    if (!pr) return;
    setActionLoading(status); form.setServerError("");
    try {
      const res = await fetch(`/api/hr/payroll/${pr.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { onSuccess(data.data); setTimeout(onClose, 300); }
      else form.setServerError(data.message || "Action failed.");
    } catch { form.setServerError("Network error."); }
    finally { setActionLoading(null); setConfirmVoid(false); }
  };

  const availableActions = STATUS_ACTIONS_PAYROLL.filter((a) => pr && a.from.includes(pr.status as PayrollStatus));

  return (
    <Drawer open={open} onClose={onClose} title="Edit Payroll" subtitle={pr ? `${(pr as any).employees?.employee_code} · ${(pr as any).employees?.full_name}` : ""} breadcrumb="Edit Payroll">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {pr && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-100 border border-surface-300">
            <div className="flex items-center gap-2 text-xs"><span className="font-medium text-gray-600">Status:</span><StatusBadge status={pr.status} /></div>
            {!isEditable && <span className="text-xs text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" /> {pr.status === "disbursed" || pr.status === "voided" ? "Read-only" : "Editable via actions only"}</span>}
          </div>
        )}
        {!canEdit && isEditable && <AccessDeniedBanner action="edit payroll" role="HR Manager" />}
        <PayrollForm fields={form.fields} errors={form.errors} set={form.set} employees={employees} mode="edit" readOnly={!canEdit || !isEditable} />

        {availableActions.length > 0 && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
            {availableActions.map((action) => {
              const hasAccess = permMap[action.perm];
              const isVoid = action.status === "voided";
              if (isVoid && !confirmVoid) {
                return (
                  <button key={action.status} onClick={() => hasAccess && setConfirmVoid(true)} disabled={!hasAccess}
                    className={clsx("flex items-center gap-2 text-xs font-medium transition-colors", hasAccess ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed")}>
                    <Ban className="w-3.5 h-3.5" /> Void this payroll
                    {!hasAccess && <span className="text-gray-400">(HR Manager required)</span>}
                  </button>
                );
              }
              if (isVoid && confirmVoid) {
                return (
                  <div key={action.status} className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                    <p className="text-xs text-red-700 font-medium">Void this payroll record? This cannot be undone.</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleAction("voided")} disabled={!!actionLoading} className="btn-danger text-xs py-1.5 px-3">
                        {actionLoading === "voided" ? "Voiding…" : <><Ban className="w-3 h-3" /> Confirm Void</>}
                      </button>
                      <button onClick={() => setConfirmVoid(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                    </div>
                  </div>
                );
              }
              return (
                <StatusActionButton key={action.status} label={action.label} icon={action.icon} colorClass={action.color}
                  onClick={() => handleAction(action.status)} loading={actionLoading === action.status}
                  restricted={!hasAccess} requiresRole="HR Manager / Admin" />
              );
            })}
          </div>
        )}
        {form.serverError && <ErrorBanner message={form.serverError} />}
        {form.submitStatus === "success" && <SuccessBanner message="Payroll updated!" />}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSave} submitting={form.submitting} success={form.submitStatus === "success"} submitLabel="Save Changes" disabled={!canEdit || !isEditable} />
    </Drawer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editPayroll, setEditPayroll] = useState<Payroll | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [empFilter, setEmpFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (statusFilter) p.set("status", statusFilter);
    if (empFilter) p.set("employee_id", empFilter);
    fetch(`/api/hr/payroll?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setPayrolls(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [statusFilter, empFilter]);

  useEffect(() => {
    fetch("/api/hr/employees?pageSize=200").then((r) => r.json()).then((res) => { if (res.success) setEmployees(res.data); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdded = (p: Payroll) => { setPayrolls((prev) => [p, ...prev]); setTotal((t) => t + 1); };
  const handleUpdated = (p: Payroll) => { setPayrolls((prev) => prev.map((x) => x.id === p.id ? p : x)); };

  const summary = {
    totalNet: payrolls.filter((p) => p.status !== "voided").reduce((s, p) => s + p.net_salary, 0),
    disbursed: payrolls.filter((p) => p.status === "disbursed").reduce((s, p) => s + p.net_salary, 0),
    pending: payrolls.filter((p) => ["draft", "approved"].includes(p.status)).reduce((s, p) => s + p.net_salary, 0),
  };

  return (
    <>
      <Header title="Payroll" subtitle="Human Resources Module"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            {can.create("hr") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> Create Payroll</button>}
          </div>
        }
      />
      <PageWrapper>
        {!authLoading && user && (
          <AuthStrip userName={user.full_name} userRole={user.role} permissions={[
            { label: "Create", allowed: can.create("hr") },
            { label: "Edit", allowed: can.edit("hr") },
            { label: "Approve", allowed: can.approve("hr") },
            { label: "Disburse/Void", allowed: can.full("hr") },
          ]} />
        )}
        {!loading && payrolls.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              ["Total Net (active)", summary.totalNet, "text-gray-900", "bg-white border-surface-300"],
              ["Disbursed", summary.disbursed, "text-emerald-700", "bg-emerald-50 border-emerald-200"],
              ["Pending", summary.pending, "text-blue-700", "bg-blue-50 border-blue-200"],
            ].map(([label, value, color, bg]) => (
              <div key={String(label)} className={clsx("rounded-xl border px-4 py-3 flex items-center justify-between", bg)}>
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <span className={clsx("text-lg font-bold tabular-nums", color)}>{formatCurrency(Number(value))}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Statuses</option>
            {["draft", "approved", "disbursed", "voided"].map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>)}
          </select>
        </div>
        <SectionTitle title="Payroll Records" count={total} />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["Employee", "Period", "Gross", "Deductions", "Tax", "Net Salary", "Status", ""].map((h) => (
                    <th key={h} className={clsx("table-header px-4 py-3", ["Gross", "Deductions", "Tax", "Net Salary"].includes(h) ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8}><TableSkeleton rows={6} cols={8} /></td></tr>
                  : payrolls.length === 0 ? <tr><td colSpan={8}><EmptyState title="No payroll records" description="Create the first payroll record." action={can.create("hr") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> Create Payroll</button> : undefined} /></td></tr>
                    : payrolls.map((pr) => {
                      const emp = (pr as any).employees;
                      return (
                        <tr key={pr.id} onClick={() => setEditPayroll(pr)} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{emp?.full_name || "—"}</p>
                            <p className="text-xs text-gray-500 font-mono">{emp?.employee_code}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <p>{formatDate(pr.period_start)}</p>
                            <p className="text-gray-400">to {formatDate(pr.period_end)}</p>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatCurrency(pr.gross_salary, pr.currency)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatCurrency(pr.deductions, pr.currency)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-orange-600">{formatCurrency(pr.tax_amount, pr.currency)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">{formatCurrency(pr.net_salary, pr.currency)}</td>
                          <td className="px-4 py-3"><StatusBadge status={pr.status} /></td>
                          <td className="px-4 py-3"><Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" /></td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>
      <AddPayrollDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} employees={employees} />
      <EditPayrollDrawer payroll={editPayroll} onClose={() => setEditPayroll(null)} onSuccess={handleUpdated} employees={employees} />
    </>
  );
}