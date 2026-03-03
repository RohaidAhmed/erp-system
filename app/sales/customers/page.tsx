"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatCurrency } from "@/components/ui";
import type { Customer } from "@/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch("/api/sales/customers?pageSize=50")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setCustomers(res.data); setTotal(res.pagination?.totalCount || 0); }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header title="Customers" subtitle="Sales & CRM Module" actions={<button className="btn-primary"><Plus className="w-3.5 h-3.5" /> New Customer</button>} />
      <PageWrapper>
        <SectionTitle title="Customer Accounts" count={total} />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="text-left table-header px-4 py-3">Code</th>
                  <th className="text-left table-header px-4 py-3">Name</th>
                  <th className="text-left table-header px-4 py-3">Email</th>
                  <th className="text-left table-header px-4 py-3">Tier</th>
                  <th className="text-right table-header px-4 py-3">Credit Limit</th>
                  <th className="text-left table-header px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}><TableSkeleton rows={8} cols={6} /></td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState title="No customers" description="Add your first customer." /></td></tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className="border-b border-surface-200 hover:bg-surface-50 cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.customer_code}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.email}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.tier} /></td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(c.credit_limit, c.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.is_active ? "active" : "terminated"} label={c.is_active ? "Active" : "Inactive"} /></td>
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
