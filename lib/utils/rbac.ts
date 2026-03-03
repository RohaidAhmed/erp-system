import type { UserRole } from "@/types";

type Permission = "view" | "create" | "edit" | "delete" | "approve" | "full";
type Module = "finance" | "hr" | "inventory" | "procurement" | "sales" | "production" | "reporting";

const RBAC: Record<UserRole, Partial<Record<Module, Permission[]>>> = {
  super_admin: {
    finance: ["full"], hr: ["full"], inventory: ["full"],
    procurement: ["full"], sales: ["full"], production: ["full"], reporting: ["full"],
  },
  finance_manager: {
    finance: ["full"], hr: ["view"], inventory: ["view"],
    procurement: ["view", "approve"], sales: ["view"], production: ["view"], reporting: ["full"],
  },
  hr_manager: {
    finance: ["view"], hr: ["full"], inventory: [],
    procurement: [], sales: [], production: [], reporting: ["view"],
  },
  inventory_manager: {
    finance: [], hr: [], inventory: ["full"],
    procurement: ["view"], sales: ["view"], production: ["view"], reporting: ["view"],
  },
  procurement_officer: {
    finance: [], hr: [], inventory: ["view"],
    procurement: ["full"], sales: [], production: [], reporting: ["view"],
  },
  sales_executive: {
    finance: [], hr: [], inventory: ["view"],
    procurement: [], sales: ["full"], production: [], reporting: ["view"],
  },
  production_manager: {
    finance: [], hr: [], inventory: ["view"],
    procurement: ["view"], sales: ["view"], production: ["full"], reporting: ["view"],
  },
  viewer: {
    finance: ["view"], hr: [], inventory: ["view"],
    procurement: ["view"], sales: ["view"], production: ["view"], reporting: ["view"],
  },
};

export function hasPermission(
  role: UserRole,
  module: Module,
  permission: Permission
): boolean {
  const perms = RBAC[role]?.[module] || [];
  return perms.includes("full") || perms.includes(permission);
}

export function canView(role: UserRole, module: Module): boolean {
  return hasPermission(role, module, "view") || hasPermission(role, module, "full");
}

export function canCreate(role: UserRole, module: Module): boolean {
  return hasPermission(role, module, "create") || hasPermission(role, module, "full");
}

export function canApprove(role: UserRole, module: Module): boolean {
  return hasPermission(role, module, "approve") || hasPermission(role, module, "full");
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    super_admin: "Super Admin",
    finance_manager: "Finance Manager",
    hr_manager: "HR Manager",
    inventory_manager: "Inventory Manager",
    procurement_officer: "Procurement Officer",
    sales_executive: "Sales Executive",
    production_manager: "Production Manager",
    viewer: "Viewer",
  };
  return labels[role] || role;
}
