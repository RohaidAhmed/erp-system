"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import type { PurchaseOrder } from "@/types";

const statuses = ["", "draft", "pending_approval", "approved", "ordered", "received", "cancelled"];

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "50" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/procurement/purchase-orders?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setOrders(res.data); setTotal(res.pagination?.totalCount || 0); }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <>
      <Header
        title="Purchase Orders"
        subtitle="Procurement Module"
        actions={
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
              {statuses.map((s) => <option key={s} value={s}>{s ? s.replace("_", " ") : "All Statuses"}</option>)}
            </select>
            <button className="btn-primary"><Plus className="w-3.5 h-3.5" /> New PO</button>
          </div>
        }
      />
      <PageWrapper>
        <SectionTitle title="Purchase Orders" count={total} />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="text-left table-header px-4 py-3">PO Number</th>
                  <th className="text-left table-header px-4 py-3">Supplier</th>
                  <th className="text-left table-header px-4 py-3">Order Date</th>
                  <th className="text-left table-header px-4 py-3">Expected</th>
                  <th className="text-right table-header px-4 py-3">Total</th>
                  <th className="text-left table-header px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}><TableSkeleton rows={8} cols={6} /></td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState title="No purchase orders" description="Create your first purchase order." /></td></tr>
                ) : (
                  orders.map((po) => (
                    <tr key={po.id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{po.po_number}</td>
                      <td className="px-4 py-3 text-gray-700">{(po as any).suppliers?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(po.order_date)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(po.expected_date)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(po.total_amount, po.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>
    </>
  );
}
