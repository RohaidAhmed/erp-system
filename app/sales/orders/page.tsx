"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, Trash2, X, ChevronRight,
  CheckCircle2, Loader2, AlertCircle, Lock, ChevronDown, ChevronUp,
  CheckCheck, Package, Truck, Star, Ban,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { SalesOrder, Customer, Product, Currency } from "@/types";
import { clsx } from "clsx";

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { color: string; icon: any; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-600", icon: null, label: "Draft" },
  confirmed: { color: "bg-blue-50 text-blue-700", icon: CheckCheck, label: "Confirmed" },
  picking: { color: "bg-yellow-50 text-yellow-700", icon: Package, label: "Picking" },
  shipped: { color: "bg-purple-50 text-purple-700", icon: Truck, label: "Shipped" },
  delivered: { color: "bg-emerald-50 text-emerald-700", icon: Star, label: "Delivered" },
  cancelled: { color: "bg-red-50 text-red-600", icon: Ban, label: "Cancelled" },
};

const STATUS_ACTIONS = [
  { to: "confirmed", label: "Confirm Order", icon: CheckCheck, from: ["draft"], perm: "edit" },
  { to: "picking", label: "Start Picking", icon: Package, from: ["confirmed"], perm: "edit" },
  { to: "shipped", label: "Mark as Shipped", icon: Truck, from: ["picking"], perm: "edit", note: "Deducts stock from inventory" },
  { to: "delivered", label: "Mark as Delivered", icon: Star, from: ["shipped"], perm: "edit" },
  { to: "cancelled", label: "Cancel Order", icon: Ban, from: ["draft", "confirmed", "picking"], perm: "edit", danger: true },
];

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR", "AED"];
const today = () => new Date().toISOString().split("T")[0];
const futureDate = (d: number) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().split("T")[0]; };

// ── Helpers ────────────────────────────────────────────────────────────────────
function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{msg}</p>;
}

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
        wide ? "w-[700px]" : "w-[560px]", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[580px]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
          <span>Sales & CRM</span><ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Sales Orders</span>
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

// ── Line item editor (with discount) ──────────────────────────────────────────
interface LineItem { _key: string; product_id: string; quantity: string; unit_price: string; discount_pct: string; }

function SOLineItemEditor({ items, onChange, products, readOnly }: {
  items: LineItem[]; onChange: (items: LineItem[]) => void; products: Product[]; readOnly?: boolean;
}) {
  const addLine = () => onChange([...items, { _key: crypto.randomUUID(), product_id: "", quantity: "1", unit_price: "0", discount_pct: "0" }]);

  const update = (key: string, field: keyof LineItem, value: string) => {
    onChange(items.map((item) => {
      if (item._key !== key) return item;
      const updated = { ...item, [field]: value };
      if (field === "product_id" && value) {
        const prod = products.find((p) => p.id === value);
        if (prod) updated.unit_price = String(prod.unit_price);
      }
      return updated;
    }));
  };

  const remove = (key: string) => onChange(items.filter((i) => i._key !== key));

  const subtotal = items.reduce((s, i) => {
    const line = parseFloat(i.quantity || "0") * parseFloat(i.unit_price || "0");
    return s + line * (1 - parseFloat(i.discount_pct || "0") / 100);
  }, 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 px-1">
        <div className="col-span-4 text-xs font-medium text-gray-500">Product</div>
        <div className="col-span-2 text-xs font-medium text-gray-500 text-right">Qty</div>
        <div className="col-span-2 text-xs font-medium text-gray-500 text-right">Unit Price</div>
        <div className="col-span-2 text-xs font-medium text-gray-500 text-right">Disc %</div>
        <div className="col-span-1 text-xs font-medium text-gray-500 text-right">Total</div>
        <div className="col-span-1" />
      </div>

      {items.length === 0 && !readOnly && (
        <div className="text-center py-6 border-2 border-dashed border-surface-300 rounded-xl text-sm text-gray-400">
          No items yet — click "Add Line" to start
        </div>
      )}

      {items.map((item) => {
        const line = parseFloat(item.quantity || "0") * parseFloat(item.unit_price || "0");
        const total = line * (1 - parseFloat(item.discount_pct || "0") / 100);
        const prod = products.find((p) => p.id === item.product_id);
        return (
          <div key={item._key} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4">
              <select value={item.product_id} onChange={(e) => update(item._key, "product_id", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5", readOnly && "opacity-60 cursor-not-allowed")}>
                <option value="">— Select —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
              {prod && <p className="mt-0.5 text-xs text-gray-400 pl-1">{prod.quantity_on_hand} on hand</p>}
            </div>
            <div className="col-span-2">
              <input type="number" min="0.001" step="0.001" value={item.quantity}
                onChange={(e) => update(item._key, "quantity", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5 text-right tabular-nums", readOnly && "opacity-60 cursor-not-allowed")} />
            </div>
            <div className="col-span-2">
              <input type="number" min="0" step="0.01" value={item.unit_price}
                onChange={(e) => update(item._key, "unit_price", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5 text-right tabular-nums", readOnly && "opacity-60 cursor-not-allowed")} />
            </div>
            <div className="col-span-2">
              <input type="number" min="0" max="100" step="0.5" value={item.discount_pct}
                onChange={(e) => update(item._key, "discount_pct", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5 text-right tabular-nums", readOnly && "opacity-60 cursor-not-allowed")} />
            </div>
            <div className="col-span-1 text-right text-xs font-medium text-gray-700 tabular-nums">{formatCurrency(total)}</div>
            <div className="col-span-1 flex justify-center">
              {!readOnly && <button onClick={() => remove(item._key)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2 border-t border-surface-200">
        {!readOnly ? (
          <button onClick={addLine} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
        ) : <div />}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Total:</span>
          <span className="font-bold text-gray-900 tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}

// ── SO form fields ─────────────────────────────────────────────────────────────
interface SOFields { so_number: string; customer_id: string; order_date: string; delivery_date: string; currency: Currency; notes: string; }
interface SOErrors { so_number?: string; customer_id?: string; order_date?: string; items?: string; }

const EMPTY_SO: SOFields = { so_number: "", customer_id: "", order_date: today(), delivery_date: futureDate(7), currency: "USD", notes: "" };

function validateSO(f: SOFields, items: LineItem[]): SOErrors {
  const e: SOErrors = {};
  if (!f.so_number.trim()) e.so_number = "SO number is required.";
  if (!f.customer_id) e.customer_id = "Select a customer.";
  if (!f.order_date) e.order_date = "Order date is required.";
  if (!items.length || !items.every((i) => i.product_id && parseFloat(i.quantity) > 0))
    e.items = "At least one complete line item is required.";
  return e;
}

// ── Add SO Drawer ──────────────────────────────────────────────────────────────
function AddSODrawer({ open, onClose, onSuccess, customers, products }: {
  open: boolean; onClose: () => void; onSuccess: (so: SalesOrder) => void;
  customers: Customer[]; products: Product[];
}) {
  const { can } = useAuth();
  const canCreate = can.create("sales");
  const [f, setF] = useState<SOFields>(EMPTY_SO);
  const [errs, setErrs] = useState<SOErrors>({});
  const [items, setItems] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof SOFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };

  useEffect(() => {
    const cust = customers.find((c) => c.id === f.customer_id);
    if (cust) setF((p) => ({ ...p, currency: cust.currency }));
  }, [f.customer_id]);

  useEffect(() => {
    if (open) { setF({ ...EMPTY_SO, order_date: today(), delivery_date: futureDate(7) }); setItems([]); setErrs({}); setOk(false); setErr(""); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const e = validateSO(f, items);
    if (Object.keys(e).length) { setErrs(e); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/sales/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f, delivery_date: f.delivery_date || undefined,
          items: items.map((i) => ({ product_id: i.product_id, quantity: parseFloat(i.quantity), unit_price: parseFloat(i.unit_price), discount_pct: parseFloat(i.discount_pct || "0") })),
        }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else setErr(data.message || "Failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Sales Order" subtitle="Create a draft sales order" wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate ? (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200"><Lock className="w-4 h-4 text-amber-500 mt-0.5" /><p className="text-sm text-amber-700">Your role cannot create sales orders.</p></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">SO Number <span className="text-red-500">*</span></label>
                <input ref={firstRef} type="text" value={f.so_number} onChange={(e) => set("so_number", e.target.value)}
                  placeholder="e.g. SO-2026-001" className={clsx("input font-mono", errs.so_number && "border-red-400")} />
                <FieldErr msg={errs.so_number} />
              </div>
              <div>
                <label className="label">Currency</label>
                <select value={f.currency} onChange={(e) => set("currency", e.target.value)} className="input">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Customer <span className="text-red-500">*</span></label>
              <select value={f.customer_id} onChange={(e) => set("customer_id", e.target.value)}
                className={clsx("input", errs.customer_id && "border-red-400")}>
                <option value="">— Select customer —</option>
                {customers.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>
                ))}
              </select>
              <FieldErr msg={errs.customer_id} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Order Date <span className="text-red-500">*</span></label>
                <input type="date" value={f.order_date} onChange={(e) => set("order_date", e.target.value)}
                  className={clsx("input", errs.order_date && "border-red-400")} />
                <FieldErr msg={errs.order_date} />
              </div>
              <div>
                <label className="label">Delivery Date <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
                <input type="date" value={f.delivery_date} min={f.order_date} onChange={(e) => set("delivery_date", e.target.value)} className="input" />
              </div>
            </div>

            <div>
              <label className="label">Notes <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
              <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="input resize-none" placeholder="Delivery instructions, special requirements…" />
            </div>

            <div className="pt-2 border-t border-surface-200">
              <p className="label mb-3">Line Items <span className="text-red-500">*</span></p>
              <SOLineItemEditor items={items} onChange={setItems} products={products} />
              {errs.items && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.items}</p>}
            </div>
          </>
        )}
        {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{err}</div>}
        {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Sales order created!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSubmit} busy={busy} ok={ok} label="Create SO" disabled={!canCreate} />
    </Drawer>
  );
}

// ── View/Edit SO Drawer ────────────────────────────────────────────────────────
function ViewSODrawer({ so: initialSo, onClose, onSuccess, customers, products }: {
  so: SalesOrder | null; onClose: () => void; onSuccess: (so: SalesOrder) => void;
  customers: Customer[]; products: Product[];
}) {
  const open = !!initialSo;
  const { can } = useAuth();
  const canEdit = can.edit("sales");

  const [so, setSo] = useState<SalesOrder | null>(initialSo);
  const [f, setF] = useState<SOFields>(EMPTY_SO);
  const [errs, setErrs] = useState<SOErrors>({});
  const [items, setItems] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [expandItems, setExpandItems] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (initialSo) {
      setSo(initialSo);
      setF({
        so_number: initialSo.so_number, customer_id: initialSo.customer_id,
        order_date: initialSo.order_date?.split("T")[0] || today(),
        delivery_date: initialSo.delivery_date?.split("T")[0] || "",
        currency: initialSo.currency, notes: initialSo.notes || "",
      });
      const existingItems = ((initialSo as any).sales_order_items || []).map((i: any) => ({
        _key: i.id, product_id: i.product_id, quantity: String(i.quantity),
        unit_price: String(i.unit_price), discount_pct: String(i.discount_pct),
      }));
      setItems(existingItems);
      setErrs({}); setOk(false); setErr(""); setConfirmCancel(false);
    }
  }, [initialSo]);

  const set = (k: keyof SOFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };
  const isEditable = so?.status === "draft";

  const handleSave = async () => {
    const e = validateSO(f, items);
    if (Object.keys(e).length || !so) { setErrs(e); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/sales/orders/${so.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f, delivery_date: f.delivery_date || undefined,
          items: items.map((i) => ({ product_id: i.product_id, quantity: parseFloat(i.quantity), unit_price: parseFloat(i.unit_price), discount_pct: parseFloat(i.discount_pct || "0") })),
        }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); setSo(data.data); onSuccess(data.data); setTimeout(() => setOk(false), 2000); }
      else setErr(data.message || "Update failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  const handleAction = async (status: string) => {
    if (!so) return;
    setActionBusy(status); setErr("");
    try {
      const res = await fetch(`/api/sales/orders/${so.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { setSo(data.data); onSuccess(data.data); setConfirmCancel(false); }
      else setErr(data.message || "Action failed.");
    } catch { setErr("Network error."); }
    finally { setActionBusy(null); }
  };

  const availableActions = STATUS_ACTIONS.filter((a) => so && a.from.includes(so.status as any));
  const soItems = (so as any)?.sales_order_items || [];

  return (
    <Drawer open={open} onClose={onClose} title="Sales Order"
      subtitle={so ? `${so.so_number} · ${(so as any).customers?.name || ""}` : ""} wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Status */}
        {so && (
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const m = STATUS_META[so.status]; return (
                <span className={clsx("badge font-medium text-xs px-2.5 py-1 flex items-center gap-1", m.color)}>
                  {m.icon && <m.icon className="w-3 h-3" />}{m.label}
                </span>
              );
            })()}
            <span className="text-xs text-gray-400">{formatDate(so.order_date)}</span>
            {so.delivery_date && <span className="text-xs text-gray-500">Deliver by: {formatDate(so.delivery_date)}</span>}
          </div>
        )}

        {/* Header */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">SO Number</label>
            <input type="text" value={f.so_number} disabled className="input font-mono opacity-60 cursor-not-allowed bg-surface-200" />
          </div>
          <div>
            <label className="label">Currency</label>
            <select value={f.currency} onChange={(e) => set("currency", e.target.value)}
              disabled={!canEdit || !isEditable} className={clsx("input", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Customer</label>
          <select value={f.customer_id} onChange={(e) => set("customer_id", e.target.value)}
            disabled={!canEdit || !isEditable}
            className={clsx("input", errs.customer_id && "border-red-400", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")}>
            <option value="">— Select —</option>
            {customers.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Order Date</label>
            <input type="date" value={f.order_date} onChange={(e) => set("order_date", e.target.value)}
              disabled={!canEdit || !isEditable} className={clsx("input", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
          </div>
          <div>
            <label className="label">Delivery Date</label>
            <input type="date" value={f.delivery_date} min={f.order_date} onChange={(e) => set("delivery_date", e.target.value)}
              disabled={!canEdit || !isEditable} className={clsx("input", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
            disabled={!canEdit || !isEditable}
            className={clsx("input resize-none", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
        </div>

        {/* Line items */}
        <div className="pt-2 border-t border-surface-200">
          <button className="flex items-center gap-2 w-full label mb-3 hover:text-brand-600 transition-colors"
            onClick={() => setExpandItems((p) => !p)}>
            Line Items <span className="badge bg-surface-200 text-gray-600 text-xs">{soItems.length}</span>
            <span className="font-bold tabular-nums ml-auto">{formatCurrency(so?.total_amount || 0, so?.currency)}</span>
            {expandItems ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
          </button>
          {expandItems && (
            <SOLineItemEditor items={items} onChange={setItems} products={products} readOnly={!canEdit || !isEditable} />
          )}
          {errs.items && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.items}</p>}
        </div>

        {/* Workflow actions */}
        {availableActions.length > 0 && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow</p>
            {availableActions.filter((a) => a.to !== "cancelled").map((action) => (
              <button key={action.to}
                onClick={() => canEdit && handleAction(action.to)}
                disabled={!canEdit || !!actionBusy}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                  !canEdit ? "border-surface-300 text-gray-300 cursor-not-allowed bg-surface-50"
                    : "border-surface-400 hover:border-brand-400 hover:bg-surface-50 text-gray-700"
                )}>
                <span className={clsx("flex items-center gap-2", !canEdit ? "text-gray-300" : "text-brand-700")}>
                  <action.icon className="w-4 h-4" />
                  {action.label}
                  {(action as any).note && <span className="text-xs text-gray-400 font-normal">— {(action as any).note}</span>}
                </span>
                {actionBusy === action.to ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
            ))}

            {/* Cancel — separate with confirm */}
            {availableActions.some((a) => a.to === "cancelled") && (
              !confirmCancel ? (
                <button onClick={() => canEdit && setConfirmCancel(true)} disabled={!canEdit}
                  className={clsx("flex items-center gap-2 text-xs font-medium transition-colors", canEdit ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed")}>
                  <Ban className="w-3.5 h-3.5" /> Cancel order
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Cancel <strong>{so?.so_number}</strong>? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleAction("cancelled")} disabled={!!actionBusy}
                      className="btn-danger text-xs py-1.5 px-3">{actionBusy === "cancelled" ? "Cancelling…" : "Confirm Cancel"}</button>
                    <button onClick={() => setConfirmCancel(false)} className="btn-secondary text-xs py-1.5 px-3">Keep order</button>
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
export default function SalesOrdersPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [viewSO, setViewSO] = useState<SalesOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [custFilter, setCustFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (statusFilter) p.set("status", statusFilter);
    if (custFilter) p.set("customer_id", custFilter);
    fetch(`/api/sales/orders?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setOrders(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [statusFilter, custFilter]);

  useEffect(() => {
    fetch("/api/sales/customers?pageSize=200").then((r) => r.json()).then((res) => { if (res.success) setCustomers(res.data); });
    fetch("/api/inventory/products?pageSize=300").then((r) => r.json()).then((res) => { if (res.success) setProducts(res.data); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdded = (so: SalesOrder) => { setOrders((p) => [so, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (so: SalesOrder) => { setOrders((p) => p.map((x) => x.id === so.id ? so : x)); setViewSO(so); };

  const visible = search ? orders.filter((o) =>
    o.so_number.toLowerCase().includes(search.toLowerCase()) ||
    (o as any).customers?.name?.toLowerCase().includes(search.toLowerCase())
  ) : orders;

  const summary = {
    total: orders.reduce((s, o) => s + o.total_amount, 0),
    open: orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  };

  return (
    <>
      <Header title="Sales Orders" subtitle="Sales & CRM"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
            {can.create("sales") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New SO</button>}
          </div>
        }
      />
      <PageWrapper>
        {!authLoading && user && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            {[["Create", can.create("sales")], ["Edit", can.edit("sales")]].map(([l, v]) => (
              <span key={String(l)} className={v ? "text-emerald-600" : "text-gray-400"}>{v ? "✓" : "✗"} {l}</span>
            ))}
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Total Order Value</span>
              <span className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(summary.total)}</span>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Open Orders</span>
              <span className="text-2xl font-bold text-gray-900">{summary.open}</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Delivered</span>
              <span className="text-2xl font-bold text-emerald-700">{summary.delivered}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SO # or customer…" className="input pl-8 text-xs py-1.5" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
          <select value={custFilter} onChange={(e) => setCustFilter(e.target.value)} className="input !w-auto text-xs py-1.5 max-w-[200px]">
            <option value="">All Customers</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>)}
          </select>
        </div>

        <SectionTitle title="Sales Orders" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["SO Number", "Customer", "Order Date", "Delivery", "Items", "Total", "Status", ""].map((h) => (
                    <th key={h} className={clsx("table-header px-4 py-3", h === "Total" ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8}><TableSkeleton rows={6} cols={8} /></td></tr>
                  : visible.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState title="No sales orders" description="Create your first sales order."
                        action={can.create("sales") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New SO</button> : undefined} />
                    </td></tr>
                  ) : visible.map((so) => {
                    const meta = STATUS_META[so.status];
                    const cust = (so as any).customers;
                    const items = (so as any).sales_order_items || [];
                    const isLate = so.delivery_date && new Date(so.delivery_date) < new Date() && !["delivered", "cancelled"].includes(so.status);
                    return (
                      <tr key={so.id} onClick={() => setViewSO(so)} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{so.so_number}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{cust?.name || "—"}</p>
                          <p className="text-xs text-gray-400 font-mono">{cust?.customer_code}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{formatDate(so.order_date)}</td>
                        <td className={clsx("px-4 py-3 text-xs", isLate ? "text-red-600 font-medium" : "text-gray-600")}>
                          {so.delivery_date ? formatDate(so.delivery_date) : "—"}
                          {isLate && <span className="ml-1">⚠</span>}
                        </td>
                        <td className="px-4 py-3"><span className="badge bg-surface-200 text-gray-600 text-xs">{items.length} item{items.length !== 1 ? "s" : ""}</span></td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">{formatCurrency(so.total_amount, so.currency)}</td>
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

      <AddSODrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} customers={customers} products={products} />
      <ViewSODrawer so={viewSO} onClose={() => setViewSO(null)} onSuccess={handleUpdated} customers={customers} products={products} />
    </>
  );
}