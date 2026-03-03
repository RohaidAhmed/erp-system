import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiServerError } from "@/lib/utils/api-response";

// GET /api/reporting/dashboard
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();

    const [
      { count: employeeCount },
      { count: openPOCount },
      { count: openSOCount },
      { count: openWOCount },
      invoiceData,
      productData,
    ] = await Promise.all([
      supabase.from("employees").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("purchase_orders").select("*", { count: "exact", head: true }).in("status", ["draft", "pending_approval", "approved", "ordered"]),
      supabase.from("sales_orders").select("*", { count: "exact", head: true }).in("status", ["draft", "confirmed", "picking", "shipped"]),
      supabase.from("work_orders").select("*", { count: "exact", head: true }).in("status", ["planned", "in_progress", "on_hold"]),
      supabase.from("invoices").select("total_amount, status, type"),
      supabase.from("products").select("quantity_on_hand, unit_cost"),
    ]);

    const invoices = invoiceData.data || [];
    const revenue = invoices
      .filter((i) => i.type === "accounts_receivable" && i.status === "paid")
      .reduce((sum, i) => sum + i.total_amount, 0);

    const openInvoices = invoices
      .filter((i) => ["sent", "approved", "overdue"].includes(i.status))
      .reduce((sum, i) => sum + i.total_amount, 0);

    const inventoryValue = (productData.data || []).reduce(
      (sum, p) => sum + p.quantity_on_hand * p.unit_cost, 0
    );

    const stats = {
      revenue: { label: "Total Revenue", value: revenue, prefix: "$", trend: "up", change: 12.4 },
      open_invoices: { label: "Open Invoices", value: openInvoices, prefix: "$", trend: "flat", change: 0 },
      active_employees: { label: "Active Employees", value: employeeCount ?? 0, trend: "up", change: 2.1 },
      inventory_value: { label: "Inventory Value", value: inventoryValue, prefix: "$", trend: "down", change: -3.2 },
      open_purchase_orders: { label: "Open POs", value: openPOCount ?? 0, trend: "up", change: 5.0 },
      sales_pipeline: { label: "Open Sales Orders", value: openSOCount ?? 0, trend: "up", change: 8.7 },
      production_orders: { label: "Active Work Orders", value: openWOCount ?? 0, trend: "flat", change: 0 },
    };

    // Monthly revenue chart data (last 6 months mock structure)
    const { data: monthlyData } = await supabase
      .from("invoices")
      .select("total_amount, issue_date, type, status")
      .eq("type", "accounts_receivable")
      .eq("status", "paid")
      .gte("issue_date", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

    return apiSuccess({ stats, monthly_data: monthlyData || [] }, "Dashboard data retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}
