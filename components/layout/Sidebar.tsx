"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, DollarSign, Users, Package, ShoppingCart,
  TrendingUp, Cog, BarChart3, ChevronRight, Building2, LogOut,
  FileText, Truck, UserCircle, Factory, ClipboardList, Settings,
  Clock, Calendar, Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { getRoleLabel } from "@/lib/utils/rbac";

// ── Navigation definitions ────────────────────────────────────────────────────

/** Full nav for managers / admins / standard roles */
const FULL_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Finance", icon: DollarSign,
    children: [
      { label: "Accounts", href: "/finance/accounts", icon: FileText },
      { label: "Transactions", href: "/finance/transactions", icon: TrendingUp },
      { label: "Invoices", href: "/finance/invoices", icon: ClipboardList },
    ],
  },
  {
    label: "Human Resources", icon: Users,
    children: [
      { label: "Employees", href: "/hr/employees", icon: UserCircle },
      {label: "Attendance", href: "/hr/attendance", icon: UserCircle},
      { label: "Payroll", href: "/hr/payroll", icon: DollarSign },
      { label: "Leave", href: "/hr/leave", icon: Calendar },
      { label: "Attendance", href: "/hr/attendance", icon: Clock },
    ],
  },
  {
    label: "Inventory", icon: Package,
    children: [
      { label: "Products", href: "/inventory/products", icon: Package },
      { label: "Warehouses", href: "/inventory/warehouses", icon: Building2 },
    ],
  },
  {
    label: "Procurement", icon: Truck,
    children: [
      { label: "Purchase Orders", href: "/procurement/purchase-orders", icon: ShoppingCart },
      { label: "Suppliers", href: "/procurement/suppliers", icon: Building2 },
    ],
  },
  {
    label: "Sales & CRM", icon: TrendingUp,
    children: [
      { label: "Sales Orders", href: "/sales/orders", icon: ClipboardList },
      { label: "Customers", href: "/sales/customers", icon: Users },
      { label: "Quotes", href: "/sales/quotes", icon: FileText },
    ],
  },
  {
    label: "Production", icon: Factory,
    children: [
      { label: "Work Orders", href: "/production/work-orders", icon: Cog },
      { label: "Bill of Materials", href: "/production/bom", icon: ClipboardList },
    ],
  },
  { label: "Reporting", href: "/reporting", icon: BarChart3 },
  {
    label: "Settings", icon: Settings,
    children: [
      { label: "Users & Roles", href: "/settings/users", icon: Users },
    ],
  },
];

/** Restricted nav for the "employee" self-service role */
const EMPLOYEE_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "My HR", icon: Users,
    children: [
      { label: "My Attendance", href: "/hr/attendance", icon: Clock },
      { label: "My Leave", href: "/hr/leave", icon: Calendar },
    ],
  },
];

// ── Nav item renderer ────────────────────────────────────────────────────────

interface NavItem {
  label: string; href?: string; icon: React.ElementType;
  children?: { label: string; href: string; icon: React.ElementType }[];
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const hasActiveChild = item.children?.some((c) => pathname.startsWith(c.href)) ?? false;
  const [open, setOpen] = useState(hasActiveChild);

  if (item.children) {
    return (
      <div>
        <button onClick={() => setOpen((p) => !p)}
          className={clsx("sidebar-link w-full", hasActiveChild && "text-gray-900")}>
          <item.icon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform duration-200", open && "rotate-90")} />
        </button>
        {open && (
          <div className="ml-7 mt-0.5 space-y-0.5 border-l border-surface-300 pl-3">
            {item.children.map((child) => (
              <Link key={child.href} href={child.href}
                className={clsx("sidebar-link text-xs py-1.5", pathname === child.href && "active")}>
                <child.icon className="w-3.5 h-3.5" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={item.href!} className={clsx("sidebar-link", pathname === item.href && "active")}>
      <item.icon className="w-4 h-4 flex-shrink-0" />
      {item.label}
    </Link>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { user, loading, role, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  // Pick nav based on role
  const isEmployee = role === "employee";
  const navItems = isEmployee ? EMPLOYEE_NAV : FULL_NAV;

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-surface-300 flex flex-col h-screen sticky top-0 overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-surface-300 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">E</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">ERP System</p>
            <p className="text-xs text-gray-400 mt-0.5">Management Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink key={item.label} item={item as NavItem} />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-surface-300 px-3 py-3 flex-shrink-0">
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-surface-300 animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-24 bg-surface-300 rounded animate-pulse" />
              <div className="h-2   w-16 bg-surface-300 rounded animate-pulse" />
            </div>
          </div>
        ) : user ? (
          <div>
            {/* Employee role badge */}
            {isEmployee && (
              <div className="mb-2 px-2 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-xs text-brand-700 font-medium">
                Self-Service Portal
              </div>
            )}
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-700">
                {user.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{user.full_name}</p>
                <p className="text-xs text-gray-400 capitalize">{getRoleLabel(role!)}</p>
              </div>
            </div>
            <button onClick={handleSignOut} disabled={signingOut}
              className="mt-1.5 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              {signingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              Sign Out
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}