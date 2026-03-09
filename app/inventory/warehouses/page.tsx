"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, Warehouse as WarehouseIcon,
  X, ChevronRight, CheckCircle2, Loader2, AlertCircle, Lock,
  Building2, PowerOff, Power,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { Warehouse, Employee } from "@/types";
import { clsx } from "clsx";

// ── Shared drawer shell ────────────────────────────────────────────────────────

function Drawer({ open, onClose, title, subtitle, breadcrumb, children }: {
  open: boolean; onClose: () => void;
  title: string; subtitle?: string; breadcrumb: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} className={clsx("fixed inset-0 bg-black/30 z-40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0 pointer-events-none")} />
      <div className={clsx("fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
          <span>Inventory</span><ChevronRight className="w-3 h-3" /><span>Warehouses</span>
          <ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">{breadcrumb}</span>
        </div>
        {children}
      </div>
    </>
  );
}

function DrawerFooter({ onCancel, onSubmit, submitting, success, label, disabled }: {
  onCancel: () => void; onSubmit: () => void;
  submitting: boolean; success: boolean; label: string; disabled?: boolean;
}) {
  return (
    <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex items-center justify-between flex-shrink-0">
      <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary" disabled={submitting}>Cancel</button>
        <button onClick={onSubmit} disabled={submitting || success || disabled} className="btn-primary min-w-[130px] justify-center">
          {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
            : success ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
              : label}
        </button>
      </div>
    </div>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{msg}</p>;
}

// ── Warehouse form ─────────────────────────────────────────────────────────────

interface WFields { code: string; name: string; location: string; capacity: string; manager_id: string; }
interface WErrors { code?: string; name?: string; location?: string; }

const EMPTY_W: WFields = { code: "", name: "", location: "", capacity: "0", manager_id: "" };

function validateWarehouse(f: WFields, mode: "add" | "edit"): WErrors {
  const e: WErrors = {};
  if (mode === "add" && !f.code.trim()) e.code = "Warehouse code is required.";
  if (!f.name.trim()) e.name = "Name is required.";
  if (!f.location.trim()) e.location = "Location is required.";
  return e;
}

function WarehouseForm({ f, errs, set, employees, mode, firstRef, readOnly }: {
  f: WFields; errs: WErrors; set: (k: keyof WFields, v: string) => void;
  employees: Employee[]; mode: "add" | "edit";
  firstRef?: React.Ref<HTMLInputElement>; readOnly?: boolean;
}) {
  const inp = (extra?: string) => clsx("input", extra, readOnly && "opacity-60 cursor-not-allowed");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Code {mode === "add" && <span className="text-red-500">*</span>}</label>
          <input ref={firstRef} type="text" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())}
            placeholder="e.g. WH-MAIN" disabled={readOnly || mode === "edit"}
            className={clsx("input font-mono", errs.code && "border-red-400", (readOnly || mode === "edit") && "opacity-60 cursor-not-allowed bg-surface-200")} />
          {mode === "edit" && !readOnly && <p className="mt-1 text-xs text-gray-400">Code cannot be changed.</p>}
          <FieldErr msg={errs.code} />
        </div>
        <div>
          <label className="label">Capacity <span className="text-xs text-gray-400 font-normal">(units)</span></label>
          <input type="number" min="0" value={f.capacity} onChange={(e) => set("capacity", e.target.value)}
            placeholder="0" disabled={readOnly} className={inp("tabular-nums")} />
        </div>
      </div>

      <div>
        <label className="label">Warehouse Name <span className="text-red-500">*</span></label>
        <input type="text" value={f.name} onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Main Storeroom" disabled={readOnly} className={inp(errs.name && "border-red-400")} />
        <FieldErr msg={errs.name} />
      </div>

      <div>
        <label className="label">Location <span className="text-red-500">*</span></label>
        <input type="text" value={f.location} onChange={(e) => set("location", e.target.value)}
          placeholder="e.g. Building A, Ground Floor" disabled={readOnly} className={inp(errs.location && "border-red-400")} />
        <FieldErr msg={errs.location} />
      </div>

      <div>
        <label className="label">Manager <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
        <select value={f.manager_id} onChange={(e) => set("manager_id", e.target.value)} disabled={readOnly} className={inp()}>
          <option value="">— No manager assigned —</option>
          {employees.filter((e) => e.status === "active").map((e) => (
            <option key={e.id} value={e.id}>{e.full_name} · {e.position}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Shared form hook ───────────────────────────────────────────────────────────

function useForm() {
  const [f, setF] = useState<WFields>(EMPTY_W);
  const [errs, setErrs] = useState<WErrors>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof WFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };
  const reset = (init: WFields) => { setF(init); setErrs({}); setOk(false); setErr(""); };
  return { f, errs, setErrs, set, reset, busy, setBusy, ok, setOk, err, setErr };
}

// ── Add Warehouse Drawer ───────────────────────────────────────────────────────

function AddWarehouseDrawer({ open, onClose, onSuccess, employees }: {
  open: boolean; onClose: () => void; onSuccess: (w: Warehouse) => void; employees: Employee[];
}) {
  const { can } = useAuth();
  const canCreate = can.create("inventory");
  const form = useForm();
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { form.reset(EMPTY_W); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const e = validateWarehouse(form.f, "add");
    if (Object.keys(e).length) { form.setErrs(e); return; }
    form.setBusy(true); form.setErr("");
    try {
      const res = await fetch("/api/inventory/warehouses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form.f, capacity: parseFloat(form.f.capacity || "0"), manager_id: form.f.manager_id || undefined }),
      });
      const data = await res.json();
      if (data.success) { form.setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else form.setErr(data.message || "Failed.");
    } catch { form.setErr("Network error."); }
    finally { form.setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Warehouse" subtitle="Register a new storage location" breadcrumb="New Warehouse">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate ? (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Lock className="w-4 h-4 text-amber-500 mt-0.5" />
            <p className="text-sm text-amber-700">Your role cannot create warehouses. Requires Inventory Manager.</p>
          </div>
        ) : <WarehouseForm f={form.f} errs={form.errs} set={form.set} employees={employees} mode="add" firstRef={firstRef} />}
        {form.err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5" />{form.err}</div>}
        {form.ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Warehouse created!</div>}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSubmit} submitting={form.busy} success={form.ok} label="Create Warehouse" disabled={!canCreate} />
    </Drawer>
  );
}

// ── Edit Warehouse Drawer ──────────────────────────────────────────────────────

function EditWarehouseDrawer({ warehouse: wh, onClose, onSuccess, employees }: {
  warehouse: Warehouse | null; onClose: () => void; onSuccess: (w: Warehouse) => void; employees: Employee[];
}) {
  const open = !!wh;
  const { can } = useAuth();
  const canEdit = can.edit("inventory");
  const canFull = can.full("inventory");
  const form = useForm();
  const [toggling, setToggling] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (wh) {
      form.reset({ code: wh.code, name: wh.name, location: wh.location, capacity: String(wh.capacity), manager_id: wh.manager_id || "" });
      setConfirmDeactivate(false);
    }
  }, [wh]);

  const handleSave = async () => {
    const e = validateWarehouse(form.f, "edit");
    if (Object.keys(e).length || !wh) { form.setErrs(e); return; }
    form.setBusy(true); form.setErr("");
    try {
      const res = await fetch(`/api/inventory/warehouses/${wh.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.f.name, location: form.f.location, capacity: parseFloat(form.f.capacity || "0"), manager_id: form.f.manager_id || undefined }),
      });
      const data = await res.json();
      if (data.success) { form.setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else form.setErr(data.message || "Update failed.");
    } catch { form.setErr("Network error."); }
    finally { form.setBusy(false); }
  };

  const handleToggle = async () => {
    if (!wh) return;
    setToggling(true); form.setErr("");
    try {
      const res = await fetch(`/api/inventory/warehouses/${wh.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !wh.is_active }),
      });
      const data = await res.json();
      if (data.success) { onSuccess(data.data); setTimeout(onClose, 300); }
      else form.setErr(data.message || "Failed.");
    } catch { form.setErr("Network error."); }
    finally { setToggling(false); setConfirmDeactivate(false); }
  };

  const manager = (wh as any)?.manager;

  return (
    <Drawer open={open} onClose={onClose} title="Edit Warehouse" subtitle={wh ? `${wh.code} · ${wh.location}` : ""} breadcrumb="Edit Warehouse">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Status chip */}
        {wh && (
          <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs w-fit",
            wh.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-500")}>
            <span className={clsx("w-2 h-2 rounded-full", wh.is_active ? "bg-emerald-500" : "bg-gray-400")} />
            {wh.is_active ? "Active" : "Inactive"}
            {manager && <span className="ml-2 text-gray-500">· Manager: {manager.full_name}</span>}
          </div>
        )}
        {!canEdit && <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200"><Lock className="w-4 h-4 text-amber-500 mt-0.5" /><p className="text-sm text-amber-700">Your role cannot edit warehouses.</p></div>}
        <WarehouseForm f={form.f} errs={form.errs} set={form.set} employees={employees} mode="edit" readOnly={!canEdit || !wh?.is_active} />

        {/* Toggle active */}
        {wh && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
            {wh.is_active ? (
              !confirmDeactivate ? (
                <button onClick={() => canFull && setConfirmDeactivate(true)} disabled={!canFull}
                  className={clsx("flex items-center gap-2 text-xs font-medium", canFull ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed")}>
                  <PowerOff className="w-3.5 h-3.5" /> Deactivate warehouse
                  {!canFull && <span className="text-gray-400">(Inventory Manager required)</span>}
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Deactivate <strong>{wh.name}</strong>? It will be hidden from all stock movement dropdowns.</p>
                  <div className="flex gap-2">
                    <button onClick={handleToggle} disabled={toggling} className="btn-danger text-xs py-1.5 px-3">{toggling ? "Deactivating…" : "Confirm"}</button>
                    <button onClick={() => setConfirmDeactivate(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                  </div>
                </div>
              )
            ) : (
              <button onClick={handleToggle} disabled={toggling || !canFull}
                className={clsx("flex items-center gap-2 text-xs font-medium", canFull ? "text-emerald-600 hover:text-emerald-700" : "text-gray-300 cursor-not-allowed")}>
                <Power className="w-3.5 h-3.5" /> Reactivate warehouse
              </button>
            )}
          </div>
        )}

        {form.err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5" />{form.err}</div>}
        {form.ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Warehouse updated!</div>}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSave} submitting={form.busy} success={form.ok} label="Save Changes" disabled={!canEdit || !wh?.is_active} />
    </Drawer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WarehousesPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editWh, setEditWh] = useState<Warehouse | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (showInactive) p.set("inactive", "true");
    fetch(`/api/inventory/warehouses?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setWarehouses(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [showInactive]);

  useEffect(() => {
    fetch("/api/hr/employees?pageSize=200&status=active").then((r) => r.json()).then((res) => { if (res.success) setEmployees(res.data); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdded = (w: Warehouse) => { setWarehouses((p) => [w, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (w: Warehouse) => { setWarehouses((p) => p.map((x) => x.id === w.id ? w : x)); };

  const visible = search ? warehouses.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.code.toLowerCase().includes(search.toLowerCase())) : warehouses;

  return (
    <>
      <Header title="Warehouses" subtitle="Inventory Module"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            {can.create("inventory") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Warehouse</button>}
          </div>
        }
      />
      <PageWrapper>
        {!authLoading && user && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            {[["Add", can.create("inventory")], ["Edit", can.edit("inventory")], ["Deactivate", can.full("inventory")]].map(([l, v]) => (
              <span key={String(l)} className={v ? "text-emerald-600" : "text-gray-400"}>{v ? "✓" : "✗"} {l}</span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code…" className="input pl-8 text-xs py-1.5" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
        </div>

        <SectionTitle title="Warehouses" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["Code", "Name", "Location", "Capacity", "Manager", "Status", ""].map((h) => (
                    <th key={h} className="text-left table-header px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7}><TableSkeleton rows={5} cols={7} /></td></tr>
                  : visible.length === 0 ? <tr><td colSpan={7}><EmptyState title="No warehouses found" description="Create your first warehouse." action={can.create("inventory") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Warehouse</button> : undefined} /></td></tr>
                    : visible.map((wh) => {
                      const manager = (wh as any).manager;
                      return (
                        <tr key={wh.id} onClick={() => setEditWh(wh)} className={clsx("border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group", !wh.is_active && "opacity-50")}>
                          <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{wh.code}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="font-medium text-gray-900">{wh.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{wh.location}</td>
                          <td className="px-4 py-3 tabular-nums text-gray-700">{wh.capacity.toLocaleString()} units</td>
                          <td className="px-4 py-3 text-gray-600">{manager ? <div><p className="text-sm">{manager.full_name}</p><p className="text-xs text-gray-400">{manager.position}</p></div> : <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3">
                            <span className={clsx("badge text-xs", wh.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400")}>
                              {wh.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3"><Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" /></td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>

      <AddWarehouseDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} employees={employees} />
      <EditWarehouseDrawer warehouse={editWh} onClose={() => setEditWh(null)} onSuccess={handleUpdated} employees={employees} />
    </>
  );
}