"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { RefreshCw, TrendingUp, TrendingDown, Minus, DollarSign, Users, Package, ShoppingCart, Factory, AlertTriangle } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, formatCurrency } from "@/components/ui";
import { clsx } from "clsx";

const COLORS = {
  brand: "#6471f1", emerald: "#34d399", amber: "#fbbf24",
  red: "#f87171", blue: "#60a5fa", purple: "#a78bfa", slate: "#94a3b8", teal: "#2dd4bf",
};
const PIE_PALETTE = [COLORS.brand, COLORS.emerald, COLORS.amber, COLORS.blue, COLORS.purple, COLORS.teal, COLORS.red, COLORS.slate];
const TABS = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "finance", label: "Finance", icon: DollarSign },
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "hr", label: "HR", icon: Users },
  { id: "production", label: "Production", icon: Factory },
] as const;
type TabId = typeof TABS[number]["id"];

const tooltipStyle = { fontSize: 11, border: "1px solid #e4e8f0", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,.08)" };
const axisProps = { tick: { fontSize: 11, fill: "#94a3b8" }, tickLine: false, axisLine: false };

function SectionCard({ title, subtitle, children, className }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={clsx("card p-5", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function KPI({ label, value, sub, trend, prefix, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  trend?: "up" | "down" | "flat"; prefix?: string; icon?: any; color?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-gray-400";
  const display = prefix === "$" && typeof value === "number" ? formatCurrency(value) : `${prefix || ""}${value}`;
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        {Icon && <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center", color || "bg-brand-50")}><Icon className="w-3.5 h-3.5 text-brand-600" /></div>}
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{display}</p>
      {sub && (
        <div className="flex items-center gap-1">
          <TrendIcon className={clsx("w-3 h-3", trendColor)} />
          <p className="text-xs text-gray-500">{sub}</p>
        </div>
      )}
    </div>
  );
}

function LoadingChart({ height = 220 }: { height?: number }) {
  return <div className="flex items-center justify-center bg-surface-100 rounded-lg animate-pulse" style={{ height }}><p className="text-xs text-gray-400">Loading…</p></div>;
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
function OverviewTab({ overview, finance, sales, inventory }: { overview: any; finance: any; sales: any; inventory: any }) {
  const s = overview?.stats || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Revenue" value={s.revenue?.value ?? 0} prefix="$" trend="up" icon={DollarSign} color="bg-emerald-50" />
        <KPI label="Open AR Invoices" value={s.open_invoices?.value ?? 0} prefix="$" trend="flat" icon={DollarSign} color="bg-amber-50" />
        <KPI label="Active Employees" value={s.active_employees?.value ?? 0} trend="up" icon={Users} color="bg-blue-50" />
        <KPI label="Inventory Value" value={s.inventory_value?.value ?? 0} prefix="$" trend="flat" icon={Package} color="bg-purple-50" />
        <KPI label="Open Purchase Orders" value={s.open_purchase_orders?.value ?? 0} trend="flat" icon={ShoppingCart} color="bg-teal-50" />
        <KPI label="Open Sales Orders" value={s.sales_pipeline?.value ?? 0} trend="up" icon={ShoppingCart} color="bg-brand-50" />
        <KPI label="Active Work Orders" value={s.production_orders?.value ?? 0} trend="flat" icon={Factory} color="bg-rose-50" />
        <KPI label="Low Stock Items" value={inventory?.summary?.low_stock_count ?? 0}
          trend={inventory?.summary?.low_stock_count > 0 ? "down" : "flat"} icon={AlertTriangle} color="bg-orange-50" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="P&L Overview" subtitle="Revenue vs Expenses (last 6 months)">
          {finance?.monthly ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={finance.monthly} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill={COLORS.brand} radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#e0e9ff" radius={[3, 3, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill={COLORS.emerald} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <LoadingChart />}
        </SectionCard>

        <SectionCard title="Sales Order Value Trend" subtitle="Monthly SO value">
          {sales?.monthly_trend ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sales.monthly_trend}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.brand} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="value" name="Order Value" stroke={COLORS.brand} strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <LoadingChart />}
        </SectionCard>
      </div>

      {(inventory?.low_stock_items?.length ?? 0) > 0 && (
        <SectionCard title="Low Stock Alerts" subtitle={`${inventory.low_stock_items.length} items at or below reorder point`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-200">
                  {["SKU", "Name", "Category", "On Hand", "Reorder Point"].map((h) => (
                    <th key={h} className="text-left pb-2 font-medium text-gray-500 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.low_stock_items.slice(0, 8).map((p: any) => (
                  <tr key={p.id} className="border-b border-surface-100 last:border-0">
                    <td className="py-2 font-mono text-brand-700 pr-4">{p.sku}</td>
                    <td className="py-2 font-medium text-gray-800 pr-4">{p.name}</td>
                    <td className="py-2 text-gray-500 pr-4">{p.category}</td>
                    <td className={clsx("py-2 tabular-nums font-bold pr-4", p.quantity_on_hand <= 0 ? "text-red-600" : "text-amber-600")}>{p.quantity_on_hand}</td>
                    <td className="py-2 tabular-nums text-gray-500">{p.reorder_point}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Finance Tab ────────────────────────────────────────────────────────────────
function FinanceTab({ data }: { data: any }) {
  if (!data) return <LoadingChart height={400} />;
  const s = data.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Revenue" value={s.revenue || 0} prefix="$" trend="up" />
        <KPI label="Expenses" value={s.expenses || 0} prefix="$" trend="down" />
        <KPI label="Net Profit" value={s.profit || 0} prefix="$" trend={s.profit >= 0 ? "up" : "down"} />
        <KPI label="Total AR" value={s.total_ar || 0} prefix="$" trend="flat" />
        <KPI label="Total AP" value={s.total_ap || 0} prefix="$" trend="flat" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Monthly P&L" subtitle="Revenue, Expenses & Profit">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.monthly || []} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenue" name="Revenue" fill={COLORS.brand} radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill={COLORS.red} radius={[3, 3, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill={COLORS.emerald} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="AR Aging" subtitle="Outstanding receivables by age">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={[
              { label: "Current", amount: data.aging?.current || 0 },
              { label: "1–30 days", amount: data.aging?.days_30 || 0 },
              { label: "31–60 days", amount: data.aging?.days_60 || 0 },
              { label: "60+ days", amount: data.aging?.days_90_plus || 0 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
              <YAxis type="category" dataKey="label" {...axisProps} width={72} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="amount" name="Amount" fill={COLORS.amber} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Expenses by Category" className="col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={data.expenses_by_category || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
              <YAxis type="category" dataKey="category" {...axisProps} width={120} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="amount" name="Amount" fill={COLORS.brand} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Sales Tab ──────────────────────────────────────────────────────────────────
function SalesTab({ data }: { data: any }) {
  if (!data) return <LoadingChart height={400} />;
  const s = data.summary || {};
  const STATUS_COLORS_MAP: Record<string, string> = {
    draft: "#94a3b8", confirmed: "#60a5fa", picking: "#fbbf24",
    shipped: "#a78bfa", delivered: "#34d399", cancelled: "#f87171",
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Total Revenue" value={s.total_revenue || 0} prefix="$" trend="up" />
        <KPI label="Open Orders" value={s.open_orders || 0} trend="flat" />
        <KPI label="Active Customers" value={s.total_customers || 0} trend="up" />
        <KPI label="Quote Conversion" value={`${s.quote_conversion_pct || 0}%`} trend={s.quote_conversion_pct > 50 ? "up" : "down"} />
        <KPI label="Open Quotes" value={s.open_quotes || 0} trend="flat" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SectionCard title="Order Value Trend" subtitle="Monthly SO value" className="col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.monthly_trend || []}>
              <defs>
                <linearGradient id="soGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.brand} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="value" name="Order Value" stroke={COLORS.brand} strokeWidth={2} fill="url(#soGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Pipeline by Status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.pipeline || []} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={80}
                label={({ status, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {(data.pipeline || []).map((entry: any) => (
                  <Cell key={entry.status} fill={STATUS_COLORS_MAP[entry.status] || COLORS.slate} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Top Customers" subtitle="By total order value">
          <div className="space-y-2.5">
            {(data.top_customers || []).map((c: any, i: number) => (
              <div key={c.code} className="flex items-center gap-3">
                <span className="w-5 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{c.name}</p>
                  <div className="mt-0.5 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(100, (c.value / (data.top_customers[0]?.value || 1)) * 100)}%`,
                      background: PIE_PALETTE[i % PIE_PALETTE.length],
                    }} />
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums text-gray-700 flex-shrink-0">{formatCurrency(c.value)}</span>
              </div>
            ))}
            {!data.top_customers?.length && <p className="text-xs text-gray-400 text-center py-4">No data yet</p>}
          </div>
        </SectionCard>

        <SectionCard title="Top Products by Revenue">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={(data.top_products || []).slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
              <YAxis type="category" dataKey="name" {...axisProps} width={90}
                tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" name="Revenue" fill={COLORS.emerald} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Inventory Tab ──────────────────────────────────────────────────────────────
function InventoryTab({ data }: { data: any }) {
  if (!data) return <LoadingChart height={400} />;
  const s = data.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Stock Value" value={s.total_value || 0} prefix="$" trend="flat" />
        <KPI label="Active Products" value={s.active_products || 0} trend="flat" />
        <KPI label="Low Stock Items" value={s.low_stock_count || 0} trend={s.low_stock_count > 0 ? "down" : "flat"} />
        <KPI label="Zero Stock Items" value={s.zero_stock_count || 0} trend={s.zero_stock_count > 0 ? "down" : "flat"} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Stock Movement Trend" subtitle="Inbound vs Outbound">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.movement_trend || []} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="in" name="Inbound" fill={COLORS.emerald} radius={[3, 3, 0, 0]} />
              <Bar dataKey="out" name="Outbound" fill={COLORS.red} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Stock Value by Category">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.by_category || []} dataKey="value" nameKey="category"
                cx="50%" cy="50%" outerRadius={80}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {(data.by_category || []).map((_: any, i: number) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v: string) => v.length > 16 ? v.slice(0, 15) + "…" : v} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Top Products by Stock Value">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={(data.top_by_value || []).slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
              <YAxis type="category" dataKey="name" {...axisProps} width={90}
                tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Stock Value" fill={COLORS.brand} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Top Movers" subtitle="Highest outbound volume">
          <div className="space-y-2.5">
            {(data.top_movers || []).map((p: any, i: number) => (
              <div key={p.sku} className="flex items-center gap-3">
                <span className="w-5 text-xs text-gray-400">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                </div>
                <span className="text-xs font-bold tabular-nums text-gray-700">{p.total.toLocaleString()} units</span>
              </div>
            ))}
            {!data.top_movers?.length && <p className="text-xs text-gray-400 text-center py-4">No movement data yet</p>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── HR Tab ─────────────────────────────────────────────────────────────────────
function HRTab({ data }: { data: any }) {
  if (!data) return <LoadingChart height={400} />;
  const s = data.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI label="Active Employees" value={s.active_employees || 0} trend="flat" />
        <KPI label="On Leave" value={s.on_leave || 0} trend="flat" />
        <KPI label="Pending Leaves" value={s.pending_leaves || 0} trend={s.pending_leaves > 0 ? "down" : "flat"} />
        <KPI label="Payroll (3 months)" value={s.total_payroll_3m || 0} prefix="$" trend="flat" />
        <KPI label="Avg Monthly Payroll" value={s.avg_monthly_payroll || 0} prefix="$" trend="flat" />
        <KPI label="Total Headcount" value={s.total_employees || 0} trend="flat" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="Headcount by Department">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart layout="vertical" data={(data.by_department || []).slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="name" {...axisProps} width={120} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Headcount" fill={COLORS.blue} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Monthly Payroll Trend">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.payroll_trend || []}>
              <defs>
                <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `$${v / 1000}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="amount" name="Payroll" stroke={COLORS.purple} strokeWidth={2} fill="url(#payGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Employee Tenure">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.tenure_buckets || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Employees" fill={COLORS.teal} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Leave by Type">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.leave_by_type || []} dataKey="count" nameKey="type"
                cx="50%" cy="50%" outerRadius={70}
                label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                labelLine={false} fontSize={10}>
                {(data.leave_by_type || []).map((_: any, i: number) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Production Tab ─────────────────────────────────────────────────────────────
function ProductionTab({ overview }: { overview: any }) {
  const woCount = overview?.stats?.production_orders?.value ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Active Work Orders" value={woCount} trend="flat" icon={Factory} />
        <KPI label="BOMs Defined" value="—" trend="flat" />
        <KPI label="Completion Rate" value="—" trend="flat" />
      </div>
      <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
        <Factory className="w-10 h-10 text-gray-300" />
        <div>
          <p className="text-sm font-medium text-gray-600">Detailed Production Analytics</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">Work order throughput, BOM efficiency, scrap rates, and OEE metrics — coming in the next release.</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ReportingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, financeRes, salesRes, inventoryRes, hrRes] = await Promise.all([
        fetch("/api/reporting").then((r) => r.json()),
        fetch("/api/reporting/finance?months=6").then((r) => r.json()),
        fetch("/api/reporting/sales?months=6").then((r) => r.json()),
        fetch("/api/reporting/inventory?months=3").then((r) => r.json()),
        fetch("/api/reporting/hr").then((r) => r.json()),
      ]);
      setData({
        overview: overviewRes.success ? overviewRes.data : null,
        finance: financeRes.success ? financeRes.data : null,
        sales: salesRes.success ? salesRes.data : null,
        inventory: inventoryRes.success ? inventoryRes.data : null,
        hr: hrRes.success ? hrRes.data : null,
      });
    } catch (e) { console.error("Reporting load error:", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <Header title="Reporting & Analytics" subtitle="Business Intelligence Dashboard"
        actions={
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        }
      />
      <PageWrapper>
        {/* Tab nav */}
        <div className="flex items-center gap-1 mb-5 p-1 bg-surface-100 border border-surface-300 rounded-xl w-fit">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white shadow-sm text-gray-900 border border-surface-300"
                  : "text-gray-500 hover:text-gray-700"
              )}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card p-4 h-24 animate-pulse bg-surface-100" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab overview={data.overview} finance={data.finance} sales={data.sales} inventory={data.inventory} />}
            {activeTab === "finance" && <FinanceTab data={data.finance} />}
            {activeTab === "sales" && <SalesTab data={data.sales} />}
            {activeTab === "inventory" && <InventoryTab data={data.inventory} />}
            {activeTab === "hr" && <HRTab data={data.hr} />}
            {activeTab === "production" && <ProductionTab overview={data.overview} />}
          </>
        )}
      </PageWrapper>
    </>
  );
}