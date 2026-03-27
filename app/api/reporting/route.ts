import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiServerError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();

    const cutoff6m = new Date();
    cutoff6m.setMonth(cutoff6m.getMonth() - 6);
    const cutoff6mStr = cutoff6m.toISOString().split("T")[0];

    const [
      { count: employeeCount },
      { count: openPOCount },
      { count: openSOCount },
      { count: openWOCount },
      invoiceData,
      productData,
      transactionData,
      recentInvoices,
      recentPOs,
      recentSOs,
      recentWOs,
      lowStockData,
    ] = await Promise.all([
      supabase.from("employees").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("purchase_orders").select("*", { count: "exact", head: true }).in("status", ["draft", "pending_approval", "approved", "ordered"]),
      supabase.from("sales_orders").select("*", { count: "exact", head: true }).in("status", ["draft", "confirmed", "picking", "shipped"]),
      supabase.from("work_orders").select("*", { count: "exact", head: true }).in("status", ["planned", "in_progress", "on_hold"]),
      supabase.from("invoices").select("total_amount, status, type, issue_date"),
      supabase.from("products").select("quantity_on_hand, unit_cost"),
      supabase.from("transactions").select("amount, type, date").gte("date", cutoff6mStr),
      supabase.from("invoices").select("id, invoice_number, total_amount, status, type, issue_date").order("issue_date", { ascending: false }).limit(3),
      supabase.from("purchase_orders").select("id, po_number, total_amount, status, created_at, suppliers(name)").order("created_at", { ascending: false }).limit(3),
      supabase.from("sales_orders").select("id, so_number, total_amount, status, created_at, customers(name)").order("created_at", { ascending: false }).limit(3),
      supabase.from("work_orders").select("id, wo_number, status, created_at, products(name)").order("created_at", { ascending: false }).limit(3),
      supabase.from("products").select("id, sku, name, quantity_on_hand, reorder_point").lte("quantity_on_hand", supabase.rpc as any).limit(5),
    ]);

    const invoices = invoiceData.data || [];
    const transactions = transactionData.data || [];

    // KPI stats
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
      revenue: { label: "Total Revenue", value: revenue, prefix: "Rs.", trend: "up", change: 0 },
      open_invoices: { label: "Open Invoices", value: openInvoices, prefix: "Rs.", trend: "flat", change: 0 },
      active_employees: { label: "Active Employees", value: employeeCount ?? 0, trend: "flat", change: 0 },
      inventory_value: { label: "Inventory Value", value: inventoryValue, prefix: "Rs.", trend: "flat", change: 0 },
      open_purchase_orders: { label: "Open POs", value: openPOCount ?? 0, trend: "flat", change: 0 },
      sales_pipeline: { label: "Open Sales Orders", value: openSOCount ?? 0, trend: "flat", change: 0 },
      production_orders: { label: "Active Work Orders", value: openWOCount ?? 0, trend: "flat", change: 0 },
    };

    // Build monthly revenue + expenses for last 6 months
    const monthlyMap: Record<string, { month: string; revenue: number; expenses: number }> = {};
    for (let m = 5; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en", { month: "short" });
      monthlyMap[key] = { month: label, revenue: 0, expenses: 0 };
    }
    invoices
      .filter((i) => i.type === "accounts_receivable" && i.status === "paid" && i.issue_date >= cutoff6mStr)
      .forEach((i) => {
        const key = i.issue_date.slice(0, 7);
        if (monthlyMap[key]) monthlyMap[key].revenue += i.total_amount;
      });
    transactions
      .filter((t) => t.type === "debit")
      .forEach((t) => {
        const key = t.date.slice(0, 7);
        if (monthlyMap[key]) monthlyMap[key].expenses += t.amount;
      });
    const monthly_revenue = Object.values(monthlyMap);

    // Module activity: count records per module
    const [
      { count: financeCount },
      { count: hrCount },
      { count: inventoryCount },
      { count: procurementCount },
      { count: salesCount },
      { count: productionCount },
    ] = await Promise.all([
      supabase.from("invoices").select("*", { count: "exact", head: true }),
      supabase.from("employees").select("*", { count: "exact", head: true }),
      supabase.from("stock_movements").select("*", { count: "exact", head: true }),
      supabase.from("purchase_orders").select("*", { count: "exact", head: true }),
      supabase.from("sales_orders").select("*", { count: "exact", head: true }),
      supabase.from("work_orders").select("*", { count: "exact", head: true }),
    ]);
    const totalActivity = (financeCount ?? 0) + (hrCount ?? 0) + (inventoryCount ?? 0) + (procurementCount ?? 0) + (salesCount ?? 0) + (productionCount ?? 0) || 1;
    const pct = (n: number) => Math.round((n / totalActivity) * 100);
    const module_activity = [
      { name: "Finance", value: pct(financeCount ?? 0) },
      { name: "HR", value: pct(hrCount ?? 0) },
      { name: "Inventory", value: pct(inventoryCount ?? 0) },
      { name: "Procurement", value: pct(procurementCount ?? 0) },
      { name: "Sales", value: pct(salesCount ?? 0) },
      { name: "Production", value: pct(productionCount ?? 0) },
    ].filter((m) => m.value > 0);

    // Recent activity feed — merge and sort by created_at
    const now = new Date();
    const timeAgo = (dateStr: string) => {
      const diff = Math.floor((now.getTime() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    };

    const recent_activity: { id: string; desc: string; time: string; color: string; ts: string }[] = [];
    (recentInvoices.data || []).forEach((inv: any) => {
      recent_activity.push({ id: `inv-${inv.id}`, desc: `Invoice ${inv.invoice_number} — ${inv.status}`, color: "bg-emerald-500", time: timeAgo(inv.issue_date), ts: inv.issue_date });
    });
    (recentPOs.data || []).forEach((po: any) => {
      recent_activity.push({ id: `po-${po.id}`, desc: `PO ${po.po_number} from ${po.suppliers?.name || "supplier"} — ${po.status}`, color: "bg-blue-500", time: timeAgo(po.created_at), ts: po.created_at });
    });
    (recentSOs.data || []).forEach((so: any) => {
      recent_activity.push({ id: `so-${so.id}`, desc: `Sales Order ${so.so_number} for ${so.customers?.name || "customer"} — ${so.status}`, color: "bg-brand-500", time: timeAgo(so.created_at), ts: so.created_at });
    });
    (recentWOs.data || []).forEach((wo: any) => {
      recent_activity.push({ id: `wo-${wo.id}`, desc: `Work Order ${wo.wo_number} — ${wo.products?.name || ""} — ${wo.status}`, color: "bg-purple-500", time: timeAgo(wo.created_at), ts: wo.created_at });
    });
    recent_activity.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    // Low stock alerts
    const { data: lowStockProducts } = await supabase
      .from("products")
      .select("id, sku, name, quantity_on_hand, reorder_point")
      .filter("quantity_on_hand", "lte", "reorder_point")
      .gt("reorder_point", 0)
      .eq("is_active", true)
      .order("quantity_on_hand", { ascending: true })
      .limit(5);

    return apiSuccess({ stats, monthly_revenue, module_activity, recent_activity: recent_activity.slice(0, 8), low_stock: lowStockProducts || [] }, "Dashboard data retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}