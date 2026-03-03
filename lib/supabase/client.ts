import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client (for client components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type-safe database helper
export type Database = {
  public: {
    Tables: {
      users: { Row: any; Insert: any; Update: any };
      accounts: { Row: any; Insert: any; Update: any };
      transactions: { Row: any; Insert: any; Update: any };
      invoices: { Row: any; Insert: any; Update: any };
      employees: { Row: any; Insert: any; Update: any };
      departments: { Row: any; Insert: any; Update: any };
      payrolls: { Row: any; Insert: any; Update: any };
      leave_requests: { Row: any; Insert: any; Update: any };
      products: { Row: any; Insert: any; Update: any };
      warehouses: { Row: any; Insert: any; Update: any };
      stock_movements: { Row: any; Insert: any; Update: any };
      suppliers: { Row: any; Insert: any; Update: any };
      purchase_orders: { Row: any; Insert: any; Update: any };
      purchase_order_items: { Row: any; Insert: any; Update: any };
      customers: { Row: any; Insert: any; Update: any };
      sales_orders: { Row: any; Insert: any; Update: any };
      sales_order_items: { Row: any; Insert: any; Update: any };
      quotes: { Row: any; Insert: any; Update: any };
      work_orders: { Row: any; Insert: any; Update: any };
      bill_of_materials: { Row: any; Insert: any; Update: any };
      bom_items: { Row: any; Insert: any; Update: any };
      audit_logs: { Row: any; Insert: any; Update: any };
    };
  };
};
