"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, DollarSign, Users, Package, ShoppingCart,
  TrendingUp, Cog, BarChart3, ChevronRight, Building2, LogOut,
  FileText, Truck, UserCircle, Factory, ClipboardList, Settings,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { getRoleLabel } from "@/lib/utils/rbac";

const navItems = [
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
      { label: "Leave", href: "/hr/leave", icon: ClipboardList },
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

export default function Sidebar() {
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  // Initials avatar
  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside className="w-60 flex-shrink-0 h-screen sticky top-0 flex flex-col bg-white border-r border-surface-300 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-surface-300">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">ERP System</p>
            <p className="text-xs text-gray-500 mt-0.5">v1.0 Enterprise</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => <NavLink key={item.label} item={item as NavItem} />)}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-surface-300">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-xs text-gray-400">Loading…</span>
          </div>
        ) : user ? (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-50 transition-colors group">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
              {user.avatar_url
                ? <img src={user.avatar_url} alt={user.full_name} className="w-7 h-7 rounded-full object-cover" />
                : <span className="text-xs font-bold text-brand-700">{initials}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-400 truncate">{getRoleLabel(user.role as any)}</p>
            </div>
            <button onClick={handleSignOut} disabled={signingOut}
              title="Sign out"
              className="p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50">
              {signingOut
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <LogOut className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <Link href="/auth/login" className="flex items-center gap-2 px-3 py-2 text-xs text-brand-600 hover:text-brand-700">
            <UserCircle className="w-4 h-4" /> Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}