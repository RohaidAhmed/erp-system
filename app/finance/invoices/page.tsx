"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, X, ChevronRight, AlertCircle, CheckCircle2,
  Loader2, Pencil, Ban, Send, ThumbsUp, DollarSign,
  Search, FileText, Lock,
} from "lucide-react";
import Header from "@/components/layout/Header";
import {
  PageWrapper, StatusBadge, TableSkeleton, EmptyState,
  SectionTitle, formatCurrency, formatDate,
} from "@/components/ui";
import type { Invoice, InvoiceStatus, Customer, Supplier, Currency } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { clsx } from "clsx";

// ── Constants ──────────────────────────────────────────────────────────────────

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR", "AED"];

const INVOICE_TYPES = [
  { value: "accounts_receivable", label: "Accounts Receivable (AR)", description: "Money owed to you by customers" },
  { value: "accounts_payable", label: "Accounts Payable (AP)", description: "Money you owe to suppliers" },
];

/** Which statuses can be manually moved to, and who can do it */
const STATUS_ACTIONS: {
  status: InvoiceStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  /** from statuses this action is available on */
  from: InvoiceStatus[];
  /** permission check key */
  perm: "canCreate" | "canEdit" | "canApprove" | "canVoid";
}[] = [
    { status: "sent", label: "Mark as Sent", icon: Send, color: "text-blue-600", from: ["draft"], perm: "canEdit" },
    { status: "approved", label: "Approve", icon: ThumbsUp, color: "text-green-600", from: ["sent"], perm: "canApprove" },
    { status: "paid", label: "Mark as Paid", icon: DollarSign, color: "text-emerald-600", from: ["approved", "overdue"], perm: "canApprove" },
    { status: "cancelled", label: "Void Invoice", icon: Ban, color: "text-red-600", from: ["draft", "sent", "approved", "overdue"], perm: "canVoid" },
  ];

// ── Form types ─────────────────────────────────────────────────────────────────

interface FormFields {
  invoice_number: string;
  type: string;
  amount: string;
  tax_amount: string;
  currency: Currency;
  issue_date: string;
  due_date: string;
  customer_id: string;
  supplier_id: string;
  notes: string;
}

interface FormErrors {
  invoice_number?: string;
  type?: string;
  amount?: string;
  issue_date?: string;
  due_date?: string;
  party?: string;
}

const today = () => new Date().toISOString().split("T")[0];
const EMPTY_FORM: FormFields = {
  invoice_number: "", type: "", amount: "", tax_amount: "0",
  currency: "USD", issue_date: today(), due_date: "", customer_id: "",
  supplier_id: "", notes: "",
};

// ── Shared drawer shell ────────────────────────────────────────────────────────

function Drawer({ open, onClose, title, subtitle, breadcrumb, children }: {
  open: boolean; onClose: () => void;
  title: string; subtitle: string; breadcrumb: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} className={clsx(
        "fixed inset-0 bg-black/30 z-40 transition-opacity duration-300",
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      )} />
      <div className={clsx(
        "fixed top-0 right-0 h-full w-[520px] bg-white shadow-2xl z-50 flex flex-col",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-surface-100 border-b border-surface-200 text-xs text-gray-500">
          <span>Finance</span><ChevronRight className="w-3 h-3" />
          <span>Invoices</span><ChevronRight className="w-3 h-3" />
          <span className="text-gray-700 font-medium">{breadcrumb}</span>
        </div>
        {children}
      </div>
    </>
  );
}

function DrawerFooter({ onCancel, onSubmit, submitting, success, submitLabel, disabled }: {
  onCancel: () => void; onSubmit: () => void;
  submitting: boolean; success: boolean; submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex items-center justify-between gap-3">
      <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required fields</p>
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="btn-secondary" disabled={submitting}>Cancel</button>
        <button
          onClick={onSubmit}
          disabled={submitting || success || disabled}
          className="btn-primary min-w-[140px] justify-center"
        >
          {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
            : success ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
              : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ── RBAC gate component ────────────────────────────────────────────────────────

function AccessDenied({ action }: { action: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
      <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">Permission required</p>
        <p className="text-xs text-amber-600 mt-0.5">
          Your role does not have access to <strong>{action}</strong>. Contact a Finance Manager or Super Admin.
        </p>
      </div>
    </div>
  );
}

// ── Invoice form body ──────────────────────────────────────────────────────────

interface FormBodyProps {
  fields: FormFields;
  errors: FormErrors;
  set: (k: keyof FormFields, v: string) => void;
  customers: Customer[];
  suppliers: Supplier[];
  mode: "add" | "edit";
  firstRef?: React.Ref<HTMLInputElement>;
  readOnly?: boolean;
}

function InvoiceFormBody({ fields, errors, set, customers, suppliers, mode, firstRef, readOnly }: FormBodyProps) {
  const isAR = fields.type === "accounts_receivable";
  const isAP = fields.type === "accounts_payable";

  const subtotal = parseFloat(fields.amount || "0");
  const tax = parseFloat(fields.tax_amount || "0");
  const total = subtotal + tax;

  return (
    <div className="space-y-5">
      {/* Invoice number + currency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Invoice Number <span className="text-red-500">*</span></label>
          <input
            ref={firstRef}
            type="text"
            value={fields.invoice_number}
            onChange={(e) => set("invoice_number", e.target.value)}
            placeholder="e.g. INV-2026-0001"
            disabled={readOnly || mode === "edit"}
            className={clsx(
              "input font-mono",
              errors.invoice_number && "border-red-400 focus:ring-red-400",
              (readOnly || mode === "edit") && "opacity-60 cursor-not-allowed bg-surface-200"
            )}
          />
          {mode === "edit" && !readOnly && (
            <p className="mt-1 text-xs text-gray-400">Invoice number cannot be changed.</p>
          )}
          {errors.invoice_number && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.invoice_number}</p>
          )}
        </div>
        <div>
          <label className="label">Currency</label>
          <select
            value={fields.currency}
            onChange={(e) => set("currency", e.target.value)}
            disabled={readOnly}
            className={clsx("input", readOnly && "opacity-60 cursor-not-allowed")}
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Invoice type */}
      <div>
        <label className="label">Invoice Type <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 gap-3">
          {INVOICE_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { if (!readOnly) { set("type", opt.value); set("customer_id", ""); set("supplier_id", ""); } }}
              disabled={readOnly}
              className={clsx(
                "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all duration-150",
                fields.type === opt.value
                  ? "border-brand-500 bg-brand-50 ring-1 ring-brand-400"
                  : "border-surface-400 bg-white hover:bg-surface-50",
                readOnly && "cursor-default"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className={clsx("text-xs font-semibold", fields.type === opt.value ? "text-brand-700" : "text-gray-700")}>
                  {opt.value === "accounts_receivable" ? "AR" : "AP"}
                </span>
                {fields.type === opt.value && <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />}
              </div>
              <p className={clsx("text-xs font-medium", fields.type === opt.value ? "text-brand-700" : "text-gray-700")}>
                {opt.label.split(" (")[0]}
              </p>
              <p className="text-xs text-gray-400">{opt.description}</p>
            </button>
          ))}
        </div>
        {errors.type && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.type}</p>}
      </div>

      {/* Customer / Supplier based on type */}
      {(isAR || isAP) && (
        <div>
          <label className="label">{isAR ? "Customer" : "Supplier"} <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
          {isAR ? (
            <select
              value={fields.customer_id}
              onChange={(e) => set("customer_id", e.target.value)}
              disabled={readOnly}
              className={clsx("input", readOnly && "opacity-60 cursor-not-allowed")}
            >
              <option value="">— Select customer —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>)}
            </select>
          ) : (
            <select
              value={fields.supplier_id}
              onChange={(e) => set("supplier_id", e.target.value)}
              disabled={readOnly}
              className={clsx("input", readOnly && "opacity-60 cursor-not-allowed")}
            >
              <option value="">— Select supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          )}
          {errors.party && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.party}</p>}
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Issue Date <span className="text-red-500">*</span></label>
          <input type="date" value={fields.issue_date} onChange={(e) => set("issue_date", e.target.value)}
            disabled={readOnly}
            className={clsx("input", errors.issue_date && "border-red-400", readOnly && "opacity-60 cursor-not-allowed")} />
          {errors.issue_date && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.issue_date}</p>}
        </div>
        <div>
          <label className="label">Due Date <span className="text-red-500">*</span></label>
          <input type="date" value={fields.due_date} onChange={(e) => set("due_date", e.target.value)}
            min={fields.issue_date}
            disabled={readOnly}
            className={clsx("input", errors.due_date && "border-red-400", readOnly && "opacity-60 cursor-not-allowed")} />
          {errors.due_date && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.due_date}</p>}
        </div>
      </div>

      {/* Amount + Tax */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Subtotal <span className="text-red-500">*</span></label>
          <input type="number" min="0" step="0.01" value={fields.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="0.00" disabled={readOnly}
            className={clsx("input tabular-nums", errors.amount && "border-red-400", readOnly && "opacity-60 cursor-not-allowed")} />
          {errors.amount && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.amount}</p>}
        </div>
        <div>
          <label className="label">Tax Amount <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
          <input type="number" min="0" step="0.01" value={fields.tax_amount}
            onChange={(e) => set("tax_amount", e.target.value)}
            placeholder="0.00" disabled={readOnly}
            className={clsx("input tabular-nums", readOnly && "opacity-60 cursor-not-allowed")} />
        </div>
      </div>

      {/* Total summary */}
      {(subtotal > 0 || tax > 0) && (
        <div className="rounded-xl border border-surface-300 bg-surface-50 overflow-hidden">
          <div className="px-4 py-2.5 flex justify-between text-xs text-gray-600 border-b border-surface-200">
            <span>Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal, fields.currency)}</span>
          </div>
          <div className="px-4 py-2.5 flex justify-between text-xs text-gray-600 border-b border-surface-200">
            <span>Tax</span><span className="tabular-nums">{formatCurrency(tax, fields.currency)}</span>
          </div>
          <div className="px-4 py-3 flex justify-between text-sm font-bold text-gray-900">
            <span>Total</span><span className="tabular-nums">{formatCurrency(total, fields.currency)}</span>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="label">Notes <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
        <textarea value={fields.notes} onChange={(e) => set("notes", e.target.value)}
          placeholder="Payment terms, references, or other notes…" rows={3}
          disabled={readOnly}
          className={clsx("input resize-none", readOnly && "opacity-60 cursor-not-allowed")} />
      </div>
    </div>
  );
}

// ── Add Invoice Drawer ─────────────────────────────────────────────────────────

interface AddDrawerProps {
  open: boolean; onClose: () => void; onSuccess: (inv: Invoice) => void;
  customers: Customer[]; suppliers: Supplier[];
}

function AddInvoiceDrawer({ open, onClose, onSuccess, customers, suppliers }: AddDrawerProps) {
  const { invoice } = useAuth();
  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFields({ ...EMPTY_FORM, issue_date: today() });
      setErrors({}); setSubmitStatus("idle"); setServerError("");
      setTimeout(() => firstRef.current?.focus(), 120);
    }
  }, [open]);

  const set = (k: keyof FormFields, v: string) => {
    setFields((p) => ({ ...p, [k]: v }));
    if (errors[k as keyof FormErrors]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!fields.invoice_number.trim()) e.invoice_number = "Invoice number is required.";
    if (!fields.type) e.type = "Select invoice type.";
    if (!fields.issue_date) e.issue_date = "Issue date is required.";
    if (!fields.due_date) e.due_date = "Due date is required.";
    else if (fields.due_date < fields.issue_date) e.due_date = "Due date must be on or after issue date.";
    const amt = parseFloat(fields.amount);
    if (!fields.amount || isNaN(amt) || amt <= 0) e.amount = "Enter a valid positive amount.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true); setServerError("");
    try {
      const res = await fetch("/api/finance/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_number: fields.invoice_number.trim(),
          type: fields.type,
          amount: parseFloat(fields.amount),
          tax_amount: parseFloat(fields.tax_amount || "0"),
          currency: fields.currency,
          issue_date: fields.issue_date,
          due_date: fields.due_date,
          customer_id: fields.customer_id || undefined,
          supplier_id: fields.supplier_id || undefined,
          notes: fields.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) { setSubmitStatus("success"); onSuccess(data.data); setTimeout(onClose, 900); }
      else { setSubmitStatus("error"); setServerError(data.message || "Failed to create invoice."); }
    } catch { setSubmitStatus("error"); setServerError("Network error."); }
    finally { setSubmitting(false); }
  };

  const canCreate = invoice.canCreate();

  return (
    <Drawer open={open} onClose={onClose} title="New Invoice" subtitle="Create a draft AR or AP invoice" breadcrumb="New Invoice">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate
          ? <AccessDenied action="create invoices" />
          : <>
            <InvoiceFormBody fields={fields} errors={errors} set={set}
              customers={customers} suppliers={suppliers} mode="add" firstRef={firstRef} />
            {serverError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <p className="text-sm text-red-700">{serverError}</p>
              </div>
            )}
            {submitStatus === "success" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="text-sm text-emerald-700 font-medium">Invoice created!</p>
              </div>
            )}
          </>
        }
      </div>
      <DrawerFooter
        onCancel={onClose} onSubmit={handleSubmit}
        submitting={submitting} success={submitStatus === "success"}
        submitLabel="Create Invoice" disabled={!canCreate}
      />
    </Drawer>
  );
}

// ── Edit Invoice Drawer ────────────────────────────────────────────────────────

interface EditDrawerProps {
  invoice: Invoice | null; onClose: () => void;
  onSuccess: (inv: Invoice) => void;
  customers: Customer[]; suppliers: Supplier[];
}

function EditInvoiceDrawer({ invoice: inv, onClose, onSuccess, customers, suppliers }: EditDrawerProps) {
  const open = !!inv;
  const { invoice: invPerms, role } = useAuth();
  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");

  // Status action state
  const [actionSubmitting, setActionSubmitting] = useState<string | null>(null);
  const [voidConfirm, setVoidConfirm] = useState(false);

  useEffect(() => {
    if (inv) {
      setFields({
        invoice_number: inv.invoice_number,
        type: inv.type,
        amount: String(inv.amount),
        tax_amount: String(inv.tax_amount),
        currency: inv.currency,
        issue_date: inv.issue_date.split("T")[0],
        due_date: inv.due_date.split("T")[0],
        customer_id: inv.customer_id || "",
        supplier_id: inv.supplier_id || "",
        notes: inv.notes || "",
      });
      setErrors({}); setSubmitStatus("idle"); setServerError(""); setVoidConfirm(false);
    }
  }, [inv]);

  const set = (k: keyof FormFields, v: string) => {
    setFields((p) => ({ ...p, [k]: v }));
    if (errors[k as keyof FormErrors]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const isEditable = inv && ["draft", "sent"].includes(inv.status);
  const canEdit = invPerms.canEdit();

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!fields.issue_date) e.issue_date = "Issue date is required.";
    if (!fields.due_date) e.due_date = "Due date is required.";
    else if (fields.due_date < fields.issue_date) e.due_date = "Due date must be on or after issue date.";
    const amt = parseFloat(fields.amount);
    if (!fields.amount || isNaN(amt) || amt <= 0) e.amount = "Enter a valid positive amount.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !inv) return;
    setSubmitting(true); setServerError("");
    try {
      const res = await fetch(`/api/finance/invoices/${inv.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_number: fields.invoice_number,
          type: fields.type,
          amount: parseFloat(fields.amount),
          tax_amount: parseFloat(fields.tax_amount || "0"),
          currency: fields.currency,
          issue_date: fields.issue_date,
          due_date: fields.due_date,
          customer_id: fields.customer_id || undefined,
          supplier_id: fields.supplier_id || undefined,
          notes: fields.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) { setSubmitStatus("success"); onSuccess(data.data); setTimeout(onClose, 900); }
      else { setSubmitStatus("error"); setServerError(data.message || "Failed to update invoice."); }
    } catch { setSubmitStatus("error"); setServerError("Network error."); }
    finally { setSubmitting(false); }
  };

  const handleStatusAction = async (targetStatus: string) => {
    if (!inv) return;
    setActionSubmitting(targetStatus); setServerError("");
    try {
      const res = await fetch(`/api/finance/invoices/${inv.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();
      if (data.success) { onSuccess(data.data); setTimeout(onClose, 400); }
      else setServerError(data.message || "Status update failed.");
    } catch { setServerError("Network error."); }
    finally { setActionSubmitting(null); setVoidConfirm(false); }
  };

  const availableActions = STATUS_ACTIONS.filter(
    (a) => inv && a.from.includes(inv.status as InvoiceStatus)
  );

  return (
    <Drawer
      open={open} onClose={onClose}
      title="Edit Invoice"
      subtitle={inv ? `${inv.invoice_number} — ${inv.type === "accounts_receivable" ? "AR" : "AP"} · ${inv.currency}` : ""}
      breadcrumb="Edit"
    >
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Status banner */}
        {inv && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-100 border border-surface-300">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-medium">Status:</span>
              <StatusBadge status={inv.status} />
            </div>
            {(inv.status === "paid" || inv.status === "cancelled") && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Read-only
              </span>
            )}
          </div>
        )}

        {/* RBAC gate on editing */}
        {!canEdit && isEditable && <AccessDenied action="edit invoices" />}

        <InvoiceFormBody
          fields={fields} errors={errors} set={set}
          customers={customers} suppliers={suppliers}
          mode="edit"
          readOnly={!canEdit || !isEditable}
        />

        {/* Status actions */}
        {availableActions.length > 0 && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Actions</p>

            {availableActions.map((action) => {
              const hasAccess = invPerms[action.perm]();
              const isVoid = action.status === "cancelled";

              if (isVoid) {
                return (
                  <div key={action.status}>
                    {!voidConfirm ? (
                      <button
                        onClick={() => hasAccess && setVoidConfirm(true)}
                        disabled={!hasAccess}
                        className={clsx(
                          "flex items-center gap-2 text-xs font-medium transition-colors",
                          hasAccess ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed"
                        )}
                      >
                        <Ban className="w-3.5 h-3.5" /> Void this invoice
                        {!hasAccess && <span className="ml-1 text-gray-400">(Finance Manager required)</span>}
                      </button>
                    ) : (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                        <p className="text-xs text-red-700 font-medium">
                          Void invoice {inv?.invoice_number}? This cannot be undone.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStatusAction("cancelled")}
                            disabled={!!actionSubmitting}
                            className="btn-danger text-xs py-1.5 px-3"
                          >
                            {actionSubmitting === "cancelled"
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Voiding…</>
                              : <><Ban className="w-3 h-3" /> Yes, void it</>
                            }
                          </button>
                          <button onClick={() => setVoidConfirm(false)} className="btn-secondary text-xs py-1.5 px-3">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={action.status}
                  onClick={() => hasAccess && handleStatusAction(action.status)}
                  disabled={!hasAccess || !!actionSubmitting}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    hasAccess
                      ? "border-surface-400 hover:border-surface-500 hover:bg-surface-50 text-gray-700"
                      : "border-surface-300 text-gray-300 cursor-not-allowed bg-surface-50"
                  )}
                >
                  <span className={clsx("flex items-center gap-2", hasAccess ? action.color : "text-gray-300")}>
                    <action.icon className="w-4 h-4" />
                    {action.label}
                  </span>
                  {actionSubmitting === action.status
                    ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    : !hasAccess
                      ? <span className="text-xs text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Restricted</span>
                      : <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                </button>
              );
            })}
          </div>
        )}

        {serverError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{serverError}</p>
          </div>
        )}
        {submitStatus === "success" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-sm text-emerald-700 font-medium">Invoice updated!</p>
          </div>
        )}
      </div>

      <DrawerFooter
        onCancel={onClose} onSubmit={handleSave}
        submitting={submitting} success={submitStatus === "success"}
        submitLabel="Save Changes"
        disabled={!canEdit || !isEditable}
      />
    </Drawer>
  );
}

// ── Summary cards ──────────────────────────────────────────────────────────────

function SummaryCards({ invoices }: { invoices: Invoice[] }) {
  const total = invoices.reduce((s, i) => s + i.total_amount, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total_amount, 0);
  const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.total_amount, 0);
  const pending = invoices.filter((i) => ["draft", "sent", "approved"].includes(i.status)).reduce((s, i) => s + i.total_amount, 0);

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {[
        { label: "Total Value", value: total, color: "text-gray-900", bg: "bg-white" },
        { label: "Collected", value: paid, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
        { label: "Outstanding", value: pending, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
        { label: "Overdue", value: overdue, color: "text-red-600", bg: "bg-red-50 border-red-200" },
      ].map((item) => (
        <div key={item.label} className={clsx("rounded-xl border px-4 py-3", item.bg)}>
          <p className="text-xs font-medium text-gray-500">{item.label}</p>
          <p className={clsx("text-lg font-bold tabular-nums mt-1", item.color)}>
            {formatCurrency(Number(item.value) || 0)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const STATUSES = ["", "draft", "sent", "approved", "paid", "overdue", "cancelled"];

export default function InvoicesPage() {
  const { invoice: invPerms, user, loading: authLoading } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (statusFilter) p.set("status", statusFilter);
    if (typeFilter) p.set("type", typeFilter);
    if (search) p.set("search", search);
    fetch(`/api/finance/invoices?${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setInvoices(res.data); setTotal(res.pagination?.totalCount || 0); }
      })
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/sales/customers?pageSize=200").then((r) => r.json()).then((res) => { if (res.success) setCustomers(res.data); });
    fetch("/api/procurement/suppliers?pageSize=200").then((r) => r.json()).then((res) => { if (res.success) setSuppliers(res.data); });
  }, []);

  const handleAdded = (inv: Invoice) => { setInvoices((p) => [inv, ...p]); setTotal((p) => p + 1); };
  const handleUpdated = (inv: Invoice) => { setInvoices((p) => p.map((i) => i.id === inv.id ? inv : i)); };

  // Simple summary computation
  const summary = {
    total: invoices.reduce((s, i) => s + i.total_amount, 0),
    paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total_amount, 0),
    pending: invoices.filter((i) => ["draft", "sent", "approved"].includes(i.status)).reduce((s, i) => s + i.total_amount, 0),
    overdue: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.total_amount, 0),
  };

  return (
    <>
      <Header
        title="Invoices"
        subtitle="Finance Module — AR & AP"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            {invPerms.canCreate() && (
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus className="w-3.5 h-3.5" /> New Invoice
              </button>
            )}
          </div>
        }
      />

      <PageWrapper>
        {/* Auth info strip */}
        {!authLoading && user && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span>
            <span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            <span>·</span>
            <span className={invPerms.canCreate() ? "text-emerald-600" : "text-gray-400"}>
              {invPerms.canCreate() ? "✓ Can create" : "✗ No create"}
            </span>
            <span className={invPerms.canEdit() ? "text-emerald-600" : "text-gray-400"}>
              {invPerms.canEdit() ? "✓ Can edit" : "✗ No edit"}
            </span>
            <span className={invPerms.canApprove() ? "text-emerald-600" : "text-gray-400"}>
              {invPerms.canApprove() ? "✓ Can approve" : "✗ No approve"}
            </span>
            <span className={invPerms.canVoid() ? "text-emerald-600" : "text-gray-400"}>
              {invPerms.canVoid() ? "✓ Can void" : "✗ No void"}
            </span>
          </div>
        )}

        {/* Summary */}
        {!loading && invoices.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total Value", value: summary.total, color: "text-gray-900", bg: "bg-white border-surface-300" },
              { label: "Collected", value: summary.paid, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
              { label: "Outstanding", value: summary.pending, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
              { label: "Overdue", value: summary.overdue, color: "text-red-600", bg: "bg-red-50 border-red-200" },
            ].map((item) => (
              <div key={item.label} className={clsx("rounded-xl border px-4 py-3", item.bg)}>
                <p className="text-xs font-medium text-gray-500">{item.label}</p>
                <p className={clsx("text-lg font-bold tabular-nums mt-1", item.color)}>
                  {formatCurrency(item.value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #…" className="input pl-8 text-xs py-1.5" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Types</option>
            <option value="accounts_receivable">AR — Receivable</option>
            <option value="accounts_payable">AP — Payable</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            {STATUSES.map((s) => <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "All Statuses"}</option>)}
          </select>
        </div>

        <SectionTitle title="Invoices" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="text-left table-header px-4 py-3">Invoice #</th>
                  <th className="text-left table-header px-4 py-3">Type</th>
                  <th className="text-left table-header px-4 py-3">Party</th>
                  <th className="text-left table-header px-4 py-3">Issue Date</th>
                  <th className="text-left table-header px-4 py-3">Due Date</th>
                  <th className="text-right table-header px-4 py-3">Subtotal</th>
                  <th className="text-right table-header px-4 py-3">Total</th>
                  <th className="text-left table-header px-4 py-3">Status</th>
                  <th className="w-10 table-header px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9}><TableSkeleton rows={8} cols={9} /></td></tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        title="No invoices found"
                        description="Create your first invoice to get started."
                        action={
                          invPerms.canCreate()
                            ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Invoice</button>
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const party = inv.type === "accounts_receivable"
                      ? (inv as any).customers?.name
                      : (inv as any).suppliers?.name;
                    const isOverdue = inv.status !== "paid" && inv.status !== "cancelled"
                      && new Date(inv.due_date) < new Date();

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setEditInvoice(inv)}
                        className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{inv.invoice_number}</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            "badge text-xs",
                            inv.type === "accounts_receivable" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                          )}>
                            {inv.type === "accounts_receivable" ? "AR" : "AP"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{party || <span className="text-gray-400 text-xs">—</span>}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(inv.issue_date)}</td>
                        <td className={clsx("px-4 py-3", isOverdue ? "text-red-600 font-medium" : "text-gray-600")}>
                          {formatDate(inv.due_date)}
                          {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatCurrency(inv.amount, inv.currency)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">{formatCurrency(inv.total_amount, inv.currency)}</td>
                        <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                        <td className="px-4 py-3">
                          <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>

      <AddInvoiceDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={handleAdded}
        customers={customers}
        suppliers={suppliers}
      />

      <EditInvoiceDrawer
        invoice={editInvoice}
        onClose={() => setEditInvoice(null)}
        onSuccess={handleUpdated}
        customers={customers}
        suppliers={suppliers}
      />
    </>
  );
}