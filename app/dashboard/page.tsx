"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  DollarSign, Users, Package, ShoppingCart, TrendingUp, Factory, FileText, BarChart3,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { KPICard, PageWrapper, formatCurrency } from "@/components/ui";

const COLORS = ["#6471f1", "#34d399", "#f59e0b", "#f87171", "#a78bfa"];

const mockMonthlyRevenue = [
  { month: "Sep", revenue: 82000, expenses: 61000 },
  { month: "Oct", revenue: 95000, expenses: 70000 },
  { month: "Nov", revenue: 88000, expenses: 65000 },
  { month: "Dec", revenue: 112000, expenses: 78000 },
  { month: "Jan", revenue: 98000, expenses: 72000 },
  { month: "Feb", revenue: 124000, expenses: 82000 },
];

const mockModuleActivity = [
  { name: "Finance", value: 34 },
  { name: "HR", value: 22 },
  { name: "Inventory", value: 18 },
  { name: "Procurement", value: 14 },
  { name: "Sales", value: 12 },
];

const mockRecentActivity = [
  { id: 1, type: "invoice", desc: "Invoice INV-2026-0041 approved", time: "2 min ago", color: "bg-green-500" },
  { id: 2, type: "po", desc: "Purchase Order PO-2026-0128 created", time: "14 min ago", color: "bg-blue-500" },
  { id: 3, type: "employee", desc: "New employee Aisha Khan onboarded", time: "1 hr ago", color: "bg-purple-500" },
  { id: 4, type: "so", desc: "Sales Order SO-2026-0315 confirmed", time: "2 hr ago", color: "bg-brand-500" },
  { id: 5, type: "wo", desc: "Work Order WO-2026-0044 completed", time: "3 hr ago", color: "bg-emerald-500" },
  { id: 6, type: "stock", desc: "Low stock alert: SKU-00821 (14 units)", time: "4 hr ago", color: "bg-red-500" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reporting")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setStats(res.data.stats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const kpiMetrics = stats
    ? [
        { metric: stats.revenue, icon: DollarSign },
        { metric: stats.open_invoices, icon: FileText },
        { metric: stats.active_employees, icon: Users },
        { metric: stats.inventory_value, icon: Package },
        { metric: stats.open_purchase_orders, icon: ShoppingCart },
        { metric: stats.sales_pipeline, icon: TrendingUp },
        { metric: stats.production_orders, icon: Factory },
        { metric: { label: "Modules Active", value: 7, trend: "flat" as const }, icon: BarChart3 },
      ]
    : [];

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Welcome back — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
      />
      <PageWrapper>
        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-3 bg-surface-300 rounded w-24 mb-3" />
                  <div className="h-7 bg-surface-300 rounded w-16" />
                </div>
              ))
            : kpiMetrics.map((k, i) => (
                <KPICard key={i} metric={k.metric} icon={k.icon} />
              ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Revenue vs Expenses */}
          <div className="card p-4 col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Revenue vs Expenses</h3>
                <p className="text-xs text-gray-500 mt-0.5">Last 6 months</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-brand-500 inline-block" /> Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-surface-400 inline-block" /> Expenses
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mockMonthlyRevenue}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6471f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6471f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e4e8f0" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#e4e8f0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, border: "1px solid #e4e8f0", borderRadius: 8 }} />
                <Area type="monotone" dataKey="revenue" stroke="#6471f1" strokeWidth={2} fill="url(#revenueGrad)" />
                <Area type="monotone" dataKey="expenses" stroke="#c8d0e0" strokeWidth={2} fill="url(#expensesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Module Activity */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Module Activity</h3>
            <p className="text-xs text-gray-500 mb-4">Transaction share %</p>
            <div className="flex justify-center mb-3">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={mockModuleActivity} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {mockModuleActivity.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {mockModuleActivity.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: COLORS[i] }} />
                    <span className="text-gray-600">{item.name}</span>
                  </span>
                  <span className="font-medium text-gray-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Monthly PO Bar Chart */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Purchase Orders</h3>
            <p className="text-xs text-gray-500 mb-4">Monthly volume</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={mockMonthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, border: "1px solid #e4e8f0", borderRadius: 8 }} />
                <Bar dataKey="expenses" fill="#e0e9ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Activity */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
                <p className="text-xs text-gray-500 mt-0.5">System-wide events</p>
              </div>
              <button className="text-xs text-brand-600 hover:text-brand-700 font-medium">View all</button>
            </div>
            <div className="space-y-3">
              {mockRecentActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${item.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{item.desc}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  );
}
