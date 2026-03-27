"use client";

import { clsx } from "clsx";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KPIMetric } from "@/types";

// ---- Badge -----------------------------------------------
const badgeVariants: Record<string, string> = {
  // Finance
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-600",
  posted: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  void: "bg-gray-100 text-gray-500",
  // HR
  active: "bg-green-100 text-green-700",
  on_leave: "bg-blue-100 text-blue-700",
  terminated: "bg-red-100 text-red-600",
  rejected: "bg-red-100 text-red-600",
  disbursed: "bg-emerald-100 text-emerald-700",
  // Inventory
  inbound: "bg-green-100 text-green-700",
  outbound: "bg-orange-100 text-orange-700",
  transfer: "bg-blue-100 text-blue-700",
  adjustment: "bg-purple-100 text-purple-700",
  // Procurement/Sales
  pending_approval: "bg-yellow-100 text-yellow-700",
  ordered: "bg-blue-100 text-blue-700",
  received: "bg-emerald-100 text-emerald-700",
  confirmed: "bg-blue-100 text-blue-700",
  picking: "bg-purple-100 text-purple-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  // Production
  planned: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  on_hold: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  // Customers
  standard: "bg-gray-100 text-gray-600",
  silver: "bg-slate-100 text-slate-600",
  gold: "bg-yellow-100 text-yellow-700",
  platinum: "bg-purple-100 text-purple-700",
  // Quotes
  expired: "bg-red-100 text-red-600",
  accepted: "bg-green-100 text-green-700",
};

interface BadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: BadgeProps) {
  const cls = badgeVariants[status] || "bg-gray-100 text-gray-600";
  const display = label || status.replace(/_/g, " ");
  return (
    <span className={clsx("badge capitalize", cls)}>
      {display}
    </span>
  );
}

// ---- KPI Card --------------------------------------------
interface KPICardProps {
  metric: KPIMetric;
  icon?: React.ElementType;
  iconColor?: string;
}

export function KPICard({ metric, icon: Icon, iconColor = "text-brand-600" }: KPICardProps) {
  const TrendIcon = metric.trend === "up" ? TrendingUp : metric.trend === "down" ? TrendingDown : Minus;
  const trendColor = metric.trend === "up" ? "text-emerald-600" : metric.trend === "down" ? "text-red-500" : "text-gray-400";

  const formattedValue = typeof metric.value === "number"
    ? metric.value >= 1000000
      ? `${(metric.value / 1000000).toFixed(1)}M`
      : metric.value >= 1000
      ? `${(metric.value / 1000).toFixed(1)}K`
      : metric.value.toLocaleString()
    : metric.value;

  return (
    <div className="card p-4 hover:shadow-card-hover transition-shadow duration-150">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{metric.label}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900 leading-none">
            {metric.prefix}{formattedValue}{metric.suffix}
          </p>
          {metric.change !== undefined && (
            <div className={clsx("flex items-center gap-1 mt-2 text-xs font-medium", trendColor)}>
              <TrendIcon className="w-3 h-3" />
              <span>{Math.abs(metric.change)}% vs last period</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={clsx("p-2 rounded-lg bg-brand-50", iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Empty State -----------------------------------------
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-200 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-xs text-gray-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---- Loading Skeleton ------------------------------------
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-6 py-3.5 border-b border-surface-200 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 bg-surface-300 rounded flex-1" style={{ maxWidth: c === 0 ? 80 : undefined }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- Page Wrapper ----------------------------------------
interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}
export function PageWrapper({ children, className }: PageWrapperProps) {
  return <div className={clsx("p-6 page-enter", className)}>{children}</div>;
}

// ---- Section Title ---------------------------------------
export function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {count !== undefined && (
        <span className="text-xs font-medium text-gray-500 bg-surface-200 px-2 py-0.5 rounded-full">
          {count.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// ---- Currency Formatter ----------------------------------
export function formatCurrency(amount: number, currency = "PKR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}
