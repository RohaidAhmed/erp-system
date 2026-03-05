"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, Trash2, PackageCheck,
  X, ChevronRight, CheckCircle2, Loader2, AlertCircle, Lock,
  Send, ThumbsUp, ShoppingCart, Truck, Ban, ChevronDown, ChevronUp,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { PurchaseOrder, PurchaseOrderItem, Supplier, Product, Currency, POStatus } from "@/types";
import { clsx } from "clsx";

// ── Status workflow ────────────────────────────────────────────────────────────
const STATUS_ACTIONS = [
  { to: "pending_approval", label: "Submit for Approval", icon: Send, color: "text-blue-600", from: ["draft"], perm: "edit" },
  { to: "approved", label: "Approve PO", icon: ThumbsUp, color: "text-green-600", from: ["pending_approval"], perm: "approve" },
  { to: "ordered", label: "Mark as Ordered", icon: ShoppingCart, color: "text-purple-600", from: ["approved"], perm: "edit" },
  { to: "cancelled", label: "Cancel PO", icon: Ban, color: "text-red-600", from: ["draft", "pending_approval", "approved", "ordered"], perm: "edit" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending_approval: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  ordered: "bg-purple-50 text-purple-700",
  received: "bg-teal-50 text-teal-700",
  cancelled: "bg-red-50 text-red-600",
};

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR", "AED"];

// ── Helpers ────────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const futureDate = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

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
        wide ? "w-[700px]" : "w-[560px]",
        open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[580px]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
          <span>Procurement</span><ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Purchase Orders</span>
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

// ── Line item editor ───────────────────────────────────────────────────────────
interface LineItem { _key: string; product_id: string; quantity: string; unit_cost: string; }

function LineItemEditor({ items, onChange, products, readOnly }: {
  items: LineItem[]; onChange: (items: LineItem[]) => void;
  products: Product[]; readOnly?: boolean;
}) {
  const addLine = () => onChange([...items, { _key: crypto.randomUUID(), product_id: "", quantity: "1", unit_cost: "0" }]);

  const update = (key: string, field: keyof LineItem, value: string) => {
    onChange(items.map((item) => {
      if (item._key !== key) return item;
      const updated = { ...item, [field]: value };
      // Auto-fill unit_cost from product when product changes
      if (field === "product_id" && value) {
        const prod = products.find((p) => p.id === value);
        if (prod) updated.unit_cost = String(prod.unit_cost);
      }
      return updated;
    }));
  };

  const remove = (key: string) => onChange(items.filter((i) => i._key !== key));

  const total = items.reduce((s, i) => s + (parseFloat(i.quantity || "0") * parseFloat(i.unit_cost || "0")), 0);

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="grid grid-cols-12 gap-2 px-1">
        <div className="col-span-5 text-xs font-medium text-gray-500">Product</div>
        <div className="col-span-2 text-xs font-medium text-gray-500 text-right">Qty</div>
        <div className="col-span-3 text-xs font-medium text-gray-500 text-right">Unit Cost</div>
        <div className="col-span-1 text-xs font-medium text-gray-500 text-right">Total</div>
        <div className="col-span-1" />
      </div>

      {items.length === 0 && !readOnly && (
        <div className="text-center py-6 border-2 border-dashed border-surface-300 rounded-xl text-sm text-gray-400">
          No items yet — click "Add Line" to start
        </div>
      )}

      {items.map((item) => {
        const lineTotal = parseFloat(item.quantity || "0") * parseFloat(item.unit_cost || "0");
        return (
          <div key={item._key} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-5">
              <select value={item.product_id} onChange={(e) => update(item._key, "product_id", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5", readOnly && "opacity-60 cursor-not-allowed")}>
                <option value="">— Select product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(e) => update(item._key, "quantity", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5 text-right tabular-nums", readOnly && "opacity-60 cursor-not-allowed")} />
            </div>
            <div className="col-span-3">
              <input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(e) => update(item._key, "unit_cost", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5 text-right tabular-nums", readOnly && "opacity-60 cursor-not-allowed")} />
            </div>
            <div className="col-span-1 text-right text-xs font-medium text-gray-700 tabular-nums">
              {formatCurrency(lineTotal)}
            </div>
            <div className="col-span-1 flex justify-center">
              {!readOnly && (
                <button onClick={() => remove(item._key)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Add line + total */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-200">
        {!readOnly ? (
          <button onClick={addLine} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
        ) : <div />}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Total:</span>
          <span className="font-bold text-gray-900 tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Goods Receipt Panel ────────────────────────────────────────────────────────
function GoodsReceiptPanel({ po, onReceive, loading }: {
  po: PurchaseOrder; onReceive: (receipts: { item_id: string; qty: number }[], warehouseId: string) => void;
  loading: boolean;
}) {
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState("");

  useEffect(() => {
    fetch("/api/inventory/warehouses?pageSize=100")
      .then((r) => r.json())
      .then((res) => { if (res.success) setWarehouses(res.data); });
  }, []);

  const items = (po as any).purchase_order_items || [];

  const handleSubmit = () => {
    const valid = items
      .filter((i: any) => receipts[i.id] && parseFloat(receipts[i.id]) > 0)
      .map((i: any) => ({ item_id: i.id, qty: parseFloat(receipts[i.id]) }));
    if (!valid.length) return;
    onReceive(valid, warehouseId);
  };

  const remaining = (item: any) => item.quantity - item.received_quantity;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Goods Receipt</p>

      {/* Warehouse selector */}
      <div>
        <label className="label text-xs">Destination Warehouse <span className="text-xs text-gray-400">(optional)</span></label>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input text-xs py-1.5">
          <option value="">— General receipt (no warehouse) —</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
        </select>
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-lg border border-surface-300">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-100 border-b border-surface-200">
              <th className="text-left px-3 py-2 font-medium text-gray-500">Product</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">Ordered</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">Received</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">Remaining</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500">Receive Now</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const rem = remaining(item);
              const isFullyReceived = rem <= 0;
              return (
                <tr key={item.id} className={clsx("border-b border-surface-200 last:border-0", isFullyReceived && "opacity-50")}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-800">{item.products?.name}</p>
                    <p className="text-gray-400 font-mono">{item.products?.sku}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{item.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{item.received_quantity}</td>
                  <td className={clsx("px-3 py-2 text-right tabular-nums font-medium", rem > 0 ? "text-amber-600" : "text-gray-400")}>{rem}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min="0" max={rem} step="0.001"
                      value={receipts[item.id] || ""}
                      onChange={(e) => setReceipts((p) => ({ ...p, [item.id]: e.target.value }))}
                      disabled={isFullyReceived}
                      placeholder={isFullyReceived ? "Done" : "0"}
                      className={clsx("input text-xs py-1 text-right w-24 ml-auto tabular-nums", isFullyReceived && "opacity-40 cursor-not-allowed")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button onClick={handleSubmit} disabled={loading}
        className="btn-primary w-full justify-center">
        {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Receiving…</> : <><PackageCheck className="w-3.5 h-3.5" />Confirm Goods Receipt</>}
      </button>
    </div>
  );
}

// ── PO Form fields ─────────────────────────────────────────────────────────────
interface POFields {
  po_number: string; supplier_id: string; order_date: string;
  expected_date: string; currency: Currency; notes: string;
}
interface POErrors { po_number?: string; supplier_id?: string; order_date?: string; expected_date?: string; items?: string; }

const EMPTY_PO: POFields = { po_number: "", supplier_id: "", order_date: today(), expected_date: futureDate(14), currency: "USD", notes: "" };

function validatePO(f: POFields, items: LineItem[]): POErrors {
  const e: POErrors = {};
  if (!f.po_number.trim()) e.po_number = "PO number is required.";
  if (!f.supplier_id) e.supplier_id = "Select a supplier.";
  if (!f.order_date) e.order_date = "Order date is required.";
  if (!f.expected_date) e.expected_date = "Expected delivery date is required.";
  else if (f.expected_date < f.order_date) e.expected_date = "Must be on or after order date.";
  if (!items.length || !items.every((i) => i.product_id && parseFloat(i.quantity) > 0)) {
    e.items = "At least one complete line item is required.";
  }
  return e;
}

// ── Add PO Drawer ──────────────────────────────────────────────────────────────
function AddPODrawer({ open, onClose, onSuccess, suppliers, products }: {
  open: boolean; onClose: () => void; onSuccess: (po: PurchaseOrder) => void;
  suppliers: Supplier[]; products: Product[];
}) {
  const { can } = useAuth();
  const canCreate = can.create("procurement");
  const [f, setF] = useState<POFields>(EMPTY_PO);
  const [errs, setErrs] = useState<POErrors>({});
  const [items, setItems] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof POFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };

  // Auto-fill currency from supplier
  useEffect(() => {
    if (f.supplier_id) {
      const sup = suppliers.find((s) => s.id === f.supplier_id);
      if (sup) setF((p) => ({ ...p, currency: sup.currency }));
    }
  }, [f.supplier_id]);

  useEffect(() => {
    if (open) {
      setF({ ...EMPTY_PO, order_date: today(), expected_date: futureDate(14) });
      setItems([]); setErrs({}); setOk(false); setErr("");
      setTimeout(() => firstRef.current?.focus(), 120);
    }
  }, [open]);

  const handleSubmit = async () => {
    const e = validatePO(f, items);
    if (Object.keys(e).length) { setErrs(e); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/procurement/purchase-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          items: items.map((i) => ({ product_id: i.product_id, quantity: parseFloat(i.quantity), unit_cost: parseFloat(i.unit_cost) })),
        }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else setErr(data.message || "Failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  const selectedSupplier = suppliers.find((s) => s.id === f.supplier_id);

  return (
    <Drawer open={open} onClose={onClose} title="New Purchase Order" subtitle="Create a draft PO for a supplier" wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate ? (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Lock className="w-4 h-4 text-amber-500 mt-0.5" />
            <p className="text-sm text-amber-700">Your role cannot create purchase orders. Requires Procurement Officer.</p>
          </div>
        ) : (
          <>
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">PO Number <span className="text-red-500">*</span></label>
                <input ref={firstRef} type="text" value={f.po_number} onChange={(e) => set("po_number", e.target.value)}
                  placeholder="e.g. PO-2026-001" className={clsx("input font-mono", errs.po_number && "border-red-400")} />
                <FieldErr msg={errs.po_number} />
              </div>
              <div>
                <label className="label">Currency</label>
                <select value={f.currency} onChange={(e) => set("currency", e.target.value)} className="input">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Supplier <span className="text-red-500">*</span></label>
              <select value={f.supplier_id} onChange={(e) => set("supplier_id", e.target.value)}
                className={clsx("input", errs.supplier_id && "border-red-400")}>
                <option value="">— Select supplier —</option>
                {suppliers.filter((s) => s.is_active).map((s) => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
              {selectedSupplier && (
                <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-2">
                  <span className="text-gray-400">Net-{selectedSupplier.payment_terms} days</span>
                  <span>·</span><span>{selectedSupplier.email}</span>
                </p>
              )}
              <FieldErr msg={errs.supplier_id} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Order Date <span className="text-red-500">*</span></label>
                <input type="date" value={f.order_date} onChange={(e) => set("order_date", e.target.value)}
                  className={clsx("input", errs.order_date && "border-red-400")} />
                <FieldErr msg={errs.order_date} />
              </div>
              <div>
                <label className="label">Expected Delivery <span className="text-red-500">*</span></label>
                <input type="date" value={f.expected_date} min={f.order_date}
                  onChange={(e) => set("expected_date", e.target.value)}
                  className={clsx("input", errs.expected_date && "border-red-400")} />
                <FieldErr msg={errs.expected_date} />
              </div>
            </div>

            <div>
              <label className="label">Notes <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
              <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)}
                rows={2} placeholder="Delivery instructions, terms…" className="input resize-none" />
            </div>

            {/* Line items */}
            <div className="pt-2 border-t border-surface-200">
              <p className="label mb-3">Line Items <span className="text-red-500">*</span></p>
              <LineItemEditor items={items} onChange={setItems} products={products} />
              {errs.items && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.items}</p>}
            </div>
          </>
        )}

        {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{err}</div>}
        {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Purchase order created!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSubmit} busy={busy} ok={ok} label="Create PO" disabled={!canCreate} />
    </Drawer>
  );
}

// ── View/Edit PO Drawer ────────────────────────────────────────────────────────
function ViewPODrawer({ po: initialPo, onClose, onSuccess, suppliers, products }: {
  po: PurchaseOrder | null; onClose: () => void; onSuccess: (po: PurchaseOrder) => void;
  suppliers: Supplier[]; products: Product[];
}) {
  const open = !!initialPo;
  const { can } = useAuth();
  const canEdit = can.edit("procurement");
  const canApprove = can.approve("procurement");

  const [po, setPo] = useState<PurchaseOrder | null>(initialPo);
  const [f, setF] = useState<POFields>(EMPTY_PO);
  const [errs, setErrs] = useState<POErrors>({});
  const [items, setItems] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [expandItems, setExpandItems] = useState(true);

  useEffect(() => {
    if (initialPo) {
      setPo(initialPo);
      setF({
        po_number: initialPo.po_number,
        supplier_id: initialPo.supplier_id,
        order_date: initialPo.order_date?.split("T")[0],
        expected_date: initialPo.expected_date?.split("T")[0],
        currency: initialPo.currency,
        notes: initialPo.notes || "",
      });
      const existingItems = ((initialPo as any).purchase_order_items || []).map((i: any) => ({
        _key: i.id,
        product_id: i.product_id,
        quantity: String(i.quantity),
        unit_cost: String(i.unit_cost),
      }));
      setItems(existingItems);
      setErrs({}); setOk(false); setErr(""); setShowReceipt(false);
    }
  }, [initialPo]);

  const isEditable = po?.status === "draft";
  const canReceive = po && ["approved", "ordered"].includes(po.status);

  const set = (k: keyof POFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };

  const handleSave = async () => {
    const e = validatePO(f, items);
    if (Object.keys(e).length || !po) { setErrs(e); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/procurement/purchase-orders/${po.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          items: items.map((i) => ({ product_id: i.product_id, quantity: parseFloat(i.quantity), unit_cost: parseFloat(i.unit_cost) })),
        }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); setPo(data.data); onSuccess(data.data); setTimeout(() => setOk(false), 2000); }
      else setErr(data.message || "Update failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  const handleAction = async (status: string) => {
    if (!po) return;
    setActionBusy(status); setErr("");
    try {
      const res = await fetch(`/api/procurement/purchase-orders/${po.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { setPo(data.data); onSuccess(data.data); }
      else setErr(data.message || "Action failed.");
    } catch { setErr("Network error."); }
    finally { setActionBusy(null); }
  };

  const handleReceive = async (receipts: { item_id: string; qty: number }[], warehouseId: string) => {
    if (!po) return;
    setReceiptBusy(true); setErr("");
    try {
      const res = await fetch(`/api/procurement/purchase-orders/${po.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "receive", receipts, warehouse_id: warehouseId || undefined }),
      });
      const data = await res.json();
      if (data.success) { setPo(data.data); onSuccess(data.data); setShowReceipt(false); }
      else setErr(data.message || "Receipt failed.");
    } catch { setErr("Network error."); }
    finally { setReceiptBusy(false); }
  };

  const permMap: Record<string, boolean> = { edit: canEdit, approve: canApprove, full: canApprove };
  const availableActions = STATUS_ACTIONS.filter((a) => po && (a.from as readonly POStatus[]).includes(po.status));
  const selectedSupplier = suppliers.find((s) => s.id === f.supplier_id);
  const poItems = (po as any)?.purchase_order_items || [];
  const receivedTotal = poItems.reduce((s: number, i: any) => s + i.received_quantity, 0);
  const orderedTotal = poItems.reduce((s: number, i: any) => s + i.quantity, 0);
  const receiptPct = orderedTotal > 0 ? Math.round((receivedTotal / orderedTotal) * 100) : 0;

  return (
    <Drawer open={open} onClose={onClose} title="Purchase Order"
      subtitle={po ? `${po.po_number} · ${(po as any).suppliers?.name || ""}` : ""} wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Status + receipt progress */}
        {po && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className={clsx("badge font-medium capitalize text-xs px-2.5 py-1", STATUS_COLORS[po.status])}>
              {po.status.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-gray-400">{formatDate(po.order_date)}</span>
            {po.approved_at && <span className="text-xs text-emerald-600">Approved {formatDate(po.approved_at)}</span>}
            {poItems.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <div className="w-24 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${receiptPct}%` }} />
                </div>
                <span className="text-xs text-gray-500">{receiptPct}% received</span>
              </div>
            )}
          </div>
        )}

        {!canEdit && isEditable && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Lock className="w-4 h-4 text-amber-500 mt-0.5" />
            <p className="text-sm text-amber-700">Your role cannot edit purchase orders.</p>
          </div>
        )}

        {/* Header fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">PO Number</label>
            <input type="text" value={f.po_number} disabled
              className="input font-mono opacity-60 cursor-not-allowed bg-surface-200" />
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
          <label className="label">Supplier</label>
          <select value={f.supplier_id} onChange={(e) => set("supplier_id", e.target.value)}
            disabled={!canEdit || !isEditable}
            className={clsx("input", errs.supplier_id && "border-red-400", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")}>
            <option value="">— Select supplier —</option>
            {suppliers.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          {selectedSupplier && (
            <p className="mt-1.5 text-xs text-gray-500">Net-{selectedSupplier.payment_terms} days · {selectedSupplier.email}</p>
          )}
          <FieldErr msg={errs.supplier_id} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Order Date</label>
            <input type="date" value={f.order_date} onChange={(e) => set("order_date", e.target.value)}
              disabled={!canEdit || !isEditable} className={clsx("input", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
          </div>
          <div>
            <label className="label">Expected Delivery</label>
            <input type="date" value={f.expected_date} min={f.order_date} onChange={(e) => set("expected_date", e.target.value)}
              disabled={!canEdit || !isEditable} className={clsx("input", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)}
            rows={2} disabled={!canEdit || !isEditable}
            className={clsx("input resize-none", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
        </div>

        {/* Line items */}
        <div className="pt-2 border-t border-surface-200">
          <button className="flex items-center gap-2 w-full label mb-3 hover:text-brand-600 transition-colors"
            onClick={() => setExpandItems((p) => !p)}>
            Line Items
            <span className="badge bg-surface-200 text-gray-600 text-xs">{poItems.length}</span>
            <span className="font-bold tabular-nums ml-auto">{formatCurrency(po?.total_amount || 0, po?.currency)}</span>
            {expandItems ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
          </button>
          {expandItems && (
            <LineItemEditor items={items} onChange={setItems} products={products} readOnly={!canEdit || !isEditable} />
          )}
          {errs.items && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.items}</p>}
        </div>

        {/* Status actions */}
        {availableActions.length > 0 && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow Actions</p>
            {availableActions.map((action) => {
              const hasAccess = permMap[action.perm] ?? false;
              return (
                <button key={action.to}
                  onClick={() => hasAccess && handleAction(action.to)}
                  disabled={!hasAccess || !!actionBusy}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    !hasAccess ? "border-surface-300 text-gray-300 cursor-not-allowed bg-surface-50"
                      : "border-surface-400 hover:border-surface-500 hover:bg-surface-50 text-gray-700"
                  )}>
                  <span className={clsx("flex items-center gap-2", !hasAccess ? "text-gray-300" : action.color)}>
                    <action.icon className="w-4 h-4" />
                    {action.label}
                  </span>
                  {actionBusy === action.to
                    ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    : !hasAccess
                      ? <span className="text-xs text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" />Restricted</span>
                      : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Goods receipt */}
        {canReceive && (
          <div className="pt-2 border-t border-surface-300">
            <button onClick={() => setShowReceipt((p) => !p)}
              className="flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800 transition-colors">
              <PackageCheck className="w-4 h-4" />
              {showReceipt ? "Hide" : "Record"} Goods Receipt
              {showReceipt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showReceipt && po && (
              <div className="mt-3">
                <GoodsReceiptPanel po={po} onReceive={handleReceive} loading={receiptBusy} />
              </div>
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
export default function PurchaseOrdersPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [supFilter, setSupFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (statusFilter) p.set("status", statusFilter);
    if (supFilter) p.set("supplier_id", supFilter);
    fetch(`/api/procurement/purchase-orders?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setPos(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [statusFilter, supFilter]);

  useEffect(() => {
    fetch("/api/procurement/suppliers?pageSize=200").then((r) => r.json()).then((res) => { if (res.success) setSuppliers(res.data); });
    fetch("/api/inventory/products?pageSize=300").then((r) => r.json()).then((res) => { if (res.success) setProducts(res.data); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdded = (po: PurchaseOrder) => { setPos((p) => [po, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (po: PurchaseOrder) => {
    setPos((p) => p.map((x) => x.id === po.id ? po : x));
    setViewPO(po);
  };

  const visible = search ? pos.filter((po) =>
    po.po_number.toLowerCase().includes(search.toLowerCase()) ||
    (po as any).suppliers?.name?.toLowerCase().includes(search.toLowerCase())
  ) : pos;

  // Summary
  const summary = {
    total: pos.reduce((s, p) => s + p.total_amount, 0),
    open: pos.filter((p) => !["received", "cancelled"].includes(p.status)).length,
    pending: pos.filter((p) => p.status === "pending_approval").length,
  };

  return (
    <>
      <Header title="Purchase Orders" subtitle="Procurement Module"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
            {can.create("procurement") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New PO</button>}
          </div>
        }
      />
      <PageWrapper>
        {/* Auth strip */}
        {!authLoading && user && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            {[["Create", can.create("procurement")], ["Edit", can.edit("procurement")], ["Approve", can.approve("procurement")]].map(([l, v]) => (
              <span key={String(l)} className={v ? "text-emerald-600" : "text-gray-400"}>{v ? "✓" : "✗"} {l}</span>
            ))}
          </div>
        )}

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Total PO Value</span>
              <span className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(summary.total)}</span>
            </div>
            <div className={clsx("rounded-xl border px-4 py-3 flex items-center justify-between", summary.pending > 0 ? "bg-blue-50 border-blue-200" : "bg-white border-surface-300")}>
              <span className="text-xs text-gray-500">Awaiting Approval</span>
              <span className={clsx("text-2xl font-bold", summary.pending > 0 ? "text-blue-700" : "text-gray-900")}>{summary.pending}</span>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Open Orders</span>
              <span className="text-2xl font-bold text-gray-900">{summary.open}</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PO # or supplier…" className="input pl-8 text-xs py-1.5" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Statuses</option>
            {["draft", "pending_approval", "approved", "ordered", "received", "cancelled"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
          <select value={supFilter} onChange={(e) => setSupFilter(e.target.value)} className="input !w-auto text-xs py-1.5 max-w-[200px]">
            <option value="">All Suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </div>

        <SectionTitle title="Purchase Orders" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["PO Number", "Supplier", "Order Date", "Expected", "Items", "Total", "Status", ""].map((h) => (
                    <th key={h} className={clsx("table-header px-4 py-3", ["Total"].includes(h) ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8}><TableSkeleton rows={6} cols={8} /></td></tr>
                  : visible.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState title="No purchase orders" description="Create your first PO to start procuring."
                        action={can.create("procurement") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New PO</button> : undefined} />
                    </td></tr>
                  ) : visible.map((po) => {
                    const items = (po as any).purchase_order_items || [];
                    const sup = (po as any).suppliers;
                    const isOverdue = po.status === "ordered" && new Date(po.expected_date) < new Date();
                    return (
                      <tr key={po.id} onClick={() => setViewPO(po)}
                        className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{po.po_number}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{sup?.name || "—"}</p>
                          <p className="text-xs text-gray-400 font-mono">{sup?.code}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(po.order_date)}</td>
                        <td className={clsx("px-4 py-3 text-xs", isOverdue ? "text-red-600 font-medium" : "text-gray-600")}>
                          {formatDate(po.expected_date)}
                          {isOverdue && <span className="ml-1 text-xs">⚠ Overdue</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge bg-surface-200 text-gray-600 text-xs">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">{formatCurrency(po.total_amount, po.currency)}</td>
                        <td className="px-4 py-3">
                          <span className={clsx("badge text-xs capitalize", STATUS_COLORS[po.status])}>
                            {po.status.replace(/_/g, " ")}
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

      <AddPODrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} suppliers={suppliers} products={products} />
      <ViewPODrawer po={viewPO} onClose={() => setViewPO(null)} onSuccess={handleUpdated} suppliers={suppliers} products={products} />
    </>
  );
}