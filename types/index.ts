// ============================================================
// ERP System — TypeScript Types
// ============================================================

// ---- Common ------------------------------------------------
export type UUID = string;
export type ISO8601 = string;
export type Currency = "USD" | "EUR" | "GBP" | "PKR" | "AED";

export interface AuditFields {
  created_at: ISO8601;
  updated_at: ISO8601;
  created_by?: UUID;
  updated_by?: UUID;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
  pagination?: Pagination;
  errors?: FieldError[];
  timestamp: ISO8601;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface FieldError {
  field: string;
  message: string;
}

// ---- Auth & RBAC ------------------------------------------
export type UserRole =
  | "super_admin"
  | "finance_manager"
  | "hr_manager"
  | "inventory_manager"
  | "procurement_officer"
  | "sales_executive"
  | "production_manager"
  | "viewer"
  | "employee";

export interface User extends AuditFields {
  id: UUID;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  last_login?: ISO8601;
}

export interface AuthSession {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// ---- Finance Module ----------------------------------------
export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type TransactionType = "debit" | "credit";
export type TransactionStatus = "pending" | "posted" | "void";
export type InvoiceStatus = "draft" | "sent" | "approved" | "paid" | "overdue" | "cancelled";

export interface Account extends AuditFields {
  id: UUID;
  account_code: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  is_active: boolean;
  parent_id?: UUID;
  description?: string;
}

export interface Transaction extends AuditFields {
  id: UUID;
  account_id: UUID;
  invoice_id?: UUID;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  date: ISO8601;
  reference: string;
  description?: string;
  account?: Account;
}

export interface Invoice extends AuditFields {
  id: UUID;
  invoice_number: string;
  customer_id?: UUID;
  supplier_id?: UUID;
  type: "accounts_receivable" | "accounts_payable";
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: Currency;
  status: InvoiceStatus;
  issue_date: ISO8601;
  due_date: ISO8601;
  paid_date?: ISO8601;
  notes?: string;
  customer?: Customer;
}

// ---- HR Module ---------------------------------------------
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type EmployeeStatus = "active" | "on_leave" | "terminated";
export type LeaveType = "annual" | "sick" | "maternity" | "paternity" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface Department {
  id: UUID;
  name: string;
  head_id?: UUID;
  parent_id?: UUID;
}

export interface Employee extends AuditFields {
  id: UUID;
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string;
  department_id: UUID;
  position: string;
  employment_type: EmploymentType;
  status: EmployeeStatus;
  salary: number;
  currency: Currency;
  hire_date: ISO8601;
  manager_id?: UUID;
  department?: Department;
  manager?: Pick<Employee, "id" | "full_name" | "position">;
}

export interface Payroll extends AuditFields {
  id: UUID;
  employee_id: UUID;
  period_start: ISO8601;
  period_end: ISO8601;
  gross_salary: number;
  deductions: number;
  tax_amount: number;
  net_salary: number;
  currency: Currency;
  status: "draft" | "approved" | "disbursed" | "voided";
  disbursed_at?: ISO8601;
  employee?: Pick<Employee, "id" | "full_name" | "employee_code">;
}

export interface LeaveRequest extends AuditFields {
  id: UUID;
  employee_id: UUID;
  leave_type: LeaveType;
  start_date: ISO8601;
  end_date: ISO8601;
  days_count: number;
  reason: string;
  status: LeaveStatus;
  approved_by?: UUID;
  approved_at?: ISO8601;
  employees?: {
    id: UUID;
    full_name: string;
    employee_code: string;
    department_id: UUID;
    departments?: {
      name: string;
    };
  };
}


// export interface LeaveRequest extends AuditFields {
//   id: UUID;
//   employee_id: UUID;
//   leave_type: LeaveType;
//   start_date: ISO8601;
//   end_date: ISO8601;
//   days_count: number;
//   reason: string;
//   status: LeaveStatus;
//   approved_by?: UUID;
//   approved_at?: ISO8601;
//   employee?: Pick<Employee, "id" | "full_name" | "department_id" | "employee_code"> & {
//     departments?: Pick<Department, "name">;
//   };
// }

// ---- Inventory Module --------------------------------------
export type StockMovementType = "inbound" | "outbound" | "transfer" | "adjustment";

export interface Product extends AuditFields {
  id: UUID;
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit_of_measure: string;
  unit_cost: number;
  unit_price: number;
  quantity_on_hand: number;
  reorder_point: number;
  reorder_quantity: number;
  is_active: boolean;
}

export interface Warehouse extends AuditFields {
  id: UUID;
  code: string;
  name: string;
  location: string;
  capacity: number;
  manager_id?: UUID;
  is_active: boolean;
}

export interface StockMovement extends AuditFields {
  id: UUID;
  product_id: UUID;
  warehouse_id: UUID;
  type: StockMovementType;
  quantity: number;
  reference: string;
  notes?: string;
  product?: Pick<Product, "id" | "sku" | "name">;
  warehouse?: Pick<Warehouse, "id" | "name">;
}

// ---- Procurement Module ------------------------------------
export type POStatus = "draft" | "pending_approval" | "approved" | "ordered" | "received" | "cancelled";

export interface Supplier extends AuditFields {
  id: UUID;
  code: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  payment_terms: number; // days
  currency: Currency;
  is_active: boolean;
  performance_rating?: number;
}

export interface PurchaseOrderItem {
  id: UUID;
  po_id: UUID;
  product_id: UUID;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  received_quantity: number;
  product?: Pick<Product, "id" | "sku" | "name" | "unit_of_measure">;
}

export interface PurchaseOrder extends AuditFields {
  id: UUID;
  po_number: string;
  supplier_id: UUID;
  status: POStatus;
  order_date: ISO8601;
  expected_date: ISO8601;
  total_amount: number;
  currency: Currency;
  notes?: string;
  approved_by?: UUID;
  approved_at?: ISO8601;
  supplier?: Pick<Supplier, "id" | "name" | "code">;
  items?: PurchaseOrderItem[];
}

// ---- Sales & CRM Module ------------------------------------
export type SOStatus = "draft" | "confirmed" | "picking" | "shipped" | "delivered" | "cancelled";
export type CustomerTier = "standard" | "silver" | "gold" | "platinum";

export interface Customer extends AuditFields {
  id: UUID;
  customer_code: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  tier: CustomerTier;
  credit_limit: number;
  currency: Currency;
  is_active: boolean;
}

export interface SalesOrderItem {
  id: UUID;
  so_id: UUID;
  product_id: UUID;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  total_price: number;
  product?: Pick<Product, "id" | "sku" | "name">;
}

export interface SalesOrder extends AuditFields {
  id: UUID;
  so_number: string;
  customer_id: UUID;
  status: SOStatus;
  order_date: ISO8601;
  delivery_date?: ISO8601;
  total_amount: number;
  currency: Currency;
  notes?: string;
  customer?: Pick<Customer, "id" | "name" | "customer_code">;
  items?: SalesOrderItem[];
}

export interface Quote extends AuditFields {
  id: UUID;
  quote_number: string;
  customer_id: UUID;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  valid_until: ISO8601;
  total_amount: number;
  currency: Currency;
  version: number;
  customer?: Pick<Customer, "id" | "name">;
}

// ---- Production Module -------------------------------------
export type WOStatus = "planned" | "in_progress" | "on_hold" | "completed" | "cancelled";

export interface BOMItem {
  id: UUID;
  bom_id: UUID;
  component_id: UUID;
  quantity: number;
  unit_of_measure: string;
  component?: Pick<Product, "id" | "sku" | "name">;
}

export interface BillOfMaterials extends AuditFields {
  id: UUID;
  product_id: UUID;
  version: string;
  is_active: boolean;
  items?: BOMItem[];
  product?: Pick<Product, "id" | "sku" | "name">;
}

export interface WorkOrder extends AuditFields {
  id: UUID;
  wo_number: string;
  product_id: UUID;
  bom_id: UUID;
  quantity: number;
  status: WOStatus;
  planned_start: ISO8601;
  planned_end: ISO8601;
  actual_start?: ISO8601;
  actual_end?: ISO8601;
  notes?: string;
  product?: Pick<Product, "id" | "sku" | "name">;
}

// ---- Reporting ---------------------------------------------
export interface KPIMetric {
  label: string;
  value: number | string;
  change?: number; // percentage change
  trend?: "up" | "down" | "flat";
  prefix?: string;
  suffix?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

export interface DashboardStats {
  revenue: KPIMetric;
  expenses: KPIMetric;
  open_invoices: KPIMetric;
  active_employees: KPIMetric;
  inventory_value: KPIMetric;
  open_purchase_orders: KPIMetric;
  sales_pipeline: KPIMetric;
  production_orders: KPIMetric;
}
