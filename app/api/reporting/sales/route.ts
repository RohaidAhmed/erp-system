import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiServerError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get("months") || "6");

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const [orderRes, quoteRes, customerRes] = await Promise.all([
      supabase.from("sales_orders")
        .select("id, so_number, status, total_amount, order_date, currency, customers(name, customer_code, tier), sales_order_items(quantity, unit_price, discount_pct, total_price, products(name, sku))"),
      supabase.from("quotes").select("id, status, total_amount, valid_until, customers(name)"),
      supabase.from("customers").select("id, name, customer_code, tier, is_active"),
    ]);

    const orders = orderRes.data || [];
    const quotes = quoteRes.data || [];
    const customers = customerRes.data || [];

    const recentOrders = orders.filter((o) => o.order_date >= cutoffStr);

    // Pipeline by status
    const pipeline: Record<string, { count: number; value: number }> = {};
    orders.forEach((o) => {
      if (!pipeline[o.status]) pipeline[o.status] = { count: 0, value: 0 };
      pipeline[o.status].count++;
      pipeline[o.status].value += o.total_amount;
    });

    // Revenue = delivered orders
    const deliveredRevenue = orders
      .filter((o) => o.status === "delivered")
      .reduce((s, o) => s + o.total_amount, 0);

    // Monthly order trend
    const monthlyMap: Record<string, { orders: number; value: number }> = {};
    for (let m = months - 1; m >= 0; m--) {
      const d = new Date(); d.setMonth(d.getMonth() - m);
      const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
      monthlyMap[key] = { orders: 0, value: 0 };
    }
    recentOrders.forEach((o) => {
      const key = new Date(o.order_date).toLocaleString("en", { month: "short", year: "2-digit" });
      if (monthlyMap[key]) { monthlyMap[key].orders++; monthlyMap[key].value += o.total_amount; }
    });
    const monthlyTrend = Object.entries(monthlyMap).map(([month, v]) => ({ month, ...v }));

    // Top customers by total order value
    const custMap: Record<string, { name: string; code: string; tier: string; value: number; orders: number }> = {};
    orders.forEach((o) => {
      const c = (o as any).customers;
      if (!c) return;
      const id = c.customer_code;
      if (!custMap[id]) custMap[id] = { name: c.name, code: c.customer_code, tier: c.tier, value: 0, orders: 0 };
      custMap[id].value += o.total_amount;
      custMap[id].orders += 1;
    });
    const topCustomers = Object.values(custMap).sort((a, b) => b.value - a.value).slice(0, 8);

    // Top products by revenue
    const prodMap: Record<string, { name: string; sku: string; revenue: number; qty: number }> = {};
    orders.filter((o) => o.status !== "cancelled").forEach((o) => {
      ((o as any).sales_order_items || []).forEach((item: any) => {
        const p = item.products;
        if (!p) return;
        if (!prodMap[p.sku]) prodMap[p.sku] = { name: p.name, sku: p.sku, revenue: 0, qty: 0 };
        prodMap[p.sku].revenue += item.total_price;
        prodMap[p.sku].qty += item.quantity;
      });
    });
    const topProducts = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    // Quote conversion rate
    const totalQuotes = quotes.length;
    const acceptedQuotes = quotes.filter((q) => q.status === "accepted").length;
    const conversionRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;

    // Tier breakdown
    const tierMap: Record<string, number> = {};
    customers.filter((c) => c.is_active).forEach((c) => { tierMap[c.tier] = (tierMap[c.tier] || 0) + 1; });

    return apiSuccess({
      summary: {
        total_revenue: deliveredRevenue,
        open_orders: orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
        total_customers: customers.filter((c) => c.is_active).length,
        quote_conversion_pct: conversionRate,
        open_quotes: quotes.filter((q) => ["draft", "sent"].includes(q.status)).length,
      },
      pipeline: Object.entries(pipeline).map(([status, v]) => ({ status, ...v })),
      monthly_trend: monthlyTrend,
      top_customers: topCustomers,
      top_products: topProducts,
      customer_by_tier: Object.entries(tierMap).map(([tier, count]) => ({ tier, count })),
    }, "Sales report retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}