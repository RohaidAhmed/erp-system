"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
    Plus, RefreshCw, Search, ArrowDownToLine, ArrowUpFromLine,
    ArrowLeftRight, SlidersHorizontal, X, ChevronRight,
    CheckCircle2, Loader2, AlertCircle, Lock, Package,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatDate } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import type { StockMovement, Product, Warehouse } from "@/types";
import { clsx } from "clsx";

// ── Movement type config ───────────────────────────────────────────────────────

const MOVE_TYPES = [
    {
        value: "inbound",
        label: "Inbound",
        icon: ArrowDownToLine,
        color: "text-emerald-700",
        bg: "bg-emerald-50 border-emerald-200",
        badge: "bg-emerald-50 text-emerald-700",
        desc: "Stock received — adds to on-hand quantity",
    },
    {
        value: "outbound",
        label: "Outbound",
        icon: ArrowUpFromLine,
        color: "text-red-700",
        bg: "bg-red-50 border-red-200",
        badge: "bg-red-50 text-red-700",
        desc: "Stock issued or dispatched — reduces on-hand",
    },
    {
        value: "adjustment",
        label: "Adjustment",
        icon: SlidersHorizontal,
        color: "text-amber-700",
        bg: "bg-amber-50 border-amber-200",
        badge: "bg-amber-50 text-amber-700",
        desc: "Manual correction after count — adds to on-hand",
    },
    {
        value: "transfer",
        label: "Transfer",
        icon: ArrowLeftRight,
        color: "text-blue-700",
        bg: "bg-blue-50 border-blue-200",
        badge: "bg-blue-50 text-blue-700",
        desc: "Between warehouses — no net qty change (log only)",
    },
];

function moveMeta(type: string) {
    return MOVE_TYPES.find((m) => m.value === type) || MOVE_TYPES[0];
}

// ── Drawer shell ───────────────────────────────────────────────────────────────

function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
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
                        <h2 className="text-base font-semibold text-gray-900">Log Stock Movement</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Record inventory in, out, transfers or adjustments</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
                    <span>Inventory</span><ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">New Movement</span>
                </div>
                {children}
            </div>
        </>
    );
}

// ── Add movement form ──────────────────────────────────────────────────────────

interface MFields {
    product_id: string;
    warehouse_id: string;
    type: string;
    quantity: string;
    reference: string;
    notes: string;
}
interface MErrors {
    product_id?: string;
    warehouse_id?: string;
    type?: string;
    quantity?: string;
    reference?: string;
}

const EMPTY_M: MFields = { product_id: "", warehouse_id: "", type: "", quantity: "", reference: "", notes: "" };

function validateMovement(f: MFields): MErrors {
    const e: MErrors = {};
    if (!f.product_id) e.product_id = "Select a product.";
    if (!f.warehouse_id) e.warehouse_id = "Select a warehouse.";
    if (!f.type) e.type = "Select movement type.";
    if (!f.reference.trim()) e.reference = "Reference is required.";
    const qty = parseFloat(f.quantity);
    if (!f.quantity || isNaN(qty) || qty <= 0) e.quantity = "Enter a positive quantity.";
    return e;
}

function AddMovementDrawer({ open, onClose, onSuccess, products, warehouses }: {
    open: boolean; onClose: () => void; onSuccess: (m: StockMovement) => void;
    products: Product[]; warehouses: Warehouse[];
}) {
    const { can } = useAuth();
    const canCreate = can.create("inventory");

    const [f, setF] = useState<MFields>(EMPTY_M);
    const [errs, setErrs] = useState<MErrors>({});
    const [busy, setBusy] = useState(false);
    const [ok, setOk] = useState(false);
    const [err, setErr] = useState("");
    const firstRef = useRef<HTMLSelectElement>(null);

    // Selected product for stock context
    const selectedProduct = products.find((p) => p.id === f.product_id);
    const qty = parseFloat(f.quantity || "0");
    const meta = f.type ? moveMeta(f.type) : null;

    // Preview new stock after movement
    const previewQty = selectedProduct
        ? f.type === "inbound" ? selectedProduct.quantity_on_hand + qty
            : f.type === "outbound" ? selectedProduct.quantity_on_hand - qty
                : f.type === "adjustment" ? selectedProduct.quantity_on_hand + qty
                    : selectedProduct.quantity_on_hand // transfer
        : 0;
    const previewNegative = previewQty < 0;

    const set = (k: keyof MFields, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((p) => ({ ...p, [k]: undefined })); };

    useEffect(() => {
        if (open) { setF(EMPTY_M); setErrs({}); setOk(false); setErr(""); setTimeout(() => firstRef.current?.focus(), 120); }
    }, [open]);

    const handleSubmit = async () => {
        const e = validateMovement(f);
        if (Object.keys(e).length) { setErrs(e); return; }
        setBusy(true); setErr("");
        try {
            const res = await fetch("/api/inventory/movements", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...f, quantity: parseFloat(f.quantity), notes: f.notes.trim() || undefined }),
            });
            const data = await res.json();
            if (data.success) {
                setOk(true); onSuccess(data.data);
                // Update product qty in the products list by refreshing
                setTimeout(onClose, 900);
            } else setErr(data.message || "Failed.");
        } catch { setErr("Network error."); }
        finally { setBusy(false); }
    };

    return (
        <Drawer open={open} onClose={onClose}>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {!canCreate ? (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <Lock className="w-4 h-4 text-amber-500 mt-0.5" />
                        <p className="text-sm text-amber-700">Your role cannot log stock movements. Requires Inventory Manager.</p>
                    </div>
                ) : (
                    <>
                        {/* Movement type — card grid */}
                        <div>
                            <label className="label">Movement Type <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-2 gap-2">
                                {MOVE_TYPES.map((mt) => (
                                    <button key={mt.value} type="button"
                                        onClick={() => set("type", mt.value)}
                                        className={clsx(
                                            "flex items-start gap-2 p-3 rounded-xl border text-left transition-all",
                                            f.type === mt.value ? `${mt.bg} ring-1 ring-offset-0` : "border-surface-400 bg-white hover:bg-surface-50"
                                        )}>
                                        <mt.icon className={clsx("w-4 h-4 flex-shrink-0 mt-0.5", f.type === mt.value ? mt.color : "text-gray-400")} />
                                        <div>
                                            <p className={clsx("text-xs font-semibold", f.type === mt.value ? mt.color : "text-gray-700")}>{mt.label}</p>
                                            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{mt.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {errs.type && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.type}</p>}
                        </div>

                        {/* Product */}
                        <div>
                            <label className="label">Product <span className="text-red-500">*</span></label>
                            <select ref={firstRef} value={f.product_id} onChange={(e) => set("product_id", e.target.value)}
                                className={clsx("input", errs.product_id && "border-red-400")}>
                                <option value="">— Select product —</option>
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                                ))}
                            </select>
                            {errs.product_id && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.product_id}</p>}

                            {/* Current stock context */}
                            {selectedProduct && (
                                <div className={clsx(
                                    "mt-2 flex items-center justify-between px-3 py-2 rounded-lg border text-xs",
                                    selectedProduct.quantity_on_hand <= selectedProduct.reorder_point && selectedProduct.reorder_point > 0
                                        ? "bg-red-50 border-red-200" : "bg-surface-100 border-surface-300"
                                )}>
                                    <span className="text-gray-500 flex items-center gap-1.5"><Package className="w-3 h-3" /> Current stock:</span>
                                    <span className="font-bold text-gray-800 tabular-nums">
                                        {selectedProduct.quantity_on_hand.toLocaleString()} {selectedProduct.unit_of_measure}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Warehouse */}
                        <div>
                            <label className="label">Warehouse <span className="text-red-500">*</span></label>
                            <select value={f.warehouse_id} onChange={(e) => set("warehouse_id", e.target.value)}
                                className={clsx("input", errs.warehouse_id && "border-red-400")}>
                                <option value="">— Select warehouse —</option>
                                {warehouses.filter((w) => w.is_active).map((w) => (
                                    <option key={w.id} value={w.id}>{w.code} — {w.name} ({w.location})</option>
                                ))}
                            </select>
                            {errs.warehouse_id && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.warehouse_id}</p>}
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="label">Quantity <span className="text-red-500">*</span></label>
                            <input type="number" min="0.001" step="0.001" value={f.quantity} onChange={(e) => set("quantity", e.target.value)}
                                placeholder="0" className={clsx("input tabular-nums", errs.quantity && "border-red-400")} />
                            {errs.quantity && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.quantity}</p>}

                            {/* Stock after preview */}
                            {selectedProduct && f.quantity && qty > 0 && (
                                <div className={clsx(
                                    "mt-2 flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium",
                                    previewNegative ? "bg-red-50 border-red-300 text-red-700" : "bg-brand-50 border-brand-200 text-brand-700"
                                )}>
                                    <span>After this movement:</span>
                                    <span className="tabular-nums">
                                        {previewNegative ? "⚠ " : ""}{Math.max(0, previewQty).toLocaleString()} {selectedProduct.unit_of_measure}
                                        {previewNegative && " (server will block)"}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Reference */}
                        <div>
                            <label className="label">Reference <span className="text-red-500">*</span></label>
                            <input type="text" value={f.reference} onChange={(e) => set("reference", e.target.value)}
                                placeholder="e.g. PO-2026-001, GRN-045, ADJUST-Q1"
                                className={clsx("input font-mono", errs.reference && "border-red-400")} />
                            <p className="mt-1 text-xs text-gray-400">PO number, GRN, or other document reference</p>
                            {errs.reference && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errs.reference}</p>}
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="label">Notes <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
                            <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)}
                                rows={2} placeholder="Additional details…"
                                className="input resize-none" />
                        </div>
                    </>
                )}

                {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{err}</div>}
                {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Movement logged!</div>}
            </div>

            <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex items-center justify-between flex-shrink-0">
                <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required</p>
                <div className="flex gap-2">
                    <button onClick={onClose} className="btn-secondary" disabled={busy}>Cancel</button>
                    <button onClick={handleSubmit} disabled={busy || ok || !canCreate} className="btn-primary min-w-[140px] justify-center">
                        {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Logging…</>
                            : ok ? <><CheckCircle2 className="w-3.5 h-3.5" /> Logged!</>
                                : "Log Movement"}
                    </button>
                </div>
            </div>
        </Drawer>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MovementsPage() {
    const { can, user, loading: authLoading } = useAuth();
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [addOpen, setAddOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState("");
    const [prodFilter, setProdFilter] = useState("");
    const [whFilter, setWhFilter] = useState("");
    const [search, setSearch] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams({ pageSize: "100" });
        if (typeFilter) p.set("type", typeFilter);
        if (prodFilter) p.set("product_id", prodFilter);
        if (whFilter) p.set("warehouse_id", whFilter);
        fetch(`/api/inventory/movements?${p}`)
            .then((r) => r.json())
            .then((res) => { if (res.success) { setMovements(res.data); setTotal(res.pagination?.totalCount || 0); } })
            .finally(() => setLoading(false));
    }, [typeFilter, prodFilter, whFilter]);

    useEffect(() => {
        fetch("/api/inventory/products?pageSize=300").then((r) => r.json()).then((res) => { if (res.success) setProducts(res.data); });
        fetch("/api/inventory/warehouses?pageSize=100").then((r) => r.json()).then((res) => { if (res.success) setWarehouses(res.data); });
    }, []);
    useEffect(() => { load(); }, [load]);

    const handleAdded = (m: StockMovement) => {
        setMovements((p) => [m, ...p]); setTotal((t) => t + 1);
        // Refresh products to get updated stock quantities
        fetch("/api/inventory/products?pageSize=300").then((r) => r.json()).then((res) => { if (res.success) setProducts(res.data); });
    };

    const visible = search
        ? movements.filter((m) =>
            (m as any).product?.name?.toLowerCase().includes(search.toLowerCase()) ||
            (m as any).product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
            m.reference?.toLowerCase().includes(search.toLowerCase())
        )
        : movements;

    // Summary stats
    const stats = {
        inbound: movements.filter((m) => m.type === "inbound").reduce((s, m) => s + m.quantity, 0),
        outbound: movements.filter((m) => m.type === "outbound").reduce((s, m) => s + m.quantity, 0),
        adjustment: movements.filter((m) => m.type === "adjustment").length,
        transfer: movements.filter((m) => m.type === "transfer").length,
    };

    return (
        <>
            <Header title="Stock Movements" subtitle="Inventory Module"
                actions={
                    <div className="flex items-center gap-2">
                        <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
                        {can.create("inventory") && <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> Log Movement</button>}
                    </div>
                }
            />
            <PageWrapper>
                {!authLoading && user && (
                    <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{user.full_name}</span>
                        <span>·</span><span className="capitalize">{user.role.replace(/_/g, " ")}</span>
                        <span className={can.create("inventory") ? "text-emerald-600" : "text-gray-400"}>
                            {can.create("inventory") ? "✓ Can log movements" : "✗ Read-only"}
                        </span>
                    </div>
                )}

                {/* Summary */}
                {!loading && movements.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 mb-4">
                        {[
                            { label: "Total In", value: `${stats.inbound.toLocaleString()} units`, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                            { label: "Total Out", value: `${stats.outbound.toLocaleString()} units`, color: "text-red-600", bg: "bg-red-50 border-red-200" },
                            { label: "Adjustments", value: `${stats.adjustment} movements`, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                            { label: "Transfers", value: `${stats.transfer} movements`, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                        ].map((s) => (
                            <div key={s.label} className={clsx("rounded-xl border px-4 py-3", s.bg)}>
                                <p className="text-xs text-gray-500">{s.label}</p>
                                <p className={clsx("text-base font-bold mt-1 tabular-nums", s.color)}>{s.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="relative flex-1 min-w-[160px] max-w-[240px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU or reference…" className="input pl-8 text-xs py-1.5" />
                    </div>
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
                        <option value="">All Types</option>
                        {MOVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <select value={prodFilter} onChange={(e) => setProdFilter(e.target.value)} className="input !w-auto text-xs py-1.5 max-w-[200px]">
                        <option value="">All Products</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                    </select>
                    <select value={whFilter} onChange={(e) => setWhFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
                        <option value="">All Warehouses</option>
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                    </select>
                </div>

                <SectionTitle title="Stock Movements" count={total} />

                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-100">
                                    {["Date", "Type", "Product", "Warehouse", "Quantity", "Reference", "Notes"].map((h) => (
                                        <th key={h} className={clsx("table-header px-4 py-3", h === "Quantity" ? "text-right" : "text-left")}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? <tr><td colSpan={7}><TableSkeleton rows={8} cols={7} /></td></tr>
                                    : visible.length === 0 ? (
                                        <tr><td colSpan={7}>
                                            <EmptyState title="No movements found" description="Log a stock movement to get started."
                                                action={can.create("inventory") ? <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> Log Movement</button> : undefined} />
                                        </td></tr>
                                    ) : visible.map((mv) => {
                                        const meta = moveMeta(mv.type);
                                        const prod = (mv as any).product;
                                        const wh = (mv as any).warehouse;
                                        return (
                                            <tr key={mv.id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors">
                                                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(mv.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border", meta.badge, "border-transparent")}>
                                                        <meta.icon className="w-3 h-3" />
                                                        {meta.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900 text-sm">{prod?.name || "—"}</p>
                                                    <p className="text-xs text-gray-500 font-mono">{prod?.sku}</p>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    <p className="text-sm">{wh?.name || "—"}</p>
                                                    <p className="text-xs text-gray-400 font-mono">{wh?.code}</p>
                                                </td>
                                                <td className={clsx("px-4 py-3 text-right tabular-nums font-bold",
                                                    mv.type === "inbound" || mv.type === "adjustment" ? "text-emerald-700"
                                                        : mv.type === "outbound" ? "text-red-600"
                                                            : "text-blue-700")}>
                                                    {mv.type === "outbound" ? "−" : mv.type === "transfer" ? "↔" : "+"}{mv.quantity.toLocaleString()}
                                                    <span className="ml-1 text-xs font-normal text-gray-400">{prod?.unit_of_measure}</span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-brand-700">{mv.reference}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{mv.notes || "—"}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </PageWrapper>

            <AddMovementDrawer
                open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleAdded}
                products={products} warehouses={warehouses}
            />
        </>
    );
}