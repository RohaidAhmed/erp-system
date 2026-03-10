"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  DollarSign, Users, Package, ShoppingCart, TrendingUp, Factory,
  FileText, BarChart3, RefreshCw, AlertTriangle,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { KPICard, PageWrapper, formatCurrency } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { clsx } from "clsx";

const COLORS = ["#6471f1", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#2dd4bf"];

const tooltipStyle = {
  fontSize: 12, border: "1px solid #e4e8f0", borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,.06)",
};
const axisProps = { tick: { fontSize: 11, fill: "#94a3b8" }, tickLine: false, axisLine: false };

function KpiSkeleton() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="h-3 bg-surface-300 rounded w-24 mb-3" />
      <div className="h-7 bg-surface-300 rounded w-16 mb-2" />
      <div className="h-2.5 bg-surface-200 rounded w-20" />
    </div>
  );
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <div className="animate-pulse bg-surface-100 rounded-lg" style={{ height }} />;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/reporting")
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const stats = data?.stats;
  const kpiMetrics = stats ? [
    { metric: stats.revenue, icon: DollarSign },
    { metric: stats.open_invoices, icon: FileText },
    { metric: stats.active_employees, icon: Users },
    { metric: stats.inventory_value, icon: Package },
    { metric: stats.open_purchase_orders, icon: ShoppingCart },
    { metric: stats.sales_pipeline, icon: TrendingUp },
    { metric: stats.production_orders, icon: Factory },
    { metric: { label: "Modules Active", value: 7, trend: "flat" as const }, icon: BarChart3 },
  ] : [];

  const monthly = data?.monthly_revenue || [];
  const moduleAct = data?.module_activity || [];
  const activity = data?.recent_activity || [];
  const lowStock = data?.low_stock || [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`${greeting()}${user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""} — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
        actions={
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        }
      />
      <PageWrapper>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)
            : kpiMetrics.map((k, i) => <KPICard key={i} metric={k.metric} icon={k.icon} />)}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-4 mb-6">

          {/* Revenue vs Expenses area chart */}
          <div className="card p-4 col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Revenue vs Expenses</h3>
                <p className="text-xs text-gray-500 mt-0.5">Last 6 months</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500 inline-block" /> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-surface-400 inline-block" /> Expenses</span>
              </div>
            </div>
            {loading ? <ChartSkeleton /> : monthly.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-xs text-gray-400">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthly}>
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
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="revenue" stroke="#6471f1" strokeWidth={2} fill="url(#revenueGrad)" />
                  <Area type="monotone" dataKey="expenses" stroke="#c8d0e0" strokeWidth={2} fill="url(#expensesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Module Activity donut */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Module Activity</h3>
            <p className="text-xs text-gray-500 mb-4">Transaction share</p>
            {loading ? <ChartSkeleton height={200} /> : moduleAct.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-xs text-gray-400">No data yet</div>
            ) : (
              <>
                <div className="flex justify-center mb-3">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={moduleAct} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {moduleAct.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {moduleAct.map((item: any, i: number) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm inline-block" style={{ background: COLORS[i] }} />
                        <span className="text-gray-600">{item.name}</span>
                      </span>
                      <span className="font-medium text-gray-900">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-4">

          {/* Monthly revenue bar + low stock */}
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Monthly Revenue</h3>
              <p className="text-xs text-gray-500 mb-4">Collected (paid invoices)</p>
              {loading ? <ChartSkeleton height={160} /> : monthly.length === 0 ? (
                <div className="flex items-center justify-center h-[160px] text-xs text-gray-400">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
                    <XAxis dataKey="month" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                    <Bar dataKey="revenue" fill="#6471f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Low stock alerts */}
            {!loading && lowStock.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Low Stock Alerts</h3>
                  <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{lowStock.length}</span>
                </div>
                <div className="space-y-2">
                  {lowStock.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-brand-700 w-20 flex-shrink-0 truncate">{p.sku}</span>
                      <span className="flex-1 text-gray-700 truncate">{p.name}</span>
                      <span className={clsx("font-bold tabular-nums flex-shrink-0", p.quantity_on_hand <= 0 ? "text-red-600" : "text-amber-600")}>
                        {p.quantity_on_hand} / {p.reorder_point}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
                <p className="text-xs text-gray-500 mt-0.5">Latest records across all modules</p>
              </div>
            </div>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-300 mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-3 bg-surface-300 rounded w-3/4 mb-1.5" />
                      <div className="h-2.5 bg-surface-200 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-gray-400">No activity yet</div>
            ) : (
              <div className="space-y-3.5">
                {activity.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <span className={clsx("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", item.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed truncate">{item.desc}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </PageWrapper>
    </>
  );
}