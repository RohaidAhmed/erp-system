-- ============================================================
-- ERP System — Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        TEXT UNIQUE NOT NULL,
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'viewer'
                 CHECK (role IN ('super_admin','finance_manager','hr_manager',
                                 'inventory_manager','procurement_officer',
                                 'sales_executive','production_manager','viewer')),
  avatar_url   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FINANCE MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_code TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  balance      NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'USD',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  parent_id    UUID REFERENCES public.accounts(id),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id   UUID NOT NULL REFERENCES public.accounts(id),
  invoice_id   UUID,
  amount       NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  type         TEXT NOT NULL CHECK (type IN ('debit','credit')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','void')),
  date         DATE NOT NULL,
  reference    TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id    UUID,
  supplier_id    UUID,
  type           TEXT NOT NULL CHECK (type IN ('accounts_receivable','accounts_payable')),
  amount         NUMERIC(18,2) NOT NULL,
  tax_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount   NUMERIC(18,2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'USD',
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','approved','paid','overdue','cancelled')),
  issue_date     DATE NOT NULL,
  due_date       DATE NOT NULL,
  paid_date      DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES public.users(id),
  updated_by     UUID REFERENCES public.users(id)
);

-- ============================================================
-- HR MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      TEXT NOT NULL,
  head_id   UUID,
  parent_id UUID REFERENCES public.departments(id)
);

CREATE TABLE IF NOT EXISTS public.employees (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code    TEXT UNIQUE NOT NULL,
  full_name        TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  phone            TEXT,
  department_id    UUID NOT NULL REFERENCES public.departments(id),
  position         TEXT NOT NULL,
  employment_type  TEXT NOT NULL DEFAULT 'full_time'
                     CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','on_leave','terminated')),
  salary           NUMERIC(18,2) NOT NULL CHECK (salary > 0),
  currency         TEXT NOT NULL DEFAULT 'USD',
  hire_date        DATE NOT NULL,
  manager_id       UUID REFERENCES public.employees(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.payrolls (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES public.employees(id),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  gross_salary  NUMERIC(18,2) NOT NULL,
  deductions    NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_salary    NUMERIC(18,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','disbursed')),
  disbursed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES public.users(id),
  updated_by    UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID NOT NULL REFERENCES public.employees(id),
  leave_type   TEXT NOT NULL CHECK (leave_type IN ('annual','sick','maternity','paternity','unpaid')),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  days_count   INTEGER NOT NULL CHECK (days_count > 0),
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by  UUID REFERENCES public.users(id),
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

-- ============================================================
-- INVENTORY MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku               TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT NOT NULL,
  unit_of_measure   TEXT NOT NULL DEFAULT 'unit',
  unit_cost         NUMERIC(18,2) NOT NULL DEFAULT 0,
  unit_price        NUMERIC(18,2) NOT NULL DEFAULT 0,
  quantity_on_hand  NUMERIC(18,3) NOT NULL DEFAULT 0,
  reorder_point     NUMERIC(18,3) NOT NULL DEFAULT 0,
  reorder_quantity  NUMERIC(18,3) NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES public.users(id),
  updated_by        UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.warehouses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  location    TEXT NOT NULL,
  capacity    NUMERIC(18,2) NOT NULL,
  manager_id  UUID REFERENCES public.employees(id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES public.users(id),
  updated_by  UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES public.products(id),
  warehouse_id  UUID NOT NULL REFERENCES public.warehouses(id),
  type          TEXT NOT NULL CHECK (type IN ('inbound','outbound','transfer','adjustment')),
  quantity      NUMERIC(18,3) NOT NULL,
  reference     TEXT NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES public.users(id),
  updated_by    UUID REFERENCES public.users(id)
);

-- ============================================================
-- PROCUREMENT MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  address             TEXT,
  payment_terms       INTEGER NOT NULL DEFAULT 30,
  currency            TEXT NOT NULL DEFAULT 'USD',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  performance_rating  NUMERIC(3,1) CHECK (performance_rating BETWEEN 0 AND 5),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES public.users(id),
  updated_by          UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number      TEXT UNIQUE NOT NULL,
  supplier_id    UUID NOT NULL REFERENCES public.suppliers(id),
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_approval','approved','ordered','received','cancelled')),
  order_date     DATE NOT NULL,
  expected_date  DATE NOT NULL,
  total_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  notes          TEXT,
  approved_by    UUID REFERENCES public.users(id),
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES public.users(id),
  updated_by     UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id             UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES public.products(id),
  quantity          NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
  unit_cost         NUMERIC(18,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost        NUMERIC(18,2) NOT NULL,
  received_quantity NUMERIC(18,3) NOT NULL DEFAULT 0
);

-- ============================================================
-- SALES & CRM MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code   TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  tier            TEXT NOT NULL DEFAULT 'standard'
                    CHECK (tier IN ('standard','silver','gold','platinum')),
  credit_limit    NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_number      TEXT UNIQUE NOT NULL,
  customer_id    UUID NOT NULL REFERENCES public.customers(id),
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','confirmed','picking','shipped','delivered','cancelled')),
  order_date     DATE NOT NULL,
  delivery_date  DATE,
  total_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES public.users(id),
  updated_by     UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id        UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id),
  quantity     NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(18,2) NOT NULL CHECK (unit_price >= 0),
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  total_price  NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quotes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number  TEXT UNIQUE NOT NULL,
  customer_id   UUID NOT NULL REFERENCES public.customers(id),
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  valid_until   DATE NOT NULL,
  total_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES public.users(id),
  updated_by    UUID REFERENCES public.users(id)
);

-- ============================================================
-- PRODUCTION MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bill_of_materials (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES public.products(id),
  version     TEXT NOT NULL DEFAULT '1.0',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES public.users(id),
  updated_by  UUID REFERENCES public.users(id),
  UNIQUE(product_id, version)
);

CREATE TABLE IF NOT EXISTS public.bom_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_id           UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  component_id     UUID NOT NULL REFERENCES public.products(id),
  quantity         NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
  unit_of_measure  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.work_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wo_number      TEXT UNIQUE NOT NULL,
  product_id     UUID NOT NULL REFERENCES public.products(id),
  bom_id         UUID NOT NULL REFERENCES public.bill_of_materials(id),
  quantity       NUMERIC(18,3) NOT NULL CHECK (quantity > 0),
  status         TEXT NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned','in_progress','on_hold','completed','cancelled')),
  planned_start  DATE NOT NULL,
  planned_end    DATE NOT NULL,
  actual_start   DATE,
  actual_end     DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES public.users(id),
  updated_by     UUID REFERENCES public.users(id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data    JSONB,
  new_data    JSONB,
  user_id     UUID REFERENCES public.users(id),
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_payrolls_employee ON public.payrolls(employee_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_so_customer ON public.sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_wo_status ON public.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_logs(table_name, record_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','transactions','invoices','employees','departments',
    'payrolls','leave_requests','products','warehouses','stock_movements','suppliers',
    'purchase_orders','customers','sales_orders','quotes','bill_of_materials','work_orders','users']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;

-- ============================================================
-- SEED DATA (Development)
-- ============================================================
INSERT INTO public.departments (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Finance'),
  ('22222222-2222-2222-2222-222222222222', 'Human Resources'),
  ('33333333-3333-3333-3333-333333333333', 'Operations'),
  ('44444444-4444-4444-4444-444444444444', 'Sales'),
  ('55555555-5555-5555-5555-555555555555', 'Production')
ON CONFLICT DO NOTHING;

-- Note: Create users via Supabase Auth first, then insert into public.users
-- Example users are pre-configured in the application seed script
