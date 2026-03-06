"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, Trash2, X, ChevronRight,
  CheckCircle2, Loader2, AlertCircle, Lock, Power, PowerOff,
  Package, AlertTriangle, ChevronDown, ChevronUp, Layers,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { BillOfMaterials, Product } from "@/types";
import { clsx } from "clsx";

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
        wide ? "w-[680px]" : "w-[520px]", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[580px]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
          <span>Production</span><ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Bill of Materials</span>
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

// ── BOM component line editor ──────────────────────────────────────────────────
interface BOMLine { _key: string; component_id: string; quantity: string; unit_of_measure: string; }

function BOMLineEditor({ lines, onChange, products, woQty, readOnly }: {
  lines: BOMLine[]; onChange: (l: BOMLine[]) => void;
  products: Product[]; woQty?: number; readOnly?: boolean;
}) {
  const add = () => onChange([...lines, { _key: crypto.randomUUID(), component_id: "", quantity: "1", unit_of_measure: "pcs" }]);

  const update = (key: string, field: keyof BOMLine, value: string) => {
    onChange(lines.map((l) => {
      if (l._key !== key) return l;
      const u = { ...l, [field]: value };
      if (field === "component_id" && value) {
        const p = products.find((p) => p.id === value);
        if (p) u.unit_of_measure = p.unit_of_measure;
      }
      return u;
    }));
  };

  const remove = (key: string) => onChange(lines.filter((l) => l._key !== key));

  const totalCost = lines.reduce((s, l) => {
    const prod = products.find((p) => p.id === l.component_id);
    return s + (prod?.unit_cost || 0) * parseFloat(l.quantity || "0") * (woQty || 1);
  }, 0);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-1">
        <div className="col-span-5 text-xs font-medium text-gray-500">Component</div>
        <div className="col-span-2 text-xs font-medium text-gray-500 text-right">Qty / unit</div>
        <div className="col-span-2 text-xs font-medium text-gray-500">UoM</div>
        <div className="col-span-2 text-xs font-medium text-gray-500 text-right">On Hand</div>
        <div className="col-span-1" />
      </div>

      {lines.length === 0 && !readOnly && (
        <div className="text-center py-6 border-2 border-dashed border-surface-300 rounded-xl text-sm text-gray-400">
          No components yet — click "Add Component"
        </div>
      )}

      {lines.map((line) => {
        const prod = products.find((p) => p.id === line.component_id);
        const needed = parseFloat(line.quantity || "0") * (woQty || 1);
        const short = prod && woQty && prod.quantity_on_hand < needed;
        return (
          <div key={line._key} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-5">
              <select value={line.component_id} onChange={(e) => update(line._key, "component_id", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5", readOnly && "opacity-60 cursor-not-allowed")}>
                <option value="">— Select component —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
              {prod && <p className="mt-0.5 text-xs text-gray-400 pl-1">{formatCurrency(prod.unit_cost)} / {prod.unit_of_measure}</p>}
            </div>
            <div className="col-span-2">
              <input type="number" min="0.001" step="0.001" value={line.quantity}
                onChange={(e) => update(line._key, "quantity", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5 text-right tabular-nums", readOnly && "opacity-60 cursor-not-allowed")} />
            </div>
            <div className="col-span-2">
              <input type="text" value={line.unit_of_measure}
                onChange={(e) => update(line._key, "unit_of_measure", e.target.value)}
                disabled={readOnly} className={clsx("input text-xs py-1.5", readOnly && "opacity-60 cursor-not-allowed")} />
            </div>
            <div className="col-span-2 pt-1.5">
              {prod ? (
                <div className={clsx("text-right text-xs font-medium tabular-nums", short ? "text-red-600" : "text-gray-600")}>
                  {short && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  {prod.quantity_on_hand.toLocaleString()}
                  {woQty && <span className="text-gray-400"> / {needed.toLocaleString()} needed</span>}
                </div>
              ) : <div />}
            </div>
            <div className="col-span-1 flex justify-center pt-1">
              {!readOnly && <button onClick={() => remove(line._key)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2 border-t border-surface-200">
        {!readOnly ? (
          <button onClick={add} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium">
            <Plus className="w-3.5 h-3.5" /> Add Component
          </button>
        ) : <div />}
        <div className="text-right text-xs text-gray-500">
          Est. material cost: <span className="font-bold text-gray-900 tabular-nums">{formatCurrency(totalCost)}</span>
          {woQty && woQty > 1 && <span className="text-gray-400"> (for qty {woQty})</span>}
        </div>
      </div>
    </div>
  );
}

// ── Add BOM Drawer ─────────────────────────────────────────────────────────────
function AddBOMDrawer({ open, onClose, onSuccess, products }: {
  open: boolean; onClose: () => void; onSuccess: (b: BillOfMaterials) => void; products: Product[];
}) {
  const { can } = useAuth();
  const canCreate = can.create("production");
  const [productId, setProductId] = useState("");
  const [version, setVersion] = useState("1.0");
  const [lines, setLines] = useState<BOMLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [errs, setErrs] = useState<{ productId?: string; version?: string; lines?: string }>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (open) { setProductId(""); setVersion("1.0"); setLines([]); setErr(""); setOk(false); setErrs({}); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const e: typeof errs = {};
    if (!productId) e.productId = "Select a product to manufacture.";
    if (!version.trim()) e.version = "Version is required.";
    if (!lines.length || !lines.every((l) => l.component_id && parseFloat(l.quantity) > 0))
      e.lines = "At least one complete component line is required.";
    if (Object.keys(e).length) { setErrs(e); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/production/bom", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, version: version.trim(), items: lines.map((l) => ({ component_id: l.component_id, quantity: parseFloat(l.quantity), unit_of_measure: l.unit_of_measure })) }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else setErr(data.message || "Failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <Drawer open={open} onClose={onClose} title="New Bill of Materials" subtitle="Define components for a manufactured product" wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate
          ? <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200"><Lock className="w-4 h-4 text-amber-500 mt-0.5" /><p className="text-sm text-amber-700">Your role cannot create BOMs.</p></div>
          : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="label">Finished Product <span className="text-red-500">*</span></label>
                  <select ref={firstRef} value={productId} onChange={(e) => setProductId(e.target.value)}
                    className={clsx("input", errs.productId && "border-red-400")}>
                    <option value="">— Select product to manufacture —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                  </select>
                  {selectedProduct && <p className="mt-1 text-xs text-gray-400">Current stock: {selectedProduct.quantity_on_hand} {selectedProduct.unit_of_measure}</p>}
                  <FieldErr msg={errs.productId} />
                </div>
                <div>
                  <label className="label">Version <span className="text-red-500">*</span></label>
                  <input type="text" value={version} onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0" className={clsx("input font-mono", errs.version && "border-red-400")} />
                  <FieldErr msg={errs.version} />
                </div>
              </div>

              <div className="pt-2 border-t border-surface-200">
                <p className="label mb-3">Components <span className="text-red-500">*</span></p>
                <BOMLineEditor lines={lines} onChange={setLines} products={products} />
                {errs.lines && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.lines}</p>}
              </div>
            </>
          )}
        {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{err}</div>}
        {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />BOM created!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSubmit} busy={busy} ok={ok} label="Create BOM" disabled={!canCreate} />
    </Drawer>
  );
}

// ── Edit BOM Drawer ────────────────────────────────────────────────────────────
function EditBOMDrawer({ bom: initialBom, onClose, onSuccess, products }: {
  bom: BillOfMaterials | null; onClose: () => void; onSuccess: (b: BillOfMaterials) => void; products: Product[];
}) {
  const open = !!initialBom;
  const { can } = useAuth();
  const canEdit = can.edit("production");
  const canFull = can.full("production");
  const [bom, setBom] = useState<BillOfMaterials | null>(initialBom);
  const [lines, setLines] = useState<BOMLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [toggling, setToggling] = useState(false);
  const [confirmDeactivate, setCD] = useState(false);
  const [expandItems, setExpandItems] = useState(true);

  useEffect(() => {
    if (initialBom) {
      setBom(initialBom);
      const existingLines = ((initialBom as any).bom_items || []).map((i: any) => ({
        _key: i.id, component_id: i.component_id, quantity: String(i.quantity), unit_of_measure: i.unit_of_measure,
      }));
      setLines(existingLines);
      setOk(false); setErr(""); setCD(false);
    }
  }, [initialBom]);

  const handleSave = async () => {
    if (!bom) return;
    if (!lines.length || !lines.every((l) => l.component_id && parseFloat(l.quantity) > 0)) {
      setErr("At least one complete component is required."); return;
    }
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/production/bom/${bom.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ component_id: l.component_id, quantity: parseFloat(l.quantity), unit_of_measure: l.unit_of_measure })) }),
      });
      const data = await res.json();
      if (data.success) { setOk(true); setBom(data.data); onSuccess(data.data); setTimeout(() => setOk(false), 2000); }
      else setErr(data.message || "Update failed.");
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  };

  const handleToggle = async () => {
    if (!bom) return;
    setToggling(true); setErr("");
    try {
      const res = await fetch(`/api/production/bom/${bom.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !bom.is_active }),
      });
      const data = await res.json();
      if (data.success) { setBom(data.data); onSuccess(data.data); setTimeout(onClose, 300); }
      else setErr(data.message || "Failed.");
    } catch { setErr("Network error."); }
    finally { setToggling(false); setCD(false); }
  };

  const prod = (bom as any)?.products;
  const items = (bom as any)?.bom_items || [];

  return (
    <Drawer open={open} onClose={onClose} title="Bill of Materials"
      subtitle={bom ? `${prod?.name || "—"} · v${bom.version}` : ""} wide>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Status + product info */}
        {bom && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
              bom.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-500")}>
              <span className={clsx("w-1.5 h-1.5 rounded-full", bom.is_active ? "bg-emerald-500" : "bg-gray-400")} />
              {bom.is_active ? "Active" : "Inactive"}
            </span>
            <span className="badge bg-surface-200 text-gray-600 text-xs font-mono">v{bom.version}</span>
            {prod && <span className="text-xs text-gray-500 font-mono">{prod.sku}</span>}
            <span className="text-xs text-gray-400 ml-auto">{formatDate(bom.created_at)}</span>
          </div>
        )}

        {/* Product + version (read-only) */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="label">Finished Product</label>
            <input type="text" value={prod?.name || ""} disabled className="input opacity-60 cursor-not-allowed bg-surface-200" />
          </div>
          <div>
            <label className="label">Version</label>
            <input type="text" value={bom?.version || ""} disabled className="input font-mono opacity-60 cursor-not-allowed bg-surface-200" />
            <p className="mt-1 text-xs text-gray-400">Version cannot be changed.</p>
          </div>
        </div>

        {/* Component lines */}
        <div className="pt-2 border-t border-surface-200">
          <button className="flex items-center gap-2 w-full label mb-3 hover:text-brand-600 transition-colors"
            onClick={() => setExpandItems((p) => !p)}>
            Components <span className="badge bg-surface-200 text-gray-600 text-xs">{items.length}</span>
            {expandItems ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />}
          </button>
          {expandItems && (
            <BOMLineEditor lines={lines} onChange={setLines} products={products} readOnly={!canEdit || !bom?.is_active} />
          )}
        </div>

        {/* Deactivate */}
        {bom && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
            {bom.is_active ? (
              !confirmDeactivate ? (
                <button onClick={() => canFull && setCD(true)} disabled={!canFull}
                  className={clsx("flex items-center gap-2 text-xs font-medium", canFull ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed")}>
                  <PowerOff className="w-3.5 h-3.5" /> Deactivate BOM
                  {!canFull && <span className="text-gray-400 ml-1">(Production Manager required)</span>}
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Deactivate this BOM? Active work orders will block this.</p>
                  <div className="flex gap-2">
                    <button onClick={handleToggle} disabled={toggling} className="btn-danger text-xs py-1.5 px-3">{toggling ? "Deactivating…" : "Confirm"}</button>
                    <button onClick={() => setCD(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                  </div>
                </div>
              )
            ) : (
              <button onClick={handleToggle} disabled={toggling || !canFull}
                className={clsx("flex items-center gap-2 text-xs font-medium", canFull ? "text-emerald-600 hover:text-emerald-700" : "text-gray-300 cursor-not-allowed")}>
                <Power className="w-3.5 h-3.5" /> Reactivate BOM
              </button>
            )}
          </div>
        )}

        {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{err}</div>}
        {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />BOM updated!</div>}
      </div>
      <Footer onCancel={onClose} onSubmit={handleSave} busy={busy} ok={ok} label="Save Changes" disabled={!canEdit || !bom?.is_active} />
    </Drawer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BOMPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editBOM, setEditBOM] = useState<BillOfMaterials | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expandedBOM, setExpandedBOM] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "100" });
    if (showInactive) p.set("inactive", "true");
    fetch(`/api/production/bom?${p}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) { setBoms(res.data); setTotal(res.pagination?.totalCount || 0); } })
      .finally(() => setLoading(false));
  }, [showInactive]);

  useEffect(() => {
    fetch("/api/inventory/products?pageSize=300").then((r) => r.json()).then((res) => { if (res.success) setProducts(res.data); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdded = (b: BillOfMaterials) => { setBoms((p) => [b, ...p]); setTotal((t) => t + 1); };
  const handleUpdated = (b: BillOfMaterials) => { setBoms((p) => p.map((x) => x.id === b.id ? b : x)); };

  const visible = search
    ? boms.filter((b) => (b as any).products?.name?.toLowerCase().includes(search.toLowerCase()) || (b as any).products?.sku?.toLowerCase().includes(search.toLowerCase()))
    : boms;

  return (
    <>
      <Header title="Bill of Materials" subtitle="Production Module"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
            {can.create("production") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New BOM</button>}
          </div>
        }
      />
      <PageWrapper>
        {!authLoading && user && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            {[["Create", can.create("production")], ["Edit", can.edit("production")], ["Deactivate", can.full("production")]].map(([l, v]) => (
              <span key={String(l)} className={v ? "text-emerald-600" : "text-gray-400"}>{v ? "✓" : "✗"} {l}</span>
            ))}
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Active BOMs</span>
              <span className="text-2xl font-bold text-gray-900">{boms.filter(b => b.is_active).length}</span>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Unique Products</span>
              <span className="text-2xl font-bold text-gray-900">{new Set(boms.filter(b => b.is_active).map(b => b.product_id)).size}</span>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Inactive</span>
              <span className="text-2xl font-bold text-gray-400">{boms.filter(b => !b.is_active).length}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product name or SKU…" className="input pl-8 text-xs py-1.5" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
        </div>

        <SectionTitle title="Bills of Materials" count={total} />

        <div className="space-y-2">
          {loading ? (
            <div className="card"><TableSkeleton rows={5} cols={5} /></div>
          ) : visible.length === 0 ? (
            <div className="card"><EmptyState title="No BOMs found" description="Create a BOM to define how products are manufactured."
              action={can.create("production") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />New BOM</button> : undefined} /></div>
          ) : visible.map((bom) => {
            const prod = (bom as any).products;
            const items = (bom as any).bom_items || [];
            const expanded = expandedBOM === bom.id;
            const hasShortage = items.some((i: any) => i.products?.quantity_on_hand < i.quantity);
            return (
              <div key={bom.id} className={clsx("card overflow-hidden transition-all", !bom.is_active && "opacity-60")}>
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-50 transition-colors"
                  onClick={() => setExpandedBOM(expanded ? null : bom.id)}>
                  <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Layers className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{prod?.name || "—"}</p>
                      <span className="badge bg-surface-200 text-gray-500 text-xs font-mono">v{bom.version}</span>
                      {!bom.is_active && <span className="badge bg-gray-100 text-gray-400 text-xs">Inactive</span>}
                      {hasShortage && bom.is_active && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <AlertTriangle className="w-3 h-3" />Material shortage
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono">{prod?.sku} · {items.length} component{items.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setEditBOM(bom); }}
                      className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-brand-500 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded components */}
                {expanded && (
                  <div className="border-t border-surface-200 px-4 py-3 bg-surface-50">
                    {items.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">No components defined.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-surface-200">
                            {["Component", "SKU", "Qty / unit", "UoM", "On Hand", "Unit Cost"].map((h) => (
                              <th key={h} className={clsx("pb-2 font-medium text-gray-500", ["Qty / unit", "On Hand", "Unit Cost"].includes(h) ? "text-right" : "text-left")}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item: any) => {
                            const c = item.products;
                            const short = c && c.quantity_on_hand < item.quantity;
                            return (
                              <tr key={item.id} className="border-b border-surface-100 last:border-0">
                                <td className="py-2 font-medium text-gray-800">{c?.name || "—"}</td>
                                <td className="py-2 font-mono text-brand-600">{c?.sku}</td>
                                <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                                <td className="py-2 text-gray-500">{item.unit_of_measure}</td>
                                <td className={clsx("py-2 text-right tabular-nums font-medium", short ? "text-red-600" : "text-gray-700")}>
                                  {short && "⚠ "}{c?.quantity_on_hand?.toLocaleString() ?? "—"}
                                </td>
                                <td className="py-2 text-right tabular-nums text-gray-600">{c ? formatCurrency(c.unit_cost) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PageWrapper>

      <AddBOMDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} products={products} />
      <EditBOMDrawer bom={editBOM} onClose={() => setEditBOM(null)} onSuccess={handleUpdated} products={products} />
    </>
  );
}