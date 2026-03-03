"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Download, RefreshCw } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, KPICard, formatCurrency } from "@/components/ui";

const mockData = {
  monthly: [
    { month: "Sep 25", revenue: 82000, expenses: 61000, profit: 21000 },
    { month: "Oct 25", revenue: 95000, expenses: 70000, profit: 25000 },
    { month: "Nov 25", revenue: 88000, expenses: 65000, profit: 23000 },
    { month: "Dec 25", revenue: 112000, expenses: 78000, profit: 34000 },
    { month: "Jan 26", revenue: 98000, expenses: 72000, profit: 26000 },
    { month: "Feb 26", revenue: 124000, expenses: 82000, profit: 42000 },
  ],
  topProducts: [
    { name: "Product Alpha", sales: 320 },
    { name: "Product Beta", sales: 280 },
    { name: "Product Gamma", sales: 190 },
    { name: "Product Delta", sales: 150 },
    { name: "Product Epsilon", sales: 120 },
  ],
};

export default function ReportingPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/reporting")
      .then((r) => r.json())
      .then((res) => { if (res.success) setStats(res.data.stats); });
  }, []);

  return (
    <>
      <Header
        title="Reporting & Analytics"
        subtitle="Business Intelligence Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            <button className="btn-primary"><Download className="w-3.5 h-3.5" /> Export</button>
          </div>
        }
      />
      <PageWrapper>
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KPICard metric={stats.revenue} />
            <KPICard metric={stats.active_employees} />
            <KPICard metric={stats.inventory_value} />
            <KPICard metric={stats.open_purchase_orders} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">P&L Overview (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={mockData.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, border: "1px solid #e4e8f0", borderRadius: 8 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#6471f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#e0e9ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Profit Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={mockData.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, border: "1px solid #e4e8f0", borderRadius: 8 }} />
                <Line type="monotone" dataKey="profit" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4, fill: "#34d399" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Products by Sales Volume</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockData.topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
              <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #e4e8f0", borderRadius: 8 }} />
              <Bar dataKey="sales" fill="#6471f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PageWrapper>
    </>
  );
}
