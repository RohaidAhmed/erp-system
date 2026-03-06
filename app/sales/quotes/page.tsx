"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, Trash2, X, ChevronRight,
  CheckCircle2, Loader2, AlertCircle, Lock, Send, ThumbsUp,
  ThumbsDown, Clock, FileText, ArrowRight,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { Quote, Customer, Product, Currency } from "@/types";
import { clsx } from "clsx";

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { color: string; label: string; icon: any }> = {
  draft: { color: "bg-gray-100 text-gray-600", label: "Draft", icon: FileText },
  sent: { color: "bg-blue-50 text-blue-700", label: "Sent", icon: Send },
  accepted: { color: "bg-emerald-50 text-emerald-700", label: "Accepted", icon: ThumbsUp },
  rejected: { color: "bg-red-50 text-red-600", label: "Rejected", icon: ThumbsDown },
  expired: { color: "bg-orange-50 text-orange-600", label: "Expired", icon: Clock },
};

const QUOTE_ACTIONS = [
  { to: "sent", label: "Send to Customer", icon: Send, from: ["draft"], perm: "edit" },
  { to: "accepted", label: "Mark as Accepted", icon: ThumbsUp, from: ["sent"], perm: "edit" },
  { to: "rejected", label: "Mark as Rejected", icon: ThumbsDown, from: ["sent"], perm: "edit" },
  { to: "expired", label: "Mark as Expired", icon: Clock, from: ["sent"], perm: "edit" },
];

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR", "AED"];
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
        wide ? "w-[660px]" : "w-[520px]", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[560px]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
          <span>Sales & CRM</span><ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Quotes</span>
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

// ── Quote line item editor ─────────────────────────────────────────────────────
interface QLineItem { _key: string; product_id: string; quantity: string; unit_price: string; discount_pct: string; }

function QuoteLineEditor({ items, onChange, products, readOnly }: {
  items: QLineItem[]; onChange: (i: QLineItem[]) => void; products: Product[]; readOnly?: boolean;
}) {
  const add = () => onChange([...items, { _key: crypto.randomUUID(), product_id: "", quantity: "1", unit_price: "0", discount_pct: "0" }]);
  const update = (key: string, field: keyof QLineItem, value: string) => {
    onChange(items.map((i) => {
      if (i._key !== key) return i;
      const u = { ...i, [field]: value };
      if (field === "product_id" && value) {
        const p = products.find((p) => p.id === value);
        if (p) u.unit_price = String(p.unit_price);
      }
      return u;
    }));
  };
  const remove = (key: string) => onChange(items.filter((i) => i._key !== key));
  const total = items.reduce((s, i) => s + parseFloat(i.quantity || "0") * parseFloat(i.unit_price || "0") * (1 - parseFloat(i.discount_pct || "0") / 100), 0);

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
        <div className="text-center py-6 border-2 border-dashed border-surface-300 rounded-xl text-sm text-gray-400">No line items yet</div>
      )}
      {items.map((item) => {
        const lineTotal = parseFloat(item.quantity || "0") * parseFloat(item.unit_price || "0") * (1 - parseFloat(item.discount_pct || "0") / 100);
        return (
          <div key={item._key} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4">
              <select value={item.product_id} onChange={(e) => update(item._key, "product_id", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5", readOnly && "opacity-60 cursor-not-allowed")}>
                <option value="">— Select —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </div>
            {(["quantity", "unit_price", "discount_pct"] as (keyof QLineItem)[]).map((field) => (
              <div key={field} className="col-span-2">
                <input type="number" min="0" step={field === "discount_pct" ? "0.5" : "0.001"} value={item[field]}
                  onChange={(e) => update(item._key, field, e.target.value)}
                  disabled={readOnly} className={clsx("input text-xs py-1.5 text-right tabular-nums", readOnly && "opacity-60 cursor-not-allowed")} />
              </div>
            ))}
            <div className="col-span-1 text-right text-xs font-medium text-gray-700 tabular-nums">{formatCurrency(lineTotal)}</div>
            <div className="col-span-1 flex justify-center">
              {!readOnly && <button onClick={() => remove(item._key)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-2 border-t border-surface-200">
        {!readOnly ? (
          <button onClick={add} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"><Plus className="w-3.5 h-3.5" />Add Line</button>
        ) : <div />}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Quote Total:</span>
          <span className="font-bold text-gray-900 tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Quote form fields ──────────────────────────────────────────────────────────
interface QFields { quote_number: string; customer_id: string; valid_until: string; currency: Currency; }
interface QErrors { quote_number?: string; customer_id?: string; valid_until?: string; }
const EMPTY_Q: QFields = { quote_number: "", customer_id: "", valid_until: futureDate(30), currency: "USD" };

function validateQuote(f: QFields): QErrors {
  const e: QErrors = {};
  if (!f.quote_number.trim()) e.quote_number = "Quote number is required.";
  if (!f.customer_id) e.customer_id = "Select a customer.";
  if (!f.valid_until) e.valid_until = "Valid until date is required.";
  else if (f.valid_until < today()) e.valid_until = "Valid until must be in the future.";
  return e;
}

// ── Add Quote Drawer ───────────────────────────────────────────────────────────
function AddQuoteDrawer({ open, onClose, onSuccess, customers, products }: {
  open: boolean; onClose: () => void; onSuccess: (q: Quote) => void;
  customers: Customer[]; products: Product[];
}) {
  const { can } = useAuth();
  const canCreate = can.create("sales");
  const [f, setF] = useState<QFields>(EMPTY_Q);
  const [errs, setErrs] = useState<QErrors>({});
  const [items, setItems] = useState<QLineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof QFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };

  useEffect(() => {
    const cust = customers.find((c) => c.id === f.customer_id);
    if (cust) setF((p) => ({ ...p, currency: cust.currency }));
  }, [f.customer_id]);

  useEffect(() => {
    if (open) { setF({ ...EMPTY_Q, valid_until: futureDate(30) }); setItems([]); setErrs({}); setOk(false); setErr(""); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const e = validateQuote(f);
    if (Object.keys(e).length) { setErrs(e); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/sales/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, items: items.map((i) => ({ product_id: i.product_id, quantity: parseFloat(i.quantity), unit_price: parseFloat(i.unit_price), discount_pct: parseFloat(i.discount_pct || "0") })) }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else setErr(data.message || "Failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Quote" subtitle="Create a price quotation for a customer" wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate ? (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200"><Lock className="w-4 h-4 text-amber-500 mt-0.5" /><p className="text-sm text-amber-700">Your role cannot create quotes.</p></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Quote Number <span className="text-red-500">*</span></label>
                <input ref={firstRef} type="text" value={f.quote_number} onChange={(e) => set("quote_number", e.target.value)}
                  placeholder="e.g. QUO-2026-001" className={clsx("input font-mono", errs.quote_number && "border-red-400")} />
                <FieldErr msg={errs.quote_number} />
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
                {customers.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.customer_code} — {c.name}</option>)}
              </select>
              <FieldErr msg={errs.customer_id} />
            </div>

            <div>
              <label className="label">Valid Until <span className="text-red-500">*</span></label>
              <input type="date" value={f.valid_until} min={today()} onChange={(e) => set("valid_until", e.target.value)}
                className={clsx("input", errs.valid_until && "border-red-400")} />
              <FieldErr msg={errs.valid_until} />
            </div>

            <div className="pt-2 border-t border-surface-200">
              <p className="label mb-3">Line Items <span className="text-xs text-gray-400 font-normal">(optional — can add later)</span></p>
              <QuoteLineEditor items={items} onChange={setItems} products={products} />
            </div>
          </>
        )}
        {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{err}</div>}
        {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Quote created!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSubmit} busy={busy} ok={ok} label="Create Quote" disabled={!canCreate} />
    </Drawer>
  );
}

// ── View/Edit Quote Drawer ─────────────────────────────────────────────────────
function ViewQuoteDrawer({ quote: initialQ, onClose, onSuccess, customers, products, onConvertedToSO }: {
  quote: Quote | null; onClose: () => void; onSuccess: (q: Quote) => void;
  customers: Customer[]; products: Product[];
  onConvertedToSO: (soId: string) => void;
}) {
  const open = !!initialQ;
  const { can } = useAuth();
  const canEdit = can.edit("sales");
  const [q, setQ] = useState<Quote | null>(initialQ);
  const [f, setF] = useState<QFields>(EMPTY_Q);
  const [errs, setErrs] = useState<QErrors>({});
  const [items, setItems] = useState<QLineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertSoNumber, setConvertSoNumber] = useState("");
  const [showConvert, setShowConvert] = useState(false);

  useEffect(() => {
    if (initialQ) {
      setQ(initialQ);
      setF({ quote_number: initialQ.quote_number, customer_id: initialQ.customer_id, valid_until: initialQ.valid_until?.split("T")[0] || futureDate(30), currency: initialQ.currency });
      setItems([]); setErrs({}); setOk(false); setErr(""); setShowConvert(false);
    }
  }, [initialQ]);

  const set = (k: keyof QFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };
  const isEditable = q?.status === "draft";

  const handleSave = async () => {
    const e = validateQuote(f);
    if (Object.keys(e).length || !q) { setErrs(e); return; }
    setBusy(true); setErr("");
    try {
      const total_amount = items.reduce((s, i) => s + parseFloat(i.quantity || "0") * parseFloat(i.unit_price || "0") * (1 - parseFloat(i.discount_pct || "0") / 100), 0);
      const res = await fetch(`/api/sales/quotes/${q.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, total_amount, items }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); setQ(data.data); onSuccess(data.data); setTimeout(() => setOk(false), 2000); }
      else setErr(data.message || "Update failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  const handleAction = async (status: string) => {
    if (!q) return;
    setActionBusy(status); setErr("");
    try {
      const res = await fetch(`/api/sales/quotes/${q.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { setQ(data.data); onSuccess(data.data); }
      else setErr(data.message || "Action failed.");
    } catch { setErr("Network error."); }
    finally { setActionBusy(null); }
  };

  const handleConvert = async () => {
    if (!q) return;
    setConvertBusy(true); setErr("");
    try {
      const res = await fetch(`/api/sales/quotes/${q.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert_to_so", so_number: convertSoNumber || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        onConvertedToSO(data.data.sales_order.id);
        onClose();
      } else setErr(data.message || "Conversion failed.");
    } catch { setErr("Network error."); }
    finally { setConvertBusy(false); }
  };

  const availableActions = QUOTE_ACTIONS.filter((a) => q && a.from.includes(q.status as any));
  const isExpired = q?.valid_until && new Date(q.valid_until) < new Date() && q.status === "sent";

  return (
    <Drawer open={open} onClose={onClose} title="Quote"
      subtitle={q ? `${q.quote_number} · v${q.version}` : ""} wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Status + expiry */}
        {q && (
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const m = STATUS_META[q.status]; return (
                <span className={clsx("badge font-medium text-xs px-2.5 py-1 flex items-center gap-1", m.color)}>
                  <m.icon className="w-3 h-3" />{m.label}
                </span>
              );
            })()}
            <span className="text-xs text-gray-400">Valid until: {formatDate(q.valid_until)}</span>
            {isExpired && <span className="text-xs text-orange-600 font-medium">⚠ Validity expired</span>}
            <span className="ml-auto text-sm font-bold tabular-nums text-gray-900">{formatCurrency(q.total_amount, q.currency)}</span>
          </div>
        )}

        {/* Header fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Quote Number</label>
            <input type="text" value={f.quote_number} disabled className="input font-mono opacity-60 cursor-not-allowed bg-surface-200" />
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

        <div>
          <label className="label">Valid Until</label>
          <input type="date" value={f.valid_until} min={today()} onChange={(e) => set("valid_until", e.target.value)}
            disabled={!canEdit || !isEditable} className={clsx("input", (!canEdit || !isEditable) && "opacity-60 cursor-not-allowed")} />
        </div>

        {/* Line items */}
        <div className="pt-2 border-t border-surface-200">
          <p className="label mb-3">Line Items</p>
          <QuoteLineEditor items={items} onChange={setItems} products={products} readOnly={!canEdit || !isEditable} />
        </div>

        {/* Workflow actions */}
        {availableActions.length > 0 && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow</p>
            {availableActions.map((action) => (
              <button key={action.to}
                onClick={() => canEdit && handleAction(action.to)}
                disabled={!canEdit || !!actionBusy}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                  !canEdit ? "border-surface-300 text-gray-300 cursor-not-allowed bg-surface-50"
                    : "border-surface-400 hover:border-surface-500 hover:bg-surface-50 text-gray-700"
                )}>
                <span className={clsx("flex items-center gap-2", !canEdit ? "text-gray-300" : "text-brand-700")}>
                  <action.icon className="w-4 h-4" />{action.label}
                </span>
                {actionBusy === action.to ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
            ))}
          </div>
        )}

        {/* Convert to SO — only for accepted quotes */}
        {q?.status === "accepted" && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Convert</p>
            {!showConvert ? (
              <button onClick={() => setShowConvert(true)}
                className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors">
                <ArrowRight className="w-4 h-4" /> Convert to Sales Order
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-3">
                <p className="text-xs text-emerald-800 font-medium">Convert <strong>{q.quote_number}</strong> to a Sales Order</p>
                <div>
                  <label className="label text-xs">SO Number <span className="text-xs text-gray-400">(optional — auto-generated if blank)</span></label>
                  <input type="text" value={convertSoNumber} onChange={(e) => setConvertSoNumber(e.target.value)}
                    placeholder={`SO-${q.quote_number.replace(/^Q(UO?T?E?-?)?/i, "")}`}
                    className="input font-mono text-xs" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleConvert} disabled={convertBusy}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                    {convertBusy ? <><Loader2 className="w-3 h-3 animate-spin" />Converting…</> : <><ArrowRight className="w-3 h-3" />Convert</>}
                  </button>
                  <button onClick={() => setShowConvert(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                </div>
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
export default function QuotesPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [viewQuote, setViewQuote] = useState<Quote | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [custFilter, setCustFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (statusFilter) p.set("status", statusFilter);
    if (custFilter) p.set("customer_id", custFilter);
    fetch(`/api/sales/quotes?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setQuotes(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [statusFilter, custFilter]);

  useEffect(() => {
    fetch("/api/sales/customers?pageSize=200").then((r) => r.json()).then((res) => { if (res.success) setCustomers(res.data); });
    fetch("/api/inventory/products?pageSize=300").then((r) => r.json()).then((res) => { if (res.success) setProducts(res.data); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdded = (q: Quote) => { setQuotes((p) => [q, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (q: Quote) => { setQuotes((p) => p.map((x) => x.id === q.id ? q : x)); setViewQuote(q); };
  const handleConverted = () => { load(); }; // reload to reflect

  const visible = search ? quotes.filter((q) =>
    q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
    (q as any).customers?.name?.toLowerCase().includes(search.toLowerCase())
  ) : quotes;

  const summary = {
    open: quotes.filter((q) => ["draft", "sent"].includes(q.status)).length,
    accepted: quotes.filter((q) => q.status === "accepted").length,
    total: quotes.reduce((s, q) => s + q.total_amount, 0),
  };

  return (
    <>
      <Header title="Quotes" subtitle="Sales & CRM"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
            {can.create("sales") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New Quote</button>}
          </div>
        }
      />
      <PageWrapper>
        {!authLoading && user && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            {[["Create", can.create("sales")], ["Edit/Progress", can.edit("sales")]].map(([l, v]) => (
              <span key={String(l)} className={v ? "text-emerald-600" : "text-gray-400"}>{v ? "✓" : "✗"} {l}</span>
            ))}
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Total Quote Value</span>
              <span className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(summary.total)}</span>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Open Quotes</span>
              <span className="text-2xl font-bold text-gray-900">{summary.open}</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Accepted</span>
              <span className="text-2xl font-bold text-emerald-700">{summary.accepted}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quote # or customer…" className="input pl-8 text-xs py-1.5" />
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

        <SectionTitle title="Quotes" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["Quote #", "Customer", "Valid Until", "Total", "Status", "Ver.", ""].map((h) => (
                    <th key={h} className={clsx("table-header px-4 py-3", h === "Total" ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7}><TableSkeleton rows={5} cols={7} /></td></tr>
                  : visible.length === 0 ? (
                    <tr><td colSpan={7}>
                      <EmptyState title="No quotes found" description="Create a quote to get started."
                        action={can.create("sales") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New Quote</button> : undefined} />
                    </td></tr>
                  ) : visible.map((q) => {
                    const meta = STATUS_META[q.status];
                    const cust = (q as any).customers;
                    const isExpired = q.status === "sent" && new Date(q.valid_until) < new Date();
                    return (
                      <tr key={q.id} onClick={() => setViewQuote(q)} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{q.quote_number}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{cust?.name || "—"}</p>
                          <p className="text-xs text-gray-400 font-mono">{cust?.customer_code}</p>
                        </td>
                        <td className={clsx("px-4 py-3 text-xs", isExpired ? "text-orange-600 font-medium" : "text-gray-600")}>
                          {formatDate(q.valid_until)}{isExpired && " ⚠"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">{formatCurrency(q.total_amount, q.currency)}</td>
                        <td className="px-4 py-3">
                          <span className={clsx("badge text-xs flex items-center gap-1 w-fit", meta.color)}>
                            <meta.icon className="w-3 h-3" />{meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">v{q.version}</td>
                        <td className="px-4 py-3"><Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" /></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>

      <AddQuoteDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} customers={customers} products={products} />
      <ViewQuoteDrawer quote={viewQuote} onClose={() => setViewQuote(null)} onSuccess={handleUpdated}
        customers={customers} products={products} onConvertedToSO={handleConverted} />
    </>
  );
}