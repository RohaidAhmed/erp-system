"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, X, ChevronRight,
  CheckCircle2, Loader2, AlertCircle, Lock,
  Power, PowerOff, Mail, Phone, MapPin, Crown,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatCurrency } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { Customer, CustomerTier, Currency } from "@/types";
import { clsx } from "clsx";

// ── Tier config ────────────────────────────────────────────────────────────────
const TIERS: { value: CustomerTier; label: string; color: string; bg: string }[] = [
  { value: "standard", label: "Standard", color: "text-gray-600", bg: "bg-gray-100" },
  { value: "silver", label: "Silver", color: "text-slate-600", bg: "bg-slate-100" },
  { value: "gold", label: "Gold", color: "text-amber-700", bg: "bg-amber-50" },
  { value: "platinum", label: "Platinum", color: "text-purple-700", bg: "bg-purple-50" },
];
const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR", "AED"];

function TierBadge({ tier }: { tier: CustomerTier }) {
  const t = TIERS.find((t) => t.value === tier) || TIERS[0];
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", t.bg, t.color)}>
      {(tier === "gold" || tier === "platinum") && <Crown className="w-3 h-3" />}
      {t.label}
    </span>
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
      <div onClick={onClose} className={clsx("fixed inset-0 bg-black/30 z-40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0 pointer-events-none")} />
      <div className={clsx("fixed top-0 right-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
          <span>Sales & CRM</span><ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Customers</span>
        </div>
        {children}
      </div>
    </>
  );
}

function Footer({ onCancel, onSubmit, busy, ok, label, disabled }: {
  onCancel: () => void; onSubmit: () => void; busy: boolean; ok: boolean; label: string; disabled?: boolean;
}) {
  return (
    <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex items-center justify-between flex-shrink-0">
      <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary" disabled={busy}>Cancel</button>
        <button onClick={onSubmit} disabled={busy || ok || disabled} className="btn-primary min-w-[130px] justify-center">
          {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : ok ? <><CheckCircle2 className="w-3.5 h-3.5" />Saved!</> : label}
        </button>
      </div>
    </div>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{msg}</p>;
}

// ── Customer form ──────────────────────────────────────────────────────────────
interface CFields {
  customer_code: string; name: string; email: string; phone: string;
  address: string; tier: CustomerTier; credit_limit: string; currency: Currency;
}
interface CErrors { customer_code?: string; name?: string; email?: string; }
const EMPTY_C: CFields = { customer_code: "", name: "", email: "", phone: "", address: "", tier: "standard", credit_limit: "0", currency: "USD" };

function validateCustomer(f: CFields, mode: "add" | "edit"): CErrors {
  const e: CErrors = {};
  if (mode === "add" && !f.customer_code.trim()) e.customer_code = "Customer code is required.";
  if (!f.name.trim()) e.name = "Name is required.";
  if (!f.email.trim()) e.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email.";
  return e;
}

function CustomerForm({ f, errs, set, mode, firstRef, readOnly }: {
  f: CFields; errs: CErrors; set: (k: keyof CFields, v: string) => void;
  mode: "add" | "edit"; firstRef?: React.Ref<HTMLInputElement>; readOnly?: boolean;
}) {
  const inp = (extra?: string) => clsx("input", extra, readOnly && "opacity-60 cursor-not-allowed");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Code {mode === "add" && <span className="text-red-500">*</span>}</label>
          <input ref={firstRef} type="text" value={f.customer_code}
            onChange={(e) => set("customer_code", e.target.value.toUpperCase())}
            placeholder="e.g. CUST-001" disabled={readOnly || mode === "edit"}
            className={clsx("input font-mono", errs.customer_code && "border-red-400",
              (readOnly || mode === "edit") && "opacity-60 cursor-not-allowed bg-surface-200")} />
          {mode === "edit" && !readOnly && <p className="mt-1 text-xs text-gray-400">Code cannot be changed.</p>}
          <FieldErr msg={errs.customer_code} />
        </div>
        <div>
          <label className="label">Currency</label>
          <select value={f.currency} onChange={(e) => set("currency", e.target.value)} disabled={readOnly} className={inp()}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Customer Name <span className="text-red-500">*</span></label>
        <input type="text" value={f.name} onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Alpha Technologies" disabled={readOnly} className={inp(errs.name && "border-red-400")} />
        <FieldErr msg={errs.name} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Email <span className="text-red-500">*</span></label>
          <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)}
            placeholder="contact@customer.com" disabled={readOnly} className={inp(errs.email && "border-red-400")} />
          <FieldErr msg={errs.email} />
        </div>
        <div>
          <label className="label">Phone <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
          <input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)}
            placeholder="+92 300 0000000" disabled={readOnly} className={inp()} />
        </div>
      </div>

      <div>
        <label className="label">Address <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
        <textarea value={f.address} onChange={(e) => set("address", e.target.value)}
          rows={2} placeholder="Street, City, Country" disabled={readOnly}
          className={clsx("input resize-none", readOnly && "opacity-60 cursor-not-allowed")} />
      </div>

      {/* Tier selector */}
      <div>
        <label className="label">Tier</label>
        <div className="grid grid-cols-4 gap-2">
          {TIERS.map((t) => (
            <button key={t.value} type="button" disabled={readOnly}
              onClick={() => !readOnly && set("tier", t.value)}
              className={clsx(
                "flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all",
                f.tier === t.value ? `${t.bg} ${t.color} border-current` : "border-surface-400 text-gray-500 hover:bg-surface-50",
                readOnly && "cursor-not-allowed opacity-60"
              )}>
              {(t.value === "gold" || t.value === "platinum") && <Crown className={clsx("w-3.5 h-3.5", f.tier === t.value ? t.color : "text-gray-300")} />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Credit Limit</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{f.currency}</span>
          <input type="number" min="0" step="1000" value={f.credit_limit}
            onChange={(e) => set("credit_limit", e.target.value)}
            placeholder="0" disabled={readOnly}
            className={clsx(inp("tabular-nums pl-10"))} />
        </div>
        <p className="mt-1 text-xs text-gray-400">Maximum outstanding balance allowed</p>
      </div>
    </div>
  );
}

// ── Form hook ──────────────────────────────────────────────────────────────────
function useForm() {
  const [f, setF] = useState<CFields>(EMPTY_C);
  const [errs, setErrs] = useState<CErrors>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof CFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };
  const reset = (init: CFields) => { setF(init); setErrs({}); setOk(false); setErr(""); };
  return { f, errs, setErrs, set, reset, busy, setBusy, ok, setOk, err, setErr };
}

// ── Add Customer Drawer ────────────────────────────────────────────────────────
function AddCustomerDrawer({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: (c: Customer) => void;
}) {
  const { can } = useAuth();
  const canCreate = can.create("sales");
  const form = useForm();
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { form.reset(EMPTY_C); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const e = validateCustomer(form.f, "add");
    if (Object.keys(e).length) { form.setErrs(e); return; }
    form.setBusy(true); form.setErr("");
    try {
      const res = await fetch("/api/sales/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.f, credit_limit: parseFloat(form.f.credit_limit || "0") }),
      });
      const data = await res.json();
      if (data.success) { form.setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else form.setErr(data.message || "Failed.");
    } catch { form.setErr("Network error."); }
    finally { form.setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Customer" subtitle="Add a customer to CRM">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate
          ? <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200"><Lock className="w-4 h-4 text-amber-500 mt-0.5" /><p className="text-sm text-amber-700">Your role cannot create customers.</p></div>
          : <CustomerForm f={form.f} errs={form.errs} set={form.set} mode="add" firstRef={firstRef} />}
        {form.err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{form.err}</div>}
        {form.ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Customer added!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSubmit} busy={form.busy} ok={form.ok} label="Add Customer" disabled={!canCreate} />
    </Drawer>
  );
}

// ── Edit Customer Drawer ───────────────────────────────────────────────────────
function EditCustomerDrawer({ customer: cust, onClose, onSuccess }: {
  customer: Customer | null; onClose: () => void; onSuccess: (c: Customer) => void;
}) {
  const open = !!cust;
  const { can } = useAuth();
  const canEdit = can.edit("sales");
  const canFull = can.full("sales");
  const form = useForm();
  const [toggling, setToggling] = useState(false);
  const [confirmDeactivate, setConfirmD] = useState(false);

  useEffect(() => {
    if (cust) {
      form.reset({
        customer_code: cust.customer_code, name: cust.name, email: cust.email,
        phone: cust.phone || "", address: cust.address || "",
        tier: cust.tier, credit_limit: String(cust.credit_limit), currency: cust.currency
      });
      setConfirmD(false);
    }
  }, [cust]);

  const handleSave = async () => {
    const e = validateCustomer(form.f, "edit");
    if (Object.keys(e).length || !cust) { form.setErrs(e); return; }
    form.setBusy(true); form.setErr("");
    try {
      const res = await fetch(`/api/sales/customers/${cust.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.f, credit_limit: parseFloat(form.f.credit_limit || "0") }),
      });
      const data = await res.json();
      if (data.success) { form.setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else form.setErr(data.message || "Update failed.");
    } catch { form.setErr("Network error."); }
    finally { form.setBusy(false); }
  };

  const handleToggle = async () => {
    if (!cust) return;
    setToggling(true); form.setErr("");
    try {
      const res = await fetch(`/api/sales/customers/${cust.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !cust.is_active }),
      });
      const data = await res.json();
      if (data.success) { onSuccess(data.data); setTimeout(onClose, 300); }
      else form.setErr(data.message || "Failed.");
    } catch { form.setErr("Network error."); }
    finally { setToggling(false); setConfirmD(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Edit Customer" subtitle={cust ? `${cust.customer_code} · ${cust.name}` : ""}>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {cust && (
          <div className="flex items-center gap-2">
            <span className={clsx("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border",
              cust.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-500")}>
              <span className={clsx("w-1.5 h-1.5 rounded-full", cust.is_active ? "bg-emerald-500" : "bg-gray-400")} />
              {cust.is_active ? "Active" : "Inactive"}
            </span>
            <TierBadge tier={cust.tier} />
          </div>
        )}
        {!canEdit && <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200"><Lock className="w-4 h-4 text-amber-500 mt-0.5" /><p className="text-sm text-amber-700">Your role cannot edit customers.</p></div>}
        <CustomerForm f={form.f} errs={form.errs} set={form.set} mode="edit" readOnly={!canEdit || !cust?.is_active} />

        {/* Deactivate */}
        {cust && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
            {cust.is_active ? (
              !confirmDeactivate ? (
                <button onClick={() => canFull && setConfirmD(true)} disabled={!canFull}
                  className={clsx("flex items-center gap-2 text-xs font-medium transition-colors", canFull ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed")}>
                  <PowerOff className="w-3.5 h-3.5" /> Deactivate customer
                  {!canFull && <span className="text-gray-400 ml-1">(Sales Executive required)</span>}
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Deactivate <strong>{cust.name}</strong>? Open orders will block this.</p>
                  <div className="flex gap-2">
                    <button onClick={handleToggle} disabled={toggling} className="btn-danger text-xs py-1.5 px-3">{toggling ? "Deactivating…" : "Confirm"}</button>
                    <button onClick={() => setConfirmD(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                  </div>
                </div>
              )
            ) : (
              <button onClick={handleToggle} disabled={toggling || !canFull}
                className={clsx("flex items-center gap-2 text-xs font-medium", canFull ? "text-emerald-600 hover:text-emerald-700" : "text-gray-300 cursor-not-allowed")}>
                <Power className="w-3.5 h-3.5" /> Reactivate customer
              </button>
            )}
          </div>
        )}

        {form.err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{form.err}</div>}
        {form.ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Customer updated!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSave} busy={form.busy} ok={form.ok} label="Save Changes" disabled={!canEdit || !cust?.is_active} />
    </Drawer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editCust, setEditCust] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "200" });
    if (search) p.set("search", search);
    if (tierFilter) p.set("tier", tierFilter);
    if (showInactive) p.set("inactive", "true");
    fetch(`/api/sales/customers?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setCustomers(res.data); setTotal(res.pagination?.totalCount || res.data.length); } })
      .finally(() => setLoading(false));
  }, [search, tierFilter, showInactive]);

  useEffect(() => { load(); }, [load]);

  const handleAdded = (c: Customer) => { setCustomers((p) => [c, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (c: Customer) => { setCustomers((p) => p.map((x) => x.id === c.id ? c : x)); };

  const totalCredit = customers.filter(c => c.is_active).reduce((s, c) => s + c.credit_limit, 0);

  return (
    <>
      <Header title="Customers" subtitle="Sales & CRM"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
            {can.create("sales") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New Customer</button>}
          </div>
        }
      />
      <PageWrapper>
        {!authLoading && user && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            {[["Add", can.create("sales")], ["Edit", can.edit("sales")], ["Deactivate", can.full("sales")]].map(([l, v]) => (
              <span key={String(l)} className={v ? "text-emerald-600" : "text-gray-400"}>{v ? "✓" : "✗"} {l}</span>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Active</span>
              <span className="text-2xl font-bold text-gray-900">{customers.filter(c => c.is_active).length}</span>
            </div>
            {TIERS.slice(1).map((t) => (
              <div key={t.value} className={clsx("rounded-xl border px-4 py-3 flex items-center justify-between", t.bg, "border-current/20")}>
                <span className={clsx("text-xs font-medium flex items-center gap-1", t.color)}>
                  <Crown className="w-3 h-3" />{t.label}
                </span>
                <span className={clsx("text-2xl font-bold", t.color)}>
                  {customers.filter(c => c.tier === t.value && c.is_active).length}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code or email…" className="input pl-8 text-xs py-1.5" />
          </div>
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Tiers</option>
            {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
        </div>

        <SectionTitle title="Customers" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["Customer", "Code", "Contact", "Tier", "Credit Limit", "Currency", "Status", ""].map((h) => (
                    <th key={h} className={clsx("table-header px-4 py-3", h === "Credit Limit" ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8}><TableSkeleton rows={6} cols={8} /></td></tr>
                  : customers.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState title="No customers found" description="Add your first customer to start."
                        action={can.create("sales") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New Customer</button> : undefined} />
                    </td></tr>
                  ) : customers.map((c) => (
                    <tr key={c.id} onClick={() => setEditCust(c)}
                      className={clsx("border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group", !c.is_active && "opacity-50")}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.address && <p className="text-xs text-gray-400 truncate max-w-[180px] flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{c.address}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-brand-700">{c.customer_code}</td>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1 text-xs text-gray-600"><Mail className="w-3 h-3 text-gray-400" />{c.email}</p>
                        {c.phone && <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5"><Phone className="w-3 h-3 text-gray-400" />{c.phone}</p>}
                      </td>
                      <td className="px-4 py-3"><TierBadge tier={c.tier} /></td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatCurrency(c.credit_limit, c.currency)}</td>
                      <td className="px-4 py-3"><span className="badge bg-surface-200 text-gray-600 text-xs">{c.currency}</span></td>
                      <td className="px-4 py-3">
                        <span className={clsx("badge text-xs", c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400")}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3"><Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>

      <AddCustomerDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} />
      <EditCustomerDrawer customer={editCust} onClose={() => setEditCust(null)} onSuccess={handleUpdated} />
    </>
  );
}