"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Filter } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import type { Invoice } from "@/types";

const statuses = ["", "draft", "sent", "approved", "paid", "overdue", "cancelled"];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "50" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/finance/invoices?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setInvoices(res.data); setTotal(res.pagination?.totalCount || 0); }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <>
      <Header
        title="Invoices"
        subtitle="Finance Module — AR & AP"
        actions={
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="input !w-auto text-xs py-1.5">
              {statuses.map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
            </select>
            <button className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Invoice</button>
          </div>
        }
      />
      <PageWrapper>
        <SectionTitle title="Invoices" count={total} />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="text-left table-header px-4 py-3">Invoice #</th>
                  <th className="text-left table-header px-4 py-3">Type</th>
                  <th className="text-left table-header px-4 py-3">Customer</th>
                  <th className="text-right table-header px-4 py-3">Total</th>
                  <th className="text-left table-header px-4 py-3">Issue Date</th>
                  <th className="text-left table-header px-4 py-3">Due Date</th>
                  <th className="text-left table-header px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}><TableSkeleton rows={8} cols={7} /></td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState title="No invoices found" description="Create your first invoice." /></td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 capitalize">{inv.type.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-gray-700">{(inv as any).customers?.name || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(inv.total_amount, inv.currency)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(inv.issue_date)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
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
