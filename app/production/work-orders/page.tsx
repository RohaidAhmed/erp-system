"use client";

import { useEffect, useState } from "react";
import { Plus, LayoutGrid, List } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatDate } from "@/components/ui";
import type { WorkOrder } from "@/types";

const KANBAN_COLUMNS = [
  { status: "planned", label: "Planned", color: "border-gray-300" },
  { status: "in_progress", label: "In Progress", color: "border-blue-400" },
  { status: "on_hold", label: "On Hold", color: "border-yellow-400" },
  { status: "completed", label: "Completed", color: "border-emerald-400" },
];

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<"kanban" | "table">("kanban");

  useEffect(() => {
    setLoading(true);
    fetch("/api/production/work-orders?pageSize=100")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setOrders(res.data); setTotal(res.pagination?.totalCount || 0); }
      })
      .finally(() => setLoading(false));
  }, []);

  const byStatus = (status: string) => orders.filter((o) => o.status === status);

  return (
    <>
      <Header
        title="Work Orders"
        subtitle="Production Module"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-surface-400 overflow-hidden">
              <button onClick={() => setView("kanban")} className={`p-1.5 ${view === "kanban" ? "bg-brand-600 text-white" : "bg-white text-gray-600"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setView("table")} className={`p-1.5 ${view === "table" ? "bg-brand-600 text-white" : "bg-white text-gray-600"}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <button className="btn-primary"><Plus className="w-3.5 h-3.5" /> New WO</button>
          </div>
        }
      />
      <PageWrapper>
        <SectionTitle title="Work Orders" count={total} />

        {view === "kanban" ? (
          <div className="grid grid-cols-4 gap-4">
            {KANBAN_COLUMNS.map((col) => (
              <div key={col.status} className={`rounded-xl border-t-2 bg-surface-200 p-3 ${col.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-700">{col.label}</span>
                  <span className="text-xs text-gray-500 bg-white rounded-full px-2 py-0.5">{byStatus(col.status).length}</span>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[1,2,3].map((i) => <div key={i} className="h-20 bg-surface-300 rounded-lg animate-pulse" />)}
                  </div>
                ) : byStatus(col.status).length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">No orders</div>
                ) : (
                  <div className="space-y-2">
                    {byStatus(col.status).map((wo) => (
                      <div key={wo.id} className="card p-3 hover:shadow-card-hover cursor-pointer transition-shadow">
                        <p className="font-mono text-xs text-brand-700 font-medium">{wo.wo_number}</p>
                        <p className="text-sm font-medium text-gray-900 mt-1">{(wo as any).products?.name || "—"}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                          <span>Qty: <span className="font-medium text-gray-700">{wo.quantity}</span></span>
                          <span>{formatDate(wo.planned_end)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-100">
                    <th className="text-left table-header px-4 py-3">WO Number</th>
                    <th className="text-left table-header px-4 py-3">Product</th>
                    <th className="text-right table-header px-4 py-3">Quantity</th>
                    <th className="text-left table-header px-4 py-3">Planned Start</th>
                    <th className="text-left table-header px-4 py-3">Planned End</th>
                    <th className="text-left table-header px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6}><TableSkeleton rows={8} cols={6} /></td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={6}><EmptyState title="No work orders" /></td></tr>
                  ) : (
                    orders.map((wo) => (
                      <tr key={wo.id} className="border-b border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{wo.wo_number}</td>
                        <td className="px-4 py-3 text-gray-700">{(wo as any).products?.name || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{wo.quantity}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(wo.planned_start)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(wo.planned_end)}</td>
                        <td className="px-4 py-3"><StatusBadge status={wo.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PageWrapper>
    </>
  );
}
