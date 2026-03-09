"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, Star, StarOff,
  X, ChevronRight, CheckCircle2, Loader2, AlertCircle,
  Lock, PowerOff, Power, Building2, Mail, Phone, MapPin,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatCurrency } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { Supplier, Currency } from "@/types";
import { clsx } from "clsx";

// ── Constants ──────────────────────────────────────────────────────────────────
const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR", "AED"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function StarRating({ value, onChange, readOnly }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          className={clsx("transition-colors", readOnly ? "cursor-default" : "hover:scale-110")}
        >
          <Star className={clsx(
            "w-4 h-4 transition-colors",
            (hovered || value) >= star ? "fill-amber-400 text-amber-400" : "text-gray-300"
          )} />
        </button>
      ))}
      {value > 0 && <span className="ml-1.5 text-xs text-gray-500">{value.toFixed(1)}</span>}
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
          <span>Procurement</span><ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Suppliers</span>
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

// ── Supplier form ──────────────────────────────────────────────────────────────
interface SFields {
  code: string; name: string; email: string; phone: string;
  address: string; payment_terms: string; currency: Currency;
  performance_rating: number;
}
interface SErrors { code?: string; name?: string; email?: string; }

const EMPTY_S: SFields = {
  code: "", name: "", email: "", phone: "", address: "",
  payment_terms: "30", currency: "USD", performance_rating: 0,
};

function validateSupplier(f: SFields, mode: "add" | "edit"): SErrors {
  const e: SErrors = {};
  if (mode === "add" && !f.code.trim()) e.code = "Supplier code is required.";
  if (!f.name.trim()) e.name = "Name is required.";
  if (!f.email.trim()) e.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email.";
  return e;
}

function SupplierForm({ f, errs, set, setRating, mode, firstRef, readOnly }: {
  f: SFields; errs: SErrors;
  set: (k: keyof SFields, v: string) => void;
  setRating: (v: number) => void;
  mode: "add" | "edit"; firstRef?: React.Ref<HTMLInputElement>; readOnly?: boolean;
}) {
  const inp = (extra?: string) => clsx("input", extra, readOnly && "opacity-60 cursor-not-allowed");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Code {mode === "add" && <span className="text-red-500">*</span>}</label>
          <input ref={firstRef} type="text" value={f.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            placeholder="e.g. SUP-001" disabled={readOnly || mode === "edit"}
            className={clsx("input font-mono", errs.code && "border-red-400",
              (readOnly || mode === "edit") && "opacity-60 cursor-not-allowed bg-surface-200")} />
          {mode === "edit" && !readOnly && <p className="mt-1 text-xs text-gray-400">Code cannot be changed.</p>}
          <FieldErr msg={errs.code} />
        </div>
        <div>
          <label className="label">Currency</label>
          <select value={f.currency} onChange={(e) => set("currency", e.target.value)} disabled={readOnly} className={inp()}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Supplier Name <span className="text-red-500">*</span></label>
        <input type="text" value={f.name} onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Acme Electronics Ltd." disabled={readOnly} className={inp(errs.name && "border-red-400")} />
        <FieldErr msg={errs.name} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Email <span className="text-red-500">*</span></label>
          <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)}
            placeholder="orders@supplier.com" disabled={readOnly} className={inp(errs.email && "border-red-400")} />
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Payment Terms <span className="text-xs text-gray-400 font-normal">(days)</span></label>
          <input type="number" min="0" value={f.payment_terms} onChange={(e) => set("payment_terms", e.target.value)}
            placeholder="30" disabled={readOnly} className={inp("tabular-nums")} />
          <p className="mt-1 text-xs text-gray-400">Net-{f.payment_terms || 30} days</p>
        </div>
        <div>
          <label className="label">Performance Rating</label>
          <div className="mt-2">
            <StarRating value={f.performance_rating} onChange={setRating} readOnly={readOnly} />
            {!readOnly && f.performance_rating > 0 && (
              <button type="button" onClick={() => setRating(0)}
                className="mt-1 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <StarOff className="w-3 h-3" /> Clear rating
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Form hook ──────────────────────────────────────────────────────────────────
function useForm() {
  const [f, setF] = useState<SFields>(EMPTY_S);
  const [errs, setErrs] = useState<SErrors>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof SFields, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrs((p) => ({ ...p, [k]: undefined }));
  };
  const setRating = (v: number) => setF((p) => ({ ...p, performance_rating: v }));
  const reset = (init: SFields) => { setF(init); setErrs({}); setOk(false); setErr(""); };
  return { f, errs, setErrs, set, setRating, reset, busy, setBusy, ok, setOk, err, setErr };
}

// ── Add Supplier Drawer ────────────────────────────────────────────────────────
function AddSupplierDrawer({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: (s: Supplier) => void;
}) {
  const { can } = useAuth();
  const canCreate = can.create("procurement");
  const form = useForm();
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { form.reset(EMPTY_S); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const e = validateSupplier(form.f, "add");
    if (Object.keys(e).length) { form.setErrs(e); return; }
    form.setBusy(true); form.setErr("");
    try {
      const res = await fetch("/api/procurement/suppliers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form.f,
          payment_terms: parseInt(form.f.payment_terms || "30"),
          phone: form.f.phone || undefined,
          address: form.f.address || undefined,
          performance_rating: form.f.performance_rating || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) { form.setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else form.setErr(data.message || "Failed.");
    } catch { form.setErr("Network error."); }
    finally { form.setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Add Supplier" subtitle="Register a new supplier">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate
          ? <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Lock className="w-4 h-4 text-amber-500 mt-0.5" />
            <p className="text-sm text-amber-700">Your role cannot create suppliers. Requires Procurement Officer.</p>
          </div>
          : <SupplierForm f={form.f} errs={form.errs} set={form.set} setRating={form.setRating} mode="add" firstRef={firstRef} />
        }
        {form.err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{form.err}</div>}
        {form.ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Supplier added!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSubmit} busy={form.busy} ok={form.ok} label="Add Supplier" disabled={!canCreate} />
    </Drawer>
  );
}

// ── Edit Supplier Drawer ───────────────────────────────────────────────────────
function EditSupplierDrawer({ supplier: sup, onClose, onSuccess }: {
  supplier: Supplier | null; onClose: () => void; onSuccess: (s: Supplier) => void;
}) {
  const open = !!sup;
  const { can } = useAuth();
  const canEdit = can.edit("procurement");
  const canFull = can.full("procurement");
  const form = useForm();
  const [toggling, setToggling] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (sup) {
      form.reset({
        code: sup.code, name: sup.name, email: sup.email,
        phone: sup.phone || "", address: sup.address || "",
        payment_terms: String(sup.payment_terms),
        currency: sup.currency,
        performance_rating: sup.performance_rating || 0,
      });
      setConfirmDeactivate(false);
    }
  }, [sup]);

  const handleSave = async () => {
    const e = validateSupplier(form.f, "edit");
    if (Object.keys(e).length || !sup) { form.setErrs(e); return; }
    form.setBusy(true); form.setErr("");
    try {
      const res = await fetch(`/api/procurement/suppliers/${sup.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.f.name, email: form.f.email,
          phone: form.f.phone || null, address: form.f.address || null,
          payment_terms: parseInt(form.f.payment_terms || "30"),
          currency: form.f.currency,
          performance_rating: form.f.performance_rating || null,
        }),
      });
      const data = await res.json();
      if (data.success) { form.setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else form.setErr(data.message || "Update failed.");
    } catch { form.setErr("Network error."); }
    finally { form.setBusy(false); }
  };

  const handleToggle = async () => {
    if (!sup) return;
    setToggling(true); form.setErr("");
    try {
      const res = await fetch(`/api/procurement/suppliers/${sup.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !sup.is_active }),
      });
      const data = await res.json();
      if (data.success) { onSuccess(data.data); setTimeout(onClose, 300); }
      else form.setErr(data.message || "Failed.");
    } catch { form.setErr("Network error."); }
    finally { setToggling(false); setConfirmDeactivate(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Edit Supplier" subtitle={sup ? `${sup.code} · ${sup.name}` : ""}>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Status chip */}
        {sup && (
          <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs w-fit",
            sup.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-500")}>
            <span className={clsx("w-2 h-2 rounded-full", sup.is_active ? "bg-emerald-500" : "bg-gray-400")} />
            {sup.is_active ? "Active" : "Inactive"}
          </div>
        )}
        {!canEdit && <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200"><Lock className="w-4 h-4 text-amber-500 mt-0.5" /><p className="text-sm text-amber-700">Your role cannot edit suppliers.</p></div>}
        <SupplierForm f={form.f} errs={form.errs} set={form.set} setRating={form.setRating}
          mode="edit" readOnly={!canEdit || !sup?.is_active} />

        {/* Deactivate */}
        {sup && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
            {sup.is_active ? (
              !confirmDeactivate ? (
                <button onClick={() => canFull && setConfirmDeactivate(true)} disabled={!canFull}
                  className={clsx("flex items-center gap-2 text-xs font-medium transition-colors",
                    canFull ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed")}>
                  <PowerOff className="w-3.5 h-3.5" /> Deactivate supplier
                  {!canFull && <span className="text-gray-400 ml-1">(Procurement Officer required)</span>}
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Deactivate <strong>{sup.name}</strong>? Open POs will block this.</p>
                  <div className="flex gap-2">
                    <button onClick={handleToggle} disabled={toggling} className="btn-danger text-xs py-1.5 px-3">{toggling ? "Deactivating…" : "Confirm"}</button>
                    <button onClick={() => setConfirmDeactivate(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                  </div>
                </div>
              )
            ) : (
              <button onClick={handleToggle} disabled={toggling || !canFull}
                className={clsx("flex items-center gap-2 text-xs font-medium transition-colors",
                  canFull ? "text-emerald-600 hover:text-emerald-700" : "text-gray-300 cursor-not-allowed")}>
                <Power className="w-3.5 h-3.5" /> Reactivate supplier
              </button>
            )}
          </div>
        )}

        {form.err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{form.err}</div>}
        {form.ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Supplier updated!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSave} busy={form.busy} ok={form.ok} label="Save Changes" disabled={!canEdit || !sup?.is_active} />
    </Drawer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (search) p.set("search", search);
    if (showInactive) p.set("inactive", "true");
    fetch(`/api/procurement/suppliers?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setSuppliers(res.data); setTotal(res.pagination?.totalCount || res.data.length); } })
      .finally(() => setLoading(false));
  }, [search, showInactive]);

  useEffect(() => { load(); }, [load]);

  const handleAdded = (s: Supplier) => { setSuppliers((p) => [s, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (s: Supplier) => { setSuppliers((p) => p.map((x) => x.id === s.id ? s : x)); };

  const avgRating = suppliers.filter((s) => s.performance_rating).reduce((sum, s, _, a) => sum + (s.performance_rating || 0) / a.length, 0);

  return (
    <>
      <Header title="Suppliers" subtitle="Procurement Module"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
            {can.create("procurement") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />Add Supplier</button>}
          </div>
        }
      />
      <PageWrapper>
        {/* Auth strip */}
        {!authLoading && user && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            {[["Add", can.create("procurement")], ["Edit", can.edit("procurement")], ["Deactivate", can.full("procurement")]].map(([l, v]) => (
              <span key={String(l)} className={v ? "text-emerald-600" : "text-gray-400"}>{v ? "✓" : "✗"} {l}</span>
            ))}
          </div>
        )}

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Active Suppliers</span>
              <span className="text-2xl font-bold text-gray-900">{suppliers.filter(s => s.is_active).length}</span>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Avg. Rating</span>
              <div className="flex items-center gap-1.5">
                <StarRating value={parseFloat(avgRating.toFixed(1))} readOnly />
              </div>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Inactive</span>
              <span className="text-2xl font-bold text-gray-400">{suppliers.filter(s => !s.is_active).length}</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code or email…" className="input pl-8 text-xs py-1.5" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
        </div>

        <SectionTitle title="Suppliers" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["Supplier", "Code", "Contact", "Payment Terms", "Currency", "Rating", "Status", ""].map((h) => (
                    <th key={h} className="text-left table-header px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8}><TableSkeleton rows={6} cols={8} /></td></tr>
                  : suppliers.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState title="No suppliers found" description="Add your first supplier to get started."
                        action={can.create("procurement") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />Add Supplier</button> : undefined} />
                    </td></tr>
                  ) : suppliers.map((s) => (
                    <tr key={s.id} onClick={() => setEditSupplier(s)}
                      className={clsx("border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group", !s.is_active && "opacity-50")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-brand-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                            {s.address && <p className="text-xs text-gray-400 truncate max-w-[180px]">{s.address}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-brand-700">{s.code}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="flex items-center gap-1 text-xs text-gray-600"><Mail className="w-3 h-3 text-gray-400" />{s.email}</p>
                          {s.phone && <p className="flex items-center gap-1 text-xs text-gray-500"><Phone className="w-3 h-3 text-gray-400" />{s.phone}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">Net-{s.payment_terms}</td>
                      <td className="px-4 py-3"><span className="badge bg-surface-200 text-gray-600 text-xs">{s.currency}</span></td>
                      <td className="px-4 py-3">
                        {s.performance_rating ? <StarRating value={s.performance_rating} readOnly /> : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("badge text-xs", s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400")}>
                          {s.is_active ? "Active" : "Inactive"}
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

      <AddSupplierDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} />
      <EditSupplierDrawer supplier={editSupplier} onClose={() => setEditSupplier(null)} onSuccess={handleUpdated} />
    </>
  );
}