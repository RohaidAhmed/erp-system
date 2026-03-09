"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, Pencil, Search, AlertTriangle,
  PackageX, Package, ChevronRight, X, CheckCircle2,
  Loader2, AlertCircle, Lock,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatCurrency } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/types";
import { clsx } from "clsx";

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Electronic Components", "PCB & Assemblies", "RF Components",
  "Mechanical Parts", "Cables & Connectors", "Test Equipment",
  "Consumables", "Raw Materials", "Software Licenses", "Other",
];

const UNITS = ["pcs", "unit", "kg", "g", "m", "cm", "mm", "litre", "ml", "box", "roll", "set", "pair"];

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
      <div className={clsx("fixed top-0 right-0 h-full w-[520px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
          <span>Inventory</span><ChevronRight className="w-3 h-3" />
          <span className="text-gray-700 font-medium">{breadcrumb}</span>
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

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{msg}</p>;
}

function AccessDenied({ action }: { action: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
      <Lock className="w-4 h-4 text-amber-500 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">Permission required</p>
        <p className="text-xs text-amber-600 mt-0.5">Your role cannot <strong>{action}</strong>. Requires Inventory Manager.</p>
      </div>
    </div>
  );
}

// ── Product form ───────────────────────────────────────────────────────────────

interface PFields {
  sku: string; name: string; description: string; category: string;
  unit_of_measure: string; unit_cost: string; unit_price: string;
  quantity_on_hand: string; reorder_point: string; reorder_quantity: string;
}
interface PErrors { sku?: string; name?: string; category?: string; unit_of_measure?: string; }

const EMPTY: PFields = {
  sku: "", name: "", description: "", category: "", unit_of_measure: "pcs",
  unit_cost: "0", unit_price: "0", quantity_on_hand: "0",
  reorder_point: "0", reorder_quantity: "0",
};

function validateProduct(f: PFields, mode: "add" | "edit"): PErrors {
  const e: PErrors = {};
  if (mode === "add" && !f.sku.trim()) e.sku = "SKU is required.";
  if (!f.name.trim()) e.name = "Name is required.";
  if (!f.category.trim()) e.category = "Category is required.";
  if (!f.unit_of_measure.trim()) e.unit_of_measure = "Unit of measure is required.";
  return e;
}

function ProductForm({ f, errs, set, mode, firstRef, readOnly }: {
  f: PFields; errs: PErrors; set: (k: keyof PFields, v: string) => void;
  mode: "add" | "edit"; firstRef?: React.Ref<HTMLInputElement>; readOnly?: boolean;
}) {
  const inp = (extra?: string) => clsx("input", extra, readOnly && "opacity-60 cursor-not-allowed");
  const margin = parseFloat(f.unit_price || "0") - parseFloat(f.unit_cost || "0");

  return (
    <div className="space-y-5">
      {/* SKU + UoM */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">SKU {mode === "add" && <span className="text-red-500">*</span>}</label>
          <input ref={firstRef} type="text" value={f.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())}
            placeholder="e.g. CAP-0402-100N" disabled={readOnly || mode === "edit"}
            className={clsx("input font-mono", errs.sku && "border-red-400", (readOnly || mode === "edit") && "opacity-60 cursor-not-allowed bg-surface-200")} />
          {mode === "edit" && !readOnly && <p className="mt-1 text-xs text-gray-400">SKU cannot be changed.</p>}
          <FieldError msg={errs.sku} />
        </div>
        <div>
          <label className="label">Unit of Measure <span className="text-red-500">*</span></label>
          <input type="text" list="uom-list" value={f.unit_of_measure} onChange={(e) => set("unit_of_measure", e.target.value)}
            placeholder="pcs" disabled={readOnly} className={inp(errs.unit_of_measure && "border-red-400")} />
          <datalist id="uom-list">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          <FieldError msg={errs.unit_of_measure} />
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="label">Product Name <span className="text-red-500">*</span></label>
        <input type="text" value={f.name} onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. 100nF Ceramic Capacitor 0402" disabled={readOnly} className={inp(errs.name && "border-red-400")} />
        <FieldError msg={errs.name} />
      </div>

      {/* Category */}
      <div>
        <label className="label">Category <span className="text-red-500">*</span></label>
        <input type="text" list="category-list" value={f.category} onChange={(e) => set("category", e.target.value)}
          placeholder="Type or select…" disabled={readOnly} className={inp(errs.category && "border-red-400")} />
        <datalist id="category-list">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        <FieldError msg={errs.category} />
      </div>

      {/* Description */}
      <div>
        <label className="label">Description <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
        <textarea value={f.description} onChange={(e) => set("description", e.target.value)}
          rows={2} placeholder="Specifications, part notes…" disabled={readOnly}
          className={clsx("input resize-none", readOnly && "opacity-60 cursor-not-allowed")} />
      </div>

      {/* Pricing */}
      <div>
        <p className="label mb-2">Pricing</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label text-xs">Unit Cost</label>
            <input type="number" min="0" step="0.01" value={f.unit_cost} onChange={(e) => set("unit_cost", e.target.value)}
              placeholder="0.00" disabled={readOnly} className={inp("tabular-nums")} />
          </div>
          <div>
            <label className="label text-xs">Unit Price (sell)</label>
            <input type="number" min="0" step="0.01" value={f.unit_price} onChange={(e) => set("unit_price", e.target.value)}
              placeholder="0.00" disabled={readOnly} className={inp("tabular-nums")} />
          </div>
        </div>
        {(parseFloat(f.unit_cost || "0") > 0 || parseFloat(f.unit_price || "0") > 0) && (
          <p className={clsx("mt-2 text-xs font-medium", margin >= 0 ? "text-emerald-600" : "text-red-500")}>
            Margin: {margin >= 0 ? "+" : ""}{formatCurrency(margin)} per {f.unit_of_measure || "unit"}
          </p>
        )}
      </div>

      {/* Stock levels */}
      <div>
        <p className="label mb-2">Stock Levels</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label text-xs">On Hand {mode === "add" && <span className="text-xs text-gray-400">(initial)</span>}</label>
            <input type="number" min="0" step="0.001" value={f.quantity_on_hand} onChange={(e) => set("quantity_on_hand", e.target.value)}
              placeholder="0" disabled={readOnly || mode === "edit"} className={clsx("input tabular-nums", (readOnly || mode === "edit") && "opacity-60 cursor-not-allowed bg-surface-200")} />
            {mode === "edit" && !readOnly && <p className="mt-1 text-xs text-gray-400">Use stock movements to adjust.</p>}
          </div>
          <div>
            <label className="label text-xs">Reorder Point</label>
            <input type="number" min="0" step="0.001" value={f.reorder_point} onChange={(e) => set("reorder_point", e.target.value)}
              placeholder="0" disabled={readOnly} className={inp("tabular-nums")} />
          </div>
          <div>
            <label className="label text-xs">Reorder Qty</label>
            <input type="number" min="0" step="0.001" value={f.reorder_quantity} onChange={(e) => set("reorder_quantity", e.target.value)}
              placeholder="0" disabled={readOnly} className={inp("tabular-nums")} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared form state hook ─────────────────────────────────────────────────────

function useForm() {
  const [f, setF] = useState<PFields>(EMPTY);
  const [errs, setErrs] = useState<PErrors>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof PFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };
  const reset = (init: PFields) => { setF(init); setErrs({}); setOk(false); setErr(""); };
  return { f, errs, setErrs, set, reset, busy, setBusy, ok, setOk, err, setErr };
}

// ── Add Product Drawer ─────────────────────────────────────────────────────────

function AddProductDrawer({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: (p: Product) => void;
}) {
  const { can } = useAuth();
  const canCreate = can.create("inventory");
  const form = useForm();
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { form.reset(EMPTY); setTimeout(() => firstRef.current?.focus(), 120); }
  }, [open]);

  const handleSubmit = async () => {
    const e = validateProduct(form.f, "add");
    if (Object.keys(e).length) { form.setErrs(e); return; }
    form.setBusy(true); form.setErr("");
    try {
      const res = await fetch("/api/inventory/products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: form.f.sku.trim().toUpperCase(), name: form.f.name.trim(),
          description: form.f.description.trim() || undefined,
          category: form.f.category.trim(), unit_of_measure: form.f.unit_of_measure.trim(),
          unit_cost: parseFloat(form.f.unit_cost || "0"), unit_price: parseFloat(form.f.unit_price || "0"),
          quantity_on_hand: parseFloat(form.f.quantity_on_hand || "0"),
          reorder_point: parseFloat(form.f.reorder_point || "0"),
          reorder_quantity: parseFloat(form.f.reorder_quantity || "0"),
        }),
      });
      const data = await res.json();
      if (data.success) { form.setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else form.setErr(data.message || "Failed.");
    } catch { form.setErr("Network error."); }
    finally { form.setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Product" subtitle="Add a product to the catalog" breadcrumb="New Product">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!canCreate ? <AccessDenied action="create products" /> :
          <ProductForm f={form.f} errs={form.errs} set={form.set} mode="add" firstRef={firstRef} />}
        {form.err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{form.err}</div>}
        {form.ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Product added!</div>}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSubmit} submitting={form.busy} success={form.ok} label="Add Product" disabled={!canCreate} />
    </Drawer>
  );
}

// ── Edit Product Drawer ────────────────────────────────────────────────────────

function EditProductDrawer({ product: prod, onClose, onSuccess }: {
  product: Product | null; onClose: () => void; onSuccess: (p: Product) => void;
}) {
  const open = !!prod;
  const { can } = useAuth();
  const canEdit = can.edit("inventory");
  const canFull = can.full("inventory");
  const form = useForm();
  const [deactivating, setDeactivating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (prod) {
      form.reset({
        sku: prod.sku, name: prod.name, description: prod.description || "",
        category: prod.category, unit_of_measure: prod.unit_of_measure,
        unit_cost: String(prod.unit_cost), unit_price: String(prod.unit_price),
        quantity_on_hand: String(prod.quantity_on_hand),
        reorder_point: String(prod.reorder_point),
        reorder_quantity: String(prod.reorder_quantity),
      });
      setConfirmDeactivate(false);
    }
  }, [prod]);

  const handleSave = async () => {
    const e = validateProduct(form.f, "edit");
    if (Object.keys(e).length || !prod) { form.setErrs(e); return; }
    form.setBusy(true); form.setErr("");
    try {
      const res = await fetch(`/api/inventory/products/${prod.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.f.name.trim(), description: form.f.description.trim() || undefined,
          category: form.f.category.trim(), unit_of_measure: form.f.unit_of_measure.trim(),
          unit_cost: parseFloat(form.f.unit_cost || "0"), unit_price: parseFloat(form.f.unit_price || "0"),
          reorder_point: parseFloat(form.f.reorder_point || "0"),
          reorder_quantity: parseFloat(form.f.reorder_quantity || "0"),
        }),
      });
      const data = await res.json();
      if (data.success) { form.setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
      else form.setErr(data.message || "Update failed.");
    } catch { form.setErr("Network error."); }
    finally { form.setBusy(false); }
  };

  const handleToggleActive = async () => {
    if (!prod) return;
    setDeactivating(true); form.setErr("");
    try {
      const res = await fetch(`/api/inventory/products/${prod.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !prod.is_active }),
      });
      const data = await res.json();
      if (data.success) { onSuccess(data.data); setTimeout(onClose, 300); }
      else form.setErr(data.message || "Failed.");
    } catch { form.setErr("Network error."); }
    finally { setDeactivating(false); setConfirmDeactivate(false); }
  };

  const isLow = prod && prod.quantity_on_hand <= prod.reorder_point && prod.reorder_point > 0;

  return (
    <Drawer open={open} onClose={onClose} title="Edit Product"
      subtitle={prod ? `${prod.sku} · ${prod.category}` : ""} breadcrumb="Edit Product">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Status + stock banner */}
        {prod && (
          <div className="grid grid-cols-2 gap-2">
            <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs",
              prod.is_active ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200")}>
              <span className={clsx("w-2 h-2 rounded-full", prod.is_active ? "bg-emerald-500" : "bg-gray-400")} />
              <span className={prod.is_active ? "text-emerald-700 font-medium" : "text-gray-500"}>{prod.is_active ? "Active" : "Inactive"}</span>
            </div>
            <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs",
              isLow ? "bg-red-50 border-red-200" : "bg-surface-100 border-surface-300")}>
              {isLow ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> : <Package className="w-3.5 h-3.5 text-gray-400" />}
              <span className={isLow ? "text-red-700 font-medium" : "text-gray-600"}>
                {prod.quantity_on_hand.toLocaleString()} {prod.unit_of_measure} on hand
              </span>
            </div>
          </div>
        )}

        {!canEdit && <AccessDenied action="edit products" />}
        <ProductForm f={form.f} errs={form.errs} set={form.set} mode="edit" readOnly={!canEdit || !prod?.is_active} />

        {/* Deactivate / Reactivate */}
        {prod && (
          <div className="pt-2 border-t border-surface-300 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
            {prod.is_active ? (
              !confirmDeactivate ? (
                <button onClick={() => canFull && setConfirmDeactivate(true)} disabled={!canFull}
                  className={clsx("flex items-center gap-2 text-xs font-medium transition-colors",
                    canFull ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed")}>
                  <PackageX className="w-3.5 h-3.5" /> Deactivate product
                  {!canFull && <span className="text-gray-400">(Inventory Manager required)</span>}
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                  <p className="text-xs text-red-700 font-medium">
                    Deactivate <strong>{prod.name}</strong>?
                    {prod.quantity_on_hand > 0 && " Note: product has stock on hand — server will block this."}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleToggleActive} disabled={deactivating}
                      className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5">
                      {deactivating ? "Deactivating…" : <><PackageX className="w-3 h-3" /> Confirm</>}
                    </button>
                    <button onClick={() => setConfirmDeactivate(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                  </div>
                </div>
              )
            ) : (
              <button onClick={handleToggleActive} disabled={deactivating || !canFull}
                className={clsx("flex items-center gap-2 text-xs font-medium transition-colors",
                  canFull ? "text-emerald-600 hover:text-emerald-700" : "text-gray-300 cursor-not-allowed")}>
                <Package className="w-3.5 h-3.5" /> Reactivate product
                {!canFull && <span className="text-gray-400">(Inventory Manager required)</span>}
              </button>
            )}
          </div>
        )}

        {form.err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{form.err}</div>}
        {form.ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Product updated!</div>}
      </div>
      <DrawerFooter onCancel={onClose} onSubmit={handleSave} submitting={form.busy}
        success={form.ok} label="Save Changes" disabled={!canEdit || !prod?.is_active} />
    </Drawer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { can, user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Distinct categories from loaded products
  const [categories, setCategories] = useState<string[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "200" });
    if (search) p.set("search", search);
    if (category) p.set("category", category);
    if (lowStock) p.set("low_stock", "true");
    if (showInactive) p.set("inactive", "true");
    fetch(`/api/inventory/products?${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setProducts(res.data);
          setTotal(res.pagination?.totalCount || res.data.length);
          // build category list
          // const cats = [...new Set((res.data as Product[]).map((p) => p.category))].sort();
          const cats = Array.from(new Set((res.data as Product[]).map((p) => p.category))).sort();
          setCategories(cats);
        }
      })
      .finally(() => setLoading(false));
  }, [search, category, lowStock, showInactive]);

  useEffect(() => { load(); }, [load]);

  const handleAdded = (p: Product) => { setProducts((prev) => [p, ...prev]); setTotal((t) => t + 1); };
  const handleUpdated = (p: Product) => { setProducts((prev) => prev.map((x) => x.id === p.id ? p : x)); };

  const lowStockCount = products.filter((p) => p.quantity_on_hand <= p.reorder_point && p.reorder_point > 0).length;
  const totalStockValue = products.reduce((s, p) => s + p.quantity_on_hand * p.unit_cost, 0);
  const inactiveCount = products.filter((p) => !p.is_active).length;

  return (
    <>
      <Header title="Product Catalog" subtitle="Inventory Module"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            {can.create("inventory") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Product</button>}
          </div>
        }
      />
      <PageWrapper>
        {/* Auth strip */}
        {!authLoading && user && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{user.full_name}</span>
            <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
            {[["Add", can.create("inventory")], ["Edit", can.edit("inventory")], ["Deactivate", can.full("inventory")]].map(([l, v]) => (
              <span key={String(l)} className={v ? "text-emerald-600" : "text-gray-400"}>{v ? "✓" : "✗"} {l}</span>
            ))}
          </div>
        )}

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Total Products</span>
              <span className="text-2xl font-bold text-gray-900">{products.filter(p => p.is_active).length}</span>
            </div>
            <div className={clsx("rounded-xl border px-4 py-3 flex items-center justify-between", lowStockCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-surface-300")}>
              <span className="text-xs text-gray-500">Low Stock Alerts</span>
              <span className={clsx("text-2xl font-bold", lowStockCount > 0 ? "text-red-600" : "text-gray-900")}>{lowStockCount}</span>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Stock Value</span>
              <span className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(totalStockValue)}</span>
            </div>
            <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Inactive</span>
              <span className="text-2xl font-bold text-gray-400">{inactiveCount}</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU or name…" className="input pl-8 text-xs py-1.5" />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} className="rounded" />
            Low stock only
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
        </div>

        <SectionTitle title="Products" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  {["SKU", "Name", "Category", "On Hand", "Reorder Pt", "Unit Cost", "Unit Price", "UoM", "Status", ""].map((h, i) => (
                    <th key={h} className={clsx("table-header px-4 py-3", ["On Hand", "Reorder Pt", "Unit Cost", "Unit Price"].includes(h) ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={10}><TableSkeleton rows={8} cols={10} /></td></tr>
                  : products.length === 0 ? (
                    <tr><td colSpan={10}>
                      <EmptyState title="No products found" description="Add your first product to the catalog."
                        action={can.create("inventory") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Product</button> : undefined} />
                    </td></tr>
                  ) : products.map((p) => {
                    const isLow = p.quantity_on_hand <= p.reorder_point && p.reorder_point > 0;
                    return (
                      <tr key={p.id} onClick={() => setEditProduct(p)}
                        className={clsx("border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group", !p.is_active && "opacity-50")}>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{p.sku}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                          {p.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{p.description}</p>}
                        </td>
                        <td className="px-4 py-3"><span className="badge bg-surface-200 text-gray-600 text-xs">{p.category}</span></td>
                        <td className={clsx("px-4 py-3 text-right font-medium tabular-nums", isLow ? "text-red-600" : "text-gray-900")}>
                          <div className="flex items-center justify-end gap-1">
                            {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                            {p.quantity_on_hand.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{p.reorder_point.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatCurrency(p.unit_cost)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatCurrency(p.unit_price)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{p.unit_of_measure}</td>
                        <td className="px-4 py-3">
                          {!p.is_active ? <span className="badge bg-gray-100 text-gray-400 text-xs">Inactive</span>
                            : isLow ? <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle className="w-3 h-3" />Low</span>
                              : <span className="text-xs text-emerald-600 font-medium">OK</span>}
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

      <AddProductDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded} />
      <EditProductDrawer product={editProduct} onClose={() => setEditProduct(null)} onSuccess={handleUpdated} />
    </>
  );
}