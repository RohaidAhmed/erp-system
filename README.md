# ERP System — Next.js + TypeScript + Tailwind + Supabase

Enterprise Resource Planning system built with Next.js 14 App Router, TypeScript, Tailwind CSS, and Supabase (PostgreSQL).

## Architecture

```
MVC Pattern:
  Model      → Supabase PostgreSQL tables + TypeScript types (/types/index.ts)
  View       → Next.js App Router pages + React components (/app, /components)
  Controller → Next.js API Route Handlers (/app/api/**/route.ts)
```

## Modules

| Module | Routes | API Endpoints |
|--------|--------|---------------|
| Finance | `/finance/accounts`, `/finance/invoices`, `/finance/transactions` | `/api/finance/accounts`, `/api/finance/invoices`, `/api/finance/transactions` |
| HR | `/hr/employees`, `/hr/payroll`, `/hr/leave` | `/api/hr/employees`, `/api/hr/payroll` |
| Inventory | `/inventory/products`, `/inventory/warehouses` | `/api/inventory/products` |
| Procurement | `/procurement/purchase-orders`, `/procurement/suppliers` | `/api/procurement/purchase-orders` |
| Sales & CRM | `/sales/orders`, `/sales/customers`, `/sales/quotes` | `/api/sales/orders`, `/api/sales/customers` |
| Production | `/production/work-orders`, `/production/bom` | `/api/production/work-orders` |
| Reporting | `/reporting` | `/api/reporting` |

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema: copy `lib/supabase/schema.sql` into Supabase SQL Editor and execute
3. Copy environment variables:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
erp-system/
├── app/
│   ├── api/                    # Controller layer (API Route Handlers)
│   │   ├── finance/
│   │   ├── hr/
│   │   ├── inventory/
│   │   ├── procurement/
│   │   ├── sales/
│   │   ├── production/
│   │   └── reporting/
│   ├── dashboard/              # Main dashboard
│   ├── finance/                # Finance module pages
│   ├── hr/                     # HR module pages
│   ├── inventory/              # Inventory module pages
│   ├── procurement/            # Procurement module pages
│   ├── sales/                  # Sales & CRM module pages
│   ├── production/             # Production module pages
│   └── reporting/              # Reporting & Analytics
├── components/
│   ├── layout/                 # Sidebar, Header, AppLayout
│   └── ui/                     # Shared UI components
├── hooks/                      # useFetch, useMutation
├── lib/
│   ├── supabase/               # Supabase clients + schema.sql
│   ├── controllers/            # Controller helpers
│   └── utils/                  # api-response.ts, rbac.ts
└── types/                      # TypeScript type definitions
```

## API Response Format

All API endpoints return a consistent response envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "pagination": { "page": 1, "pageSize": 20, "totalCount": 150, "totalPages": 8 },
  "errors": [],
  "timestamp": "2026-03-03T09:00:00Z"
}
```

## Switching to Production Database

The app uses Supabase for development. To switch to production:

1. Update `lib/supabase/server.ts` to use your production PostgreSQL connection
2. Replace `createServerClient()` in API routes with your production ORM (Prisma, Drizzle, etc.)
3. The TypeScript types in `types/index.ts` remain the same regardless of database

## Security (RBAC)

Role-based access control is defined in `lib/utils/rbac.ts`. Roles:
- `super_admin` — Full access to all modules
- `finance_manager` — Full Finance, view/approve Procurement
- `hr_manager` — Full HR
- `inventory_manager` — Full Inventory
- `procurement_officer` — Full Procurement
- `sales_executive` — Full Sales & CRM
- `production_manager` — Full Production
- `viewer` — Read-only access

Enforce in API routes:
```typescript
const userRole = /* get from JWT/session */;
if (!canCreate(userRole, "finance")) return apiUnauthorized();
```
