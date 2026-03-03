"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import type { SalesOrder } from "@/types";

const statuses = ["", "draft", "confirmed", "picking", "shipped", "delivered", "cancelled"];

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "50" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/sales/orders?${params}`)
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
        title="Sales Orders"
        subtitle="Sales & CRM Module"
        actions={
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
              {statuses.map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
            </select>
            <button className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Order</button>
          </div>
        }
      />
      <PageWrapper>
        <SectionTitle title="Sales Orders" count={total} />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="text-left table-header px-4 py-3">SO Number</th>
                  <th className="text-left table-header px-4 py-3">Customer</th>
                  <th className="text-left table-header px-4 py-3">Order Date</th>
                  <th className="text-left table-header px-4 py-3">Delivery</th>
                  <th className="text-right table-header px-4 py-3">Total</th>
                  <th className="text-left table-header px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}><TableSkeleton rows={8} cols={6} /></td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState title="No sales orders" description="Create your first sales order." /></td></tr>
                ) : (
                  orders.map((so) => (
                    <tr key={so.id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{so.so_number}</td>
                      <td className="px-4 py-3 text-gray-700">{(so as any).customers?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(so.order_date)}</td>
                      <td className="px-4 py-3 text-gray-600">{so.delivery_date ? formatDate(so.delivery_date) : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(so.total_amount, so.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={so.status} /></td>
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
