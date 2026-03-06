"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, X, ChevronRight,
  CheckCircle2, Loader2, AlertCircle, Lock, ChevronDown, ChevronUp,
  Play, Pause, Flag, Ban, PackageCheck, AlertTriangle,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { WorkOrder, BillOfMaterials, Product } from "@/types";
import { clsx } from "clsx";

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { color: string; label: string; icon: any }> = {
  planned: { color: "bg-gray-100 text-gray-600", label: "Planned", icon: null },
  in_progress: { color: "bg-blue-50 text-blue-700", label: "In Progress", icon: Play },
  on_hold: { color: "bg-amber-50 text-amber-700", label: "On Hold", icon: Pause },
  completed: { color: "bg-emerald-50 text-emerald-700", label: "Completed", icon: Flag },
  cancelled: { color: "bg-red-50 text-red-600", label: "Cancelled", icon: Ban },
};

const WO_ACTIONS = [
  { to: "in_progress", label: "Start Production", icon: Play, from: ["planned", "on_hold"], note: "" },
  { to: "on_hold", label: "Place on Hold", icon: Pause, from: ["in_progress"], note: "" },
  { to: "completed", label: "Complete Work Order", icon: Flag, from: ["in_progress"], note: "Consumes materials & adds finished goods to stock", highlight: true },
  { to: "cancelled", label: "Cancel", icon: Ban, from: ["planned", "in_progress", "on_hold"], danger: true },
];

const today = () => new Date().toISOString().split("T")[0];
const futureDate = (d: number) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().split("T")[0]; };

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{msg}</p>;
}

// ── Drawer shell ───────────────────────────────────────────────────────────────
function Drawer({ open, onClose, title, subtitle, wide, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; wide?: boolean; children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <>
      <div onClick={onClose} className={clsx("fixed inset-0 bg-black/30 z-40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0 pointer-events-none")} />
      <div className={clsx("fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300",
        wide ? "w-[680px]" : "w-[560px]", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[580px]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
          <span>Production</span><ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Work Orders</span>
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
        <button onClick={onSubmit} disabled={busy || ok || disabled} className="btn-primary min-w-[140px] justify-center">
          {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : ok ? <><CheckCircle2 className="w-3.5 h-3.5" />Saved!</> : label}
        </button>
      </div>
    </div>
  );
}

// ── Material availability panel ────────────────────────────────────────────────
function MaterialAvailability({ bom, quantity }: { bom: any; quantity: number }) {
  const items = bom?.bom_items || [];
  if (!items.length) return null;

  const rows = items.map((item: any) => {
    const required = item.quantity * quantity;
    const onHand = item.products?.quantity_on_hand ?? 0;
    const ok = onHand >= required;
    return { item, required, onHand, ok };
  });
  const allOk = rows.every((r: any) => r.ok);

  return (
    <div className={clsx("rounded-xl border p-3 space-y-2", allOk ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200")}>
      <p className={clsx("text-xs font-semibold flex items-center gap-1.5", allOk ? "text-emerald-700" : "text-amber-700")}>
        {allOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
        Material Availability {allOk ? "— All OK" : "— Shortages Detected"}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-current/10">
            <th className="text-left pb-1.5 font-medium text-gray-500">Component</th>
            <th className="text-right pb-1.5 font-medium text-gray-500">Required</th>
            <th className="text-right pb-1.5 font-medium text-gray-500">On Hand</th>
            <th className="text-right pb-1.5 font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, required, onHand, ok }: any) => (
            <tr key={item.id} className="border-b border-current/5 last:border-0">
              <td className="py-1.5 font-medium text-gray-800">{item.products?.name || "—"}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-700">{required} {item.unit_of_measure}</td>
              <td className={clsx("py-1.5 text-right tabular-nums font-medium", ok ? "text-emerald-700" : "text-red-600")}>{onHand}</td>
              <td className="py-1.5 text-right">
                {ok
                  ? <span className="text-emerald-600">✓</span>
                  : <span className="text-red-600 font-medium">−{required - onHand}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── WO form fields ─────────────────────────────────────────────────────────────
interface WOFields { wo_number: string; product_id: string; bom_id: string; quantity: string; planned_start: string; planned_end: string; notes: string; }
interface WOErrors { wo_number?: string; product_id?: string; bom_id?: string; quantity?: string; planned_start?: string; planned_end?: string; }

const EMPTY_WO: WOFields = { wo_number: "", product_id: "", bom_id: "", quantity: "1", planned_start: today(), planned_end: futureDate(7), notes: "" };

function validateWO(f: WOFields): WOErrors {
  const e: WOErrors = {};
  if (!f.wo_number.trim()) e.wo_number = "WO number is required.";
  if (!f.product_id) e.product_id = "Select a product to manufacture.";
  if (!f.bom_id) e.bom_id = "Select a BOM.";
  if (!f.quantity || parseFloat(f.quantity) <= 0) e.quantity = "Quantity must be greater than 0.";
  if (!f.planned_start) e.planned_start = "Planned start is required.";
  if (!f.planned_end) e.planned_end = "Planned end is required.";
  else if (f.planned_end < f.planned_start) e.planned_end = "Must be on or after start date.";
  return e;
}

// ── Add WO Drawer ──────────────────────────────────────────────────────────────
function AddWODrawer({ open, onClose, onSuccess, products, boms }: {
  open: boolean; onClose: () => void; onSuccess: (wo: WorkOrder) => void;
  products: Product[]; boms: BillOfMaterials[];
}) {
  const { can } = useAuth();
  const canCreate = can.create("production");
  const [f, setF] = useState<WOFields>(EMPTY_WO);
  const [errs, setErrs] = useState<WOErrors>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof WOFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };

  // Filter BOMs for selected product
  const availableBOMs = boms.filter((b) => b.product_id === f.product_id && b.is_active);
  const selectedBOM = boms.find((b) => b.id === f.bom_id);

  // Auto-select BOM when only one available
  useEffect(() => {
    if (availableBOMs.length === 1) set("bom_id", availableBOMs[0].id);
    else set("bom_id", "");
  }, [f.product_id]);

  useEffect(() => {
    if (open) { setF({ ...EMPTY_WO, planned_start: today(), planned_end: futureDate(7) }); setErrs({}); setOk(false); setErr(""); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const e = validateWO(f);
    if (Object.keys(e).length) { setErrs(e); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/production/work-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, quantity: parseFloat(f.quantity) }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else setErr(data.message || "Failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Work Order" subtitle="Schedule a production run" wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate
          ? <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200"><Lock className="w-4 h-4 text-amber-500 mt-0.5" /><p className="text-sm text-amber-700">Your role cannot create work orders.</p></div>
          : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">WO Number <span className="text-red-500">*</span></label>
                  <input ref={firstRef} type="text" value={f.wo_number} onChange={(e) => set("wo_number", e.target.value)}
                    placeholder="e.g. WO-2026-001" className={clsx("input font-mono", errs.wo_number && "border-red-400")} />
                  <FieldErr msg={errs.wo_number} />
                </div>
                <div>
                  <label className="label">Quantity <span className="text-red-500">*</span></label>
                  <input type="number" min="0.001" step="0.001" value={f.quantity} onChange={(e) => set("quantity", e.target.value)}
                    className={clsx("input tabular-nums", errs.quantity && "border-red-400")} />
                  <FieldErr msg={errs.quantity} />
                </div>
              </div>

              <div>
                <label className="label">Product to Manufacture <span className="text-red-500">*</span></label>
                <select value={f.product_id} onChange={(e) => set("product_id", e.target.value)}
                  className={clsx("input", errs.product_id && "border-red-400")}>
                  <option value="">— Select product —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
                <FieldErr msg={errs.product_id} />
              </div>

              <div>
                <label className="label">Bill of Materials <span className="text-red-500">*</span></label>
                <select value={f.bom_id} onChange={(e) => set("bom_id", e.target.value)}
                  disabled={!f.product_id || availableBOMs.length === 0}
                  className={clsx("input", errs.bom_id && "border-red-400", (!f.product_id || availableBOMs.length === 0) && "opacity-60 cursor-not-allowed")}>
                  <option value="">
                    {!f.product_id ? "— Select a product first —"
                      : availableBOMs.length === 0 ? "— No active BOMs for this product —"
                        : "— Select BOM —"}
                  </option>
                  {availableBOMs.map((b) => <option key={b.id} value={b.id}>v{b.version} — {(b as any).products?.name}</option>)}
                </select>
                <FieldErr msg={errs.bom_id} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Planned Start <span className="text-red-500">*</span></label>
                  <input type="date" value={f.planned_start} onChange={(e) => set("planned_start", e.target.value)}
                    className={clsx("input", errs.planned_start && "border-red-400")} />
                  <FieldErr msg={errs.planned_start} />
                </div>
                <div>
                  <label className="label">Planned End <span className="text-red-500">*</span></label>
                  <input type="date" value={f.planned_end} min={f.planned_start} onChange={(e) => set("planned_end", e.target.value)}
                    className={clsx("input", errs.planned_end && "border-red-400")} />
                  <FieldErr msg={errs.planned_end} />
                </div>
              </div>

              <div>
                <label className="label">Notes <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
                <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)}
                  rows={2} className="input resize-none" placeholder="Production instructions, batch notes…" />
              </div>

              {/* Material availability preview */}
              {selectedBOM && parseFloat(f.quantity) > 0 && (
                <MaterialAvailability bom={selectedBOM} quantity={parseFloat(f.quantity)} />
              )}
            </>
          )}
        {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{err}</div>}
        {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Work order created!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSubmit} busy={busy} ok={ok} label="Create Work Order" disabled={!canCreate} />
    </Drawer>
  );
}

// ── View/Edit WO Drawer ────────────────────────────────────────────────────────
function ViewWODrawer({ wo: initialWO, onClose, onSuccess, products, boms }: {
  wo: WorkOrder | null; onClose: () => void; onSuccess: (wo: WorkOrder) => void;
  products: Product[]; boms: BillOfMaterials[];
}) {
  const open = !!initialWO;
  const { can } = useAuth();
  const canEdit = can.edit("production");

  const [wo, setWO] = useState<WorkOrder | null>(initialWO);
  const [f, setF] = useState<WOFields>(EMPTY_WO);
  const [errs, setErrs] = useState<WOErrors>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showMaterials, setShowMaterials] = useState(true);

  useEffect(() => {
    if (initialWO) {
      setWO(initialWO);
      setF({
        wo_number: initialWO.wo_number,
        product_id: initialWO.product_id,
        bom_id: initialWO.bom_id,
        quantity: String(initialWO.quantity),
        planned_start: initialWO.planned_start?.split("T")[0] || today(),
        planned_end: initialWO.planned_end?.split("T")[0] || futureDate(7),
        notes: initialWO.notes || "",
      });
      setErrs({}); setOk(false); setErr(""); setConfirmCancel(false);
    }
  }, [initialWO]);

  const set = (k: keyof WOFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };
  const isEditable = wo?.status === "planned";
  const availableBOMs = boms.filter((b) => b.product_id === f.product_id && b.is_active);
  const bom = (wo as any)?.bill_of_materials;

  const handleSave = async () => {
    const e = validateWO(f);
    if (Object.keys(e).length || !wo) { setErrs(e); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/production/work-orders/${wo.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, quantity: parseFloat(f.quantity) }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); setWO(data.data); onSuccess(data.data); setTimeout(() => setOk(false), 2000); }
      else setErr(data.message || "Update failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  const handleAction = async (status: string) => {
    if (!wo) return;
    setActionBusy(status); setErr("");
    try {
      const res = await fetch(`/api/production/work-orders/${wo.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { setWO(data.data); onSuccess(data.data); setConfirmCancel(false); }
      else setErr(data.message || "Action failed.");
    } catch { setErr("Network error."); }
    finally { setActionBusy(null); }
  };

  const availableActions = WO_ACTIONS.filter((a) => wo && a.from.includes(wo.status as any));
  const prod = (wo as any)?.products;
  const qty = parseFloat(f.quantity || "1");

  // Duration in days
  const duration = wo?.planned_start && wo?.planned_end
    ? Math.ceil((new Date(wo.planned_end).getTime() - new Date(wo.planned_start).getTime()) / 86400000)
    : null;

  return (
    <Drawer open={open} onClose={onClose} title="Work Order"
      subtitle={wo ? `${wo.wo_number} · ${prod?.name || ""}` : ""} wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Status bar */}
        {wo && (
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const m = STATUS_META[wo.status]; return (
                <span className={clsx("badge font-medium text-xs px-2.5 py-1 flex items-center gap-1", m.color)}>
                  {m.icon && <m.icon className="w-3 h-3" />}{m.label}
                </span>
              );
            })()}
            <span className="text-xs text-gray-400">{formatDate(wo.planned_start)} → {formatDate(wo.planned_end)}</span>
            {duration !== null && <span className="text-xs text-gray-400">{duration} day{duration !== 1 ? "s" : ""}</span>}
            {wo.actual_start && <span className="text-xs text-blue-600">Started {formatDate(wo.actual_start)}</span>}
            {wo.actual_end && <span className="text-xs text-emerald-600">Completed {formatDate(wo.actual_end)}</span>}
          </div>
        )}

        {/* Header fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">WO Number</label>
            <input type="text" value={f.wo_number} disabled className="input font-mono opacity-60 cursor-not-allowed bg-surface-200" />
          </div>
          <div>
            <label className="label">Quantity <span className="text-red-500">*</span></label>
            <input type="number" min="0.001" step="0.001" value={f.quantity} onChange={(e) => set("quantity", e.target.value)}
              disabled={!canEdit || !isEditable}
              className={clsx("input tabular-nums", errs.quantity && "border-red-400", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
            {prod && <p className="mt-1 text-xs text-gray-400">{prod.unit_of_measure}</p>}
            <FieldErr msg={errs.quantity} />
          </div>
        </div>

        <div>
          <label className="label">Product</label>
          <select value={f.product_id} onChange={(e) => set("product_id", e.target.value)}
            disabled={!canEdit || !isEditable}
            className={clsx("input", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")}>
            <option value="">— Select product —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Bill of Materials</label>
          <select value={f.bom_id} onChange={(e) => set("bom_id", e.target.value)}
            disabled={!canEdit || !isEditable || availableBOMs.length === 0}
            className={clsx("input", errs.bom_id && "border-red-400", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")}>
            <option value="">— Select BOM —</option>
            {availableBOMs.map((b) => <option key={b.id} value={b.id}>v{b.version}</option>)}
          </select>
          <FieldErr msg={errs.bom_id} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[["Planned Start", "planned_start"], ["Planned End", "planned_end"]].map(([label, key]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input type="date" value={f[key as keyof WOFields]}
                onChange={(e) => set(key as keyof WOFields, e.target.value)}
                disabled={!canEdit || !isEditable}
                className={clsx("input", errs[key as keyof WOErrors] && "border-red-400", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
              <FieldErr msg={errs[key as keyof WOErrors]} />
            </div>
          ))}
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
            disabled={!canEdit || !isEditable}
            className={clsx("input resize-none", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
        </div>

        {/* Material availability */}
        {bom && qty > 0 && (
          <div>
            <button className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-brand-600 transition-colors w-full"
              onClick={() => setShowMaterials((p) => !p)}>
              <PackageCheck className="w-3.5 h-3.5" /> Material Check
              {showMaterials ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
            </button>
            {showMaterials && <MaterialAvailability bom={bom} quantity={qty} />}
          </div>
        )}

        {/* Workflow actions */}
        {availableActions.length > 0 && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow</p>
            {availableActions.filter((a) => !a.danger).map((action) => (
              <button key={action.to}
                onClick={() => canEdit && handleAction(action.to)}
                disabled={!canEdit || !!actionBusy}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                  !canEdit ? "border-surface-300 text-gray-300 cursor-not-allowed"
                    : (action as any).highlight
                      ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
                      : "border-surface-400 hover:border-brand-400 hover:bg-surface-50 text-gray-700"
                )}>
                <span className={clsx("flex items-center gap-2", !canEdit ? "text-gray-300" : (action as any).highlight ? "text-emerald-700" : "text-brand-700")}>
                  <action.icon className="w-4 h-4" />
                  {action.label}
                  {action.note && <span className="text-xs text-gray-400 font-normal">— {action.note}</span>}
                </span>
                {actionBusy === action.to ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
            ))}

            {/* Cancel with confirm */}
            {availableActions.some((a) => a.danger) && (
              !confirmCancel ? (
                <button onClick={() => canEdit && setConfirmCancel(true)} disabled={!canEdit}
                  className={clsx("flex items-center gap-2 text-xs font-medium", canEdit ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed")}>
                  <Ban className="w-3.5 h-3.5" /> Cancel work order
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Cancel <strong>{wo?.wo_number}</strong>? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleAction("cancelled")} disabled={!!actionBusy}
                      className="btn-danger text-xs py-1.5 px-3">{actionBusy === "cancelled" ? "Cancelling…" : "Confirm Cancel"}</button>
                    <button onClick={() => setConfirmCancel(false)} className="btn-secondary text-xs py-1.5 px-3">Keep</button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{err}</div>}
        {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Changes saved!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSave} busy={busy} ok={ok} label="Save Changes" disabled={!canEdit || !isEditable} />
    </Drawer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function WorkOrdersPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [viewWO, setViewWO] = useState<WorkOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (statusFilter) p.set("status", statusFilter);
    fetch(`/api/production/work-orders?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setOrders(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    fetch("/api/inventory/products?pageSize=300").then((r) => r.json()).then((res) => { if (res.success) setProducts(res.data); });
    fetch("/api/production/bom?pageSize=200&inactive=true").then((r) => r.json()).then((res) => { if (res.success) setBoms(res.data); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdded = (wo: WorkOrder) => { setOrders((p) => [wo, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (wo: WorkOrder) => { setOrders((p) => p.map((x) => x.id === wo.id ? wo : x)); setViewWO(wo); };

  const visible = search
    ? orders.filter((o) => o.wo_number.toLowerCase().includes(search.toLowerCase()) || (o as any).products?.name?.toLowerCase().includes(search.toLowerCase()))
    : orders;

  const summary = {
    active: orders.filter((o) => o.status === "in_progress").length,
    planned: orders.filter((o) => o.status === "planned").length,
    completed: orders.filter((o) => o.status === "completed").length,
    overdue: orders.filter((o) => ["planned", "in_progress"].includes(o.status) && new Date(o.planned_end) < new Date()).length,
  };

  return (
    <>
      <Header title="Work Orders" subtitle="Production Module"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
            {can.create("production") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New WO</button>}
          </div>
        }
      />
      <PageWrapper>
        {!authLoading && user && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            {[["Create", can.create("production")], ["Edit/Progress", can.edit("production")]].map(([l, v]) => (
              <span key={String(l)} className={v ? "text-emerald-600" : "text-gray-400"}>{v ? "✓" : "✗"} {l}</span>
            ))}
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">In Progress</span>
              <span className="text-2xl font-bold text-blue-700">{summary.active}</span>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Planned</span>
              <span className="text-2xl font-bold text-gray-900">{summary.planned}</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Completed</span>
              <span className="text-2xl font-bold text-emerald-700">{summary.completed}</span>
            </div>
            <div className={clsx("rounded-xl border px-4 py-3 flex items-center justify-between", summary.overdue > 0 ? "bg-red-50 border-red-200" : "bg-white border-surface-300")}>
              <span className="text-xs text-gray-500">Overdue</span>
              <span className={clsx("text-2xl font-bold", summary.overdue > 0 ? "text-red-600" : "text-gray-400")}>{summary.overdue}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search WO # or product…" className="input pl-8 text-xs py-1.5" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </div>

        <SectionTitle title="Work Orders" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["WO Number", "Product", "BOM", "Quantity", "Planned Start", "Planned End", "Status", ""].map((h) => (
                    <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8}><TableSkeleton rows={6} cols={8} /></td></tr>
                  : visible.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState title="No work orders" description="Create a work order to schedule production."
                        action={can.create("production") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New WO</button> : undefined} />
                    </td></tr>
                  ) : visible.map((wo) => {
                    const meta = STATUS_META[wo.status];
                    const prod = (wo as any).products;
                    const bom = (wo as any).bill_of_materials;
                    const isOverdue = ["planned", "in_progress"].includes(wo.status) && new Date(wo.planned_end) < new Date();
                    return (
                      <tr key={wo.id} onClick={() => setViewWO(wo)}
                        className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{wo.wo_number}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{prod?.name || "—"}</p>
                          <p className="text-xs text-gray-400 font-mono">{prod?.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">v{bom?.version || "—"}</td>
                        <td className="px-4 py-3 tabular-nums text-gray-700 font-medium">
                          {wo.quantity} <span className="text-xs text-gray-400">{prod?.unit_of_measure}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{formatDate(wo.planned_start)}</td>
                        <td className={clsx("px-4 py-3 text-xs font-medium", isOverdue ? "text-red-600" : "text-gray-600")}>
                          {formatDate(wo.planned_end)}{isOverdue && " ⚠"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx("badge text-xs flex items-center gap-1 w-fit", meta.color)}>
                            {meta.icon && <meta.icon className="w-3 h-3" />}{meta.label}
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

      <AddWODrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} products={products} boms={boms} />
      <ViewWODrawer wo={viewWO} onClose={() => setViewWO(null)} onSuccess={handleUpdated} products={products} boms={boms} />
    </>
  );
}