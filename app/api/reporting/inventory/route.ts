import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiServerError } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get("months") || "3");

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString();

    const [productRes, movementRes, warehouseRes] = await Promise.all([
      supabase.from("products").select("id, sku, name, category, quantity_on_hand, reorder_point, unit_cost, is_active"),
      supabase.from("stock_movements").select("product_id, type, quantity, created_at, products(sku, name)").gte("created_at", cutoffStr),
      supabase.from("warehouses").select("id, name, code, capacity, is_active"),
    ]);

    const products = productRes.data || [];
    const movements = movementRes.data || [];
    const warehouses = warehouseRes.data || [];

    // Summary stats
    const activeProducts = products.filter((p) => p.is_active);
    const totalValue = activeProducts.reduce((s, p) => s + p.quantity_on_hand * p.unit_cost, 0);
    const lowStockItems = activeProducts.filter((p) => p.quantity_on_hand <= p.reorder_point && p.reorder_point > 0);
    const zeroStockItems = activeProducts.filter((p) => p.quantity_on_hand <= 0);

    // Top 10 by value
    const topByValue = [...activeProducts]
      .map((p) => ({ sku: p.sku, name: p.name, value: p.quantity_on_hand * p.unit_cost, quantity: p.quantity_on_hand }))
      .sort((a, b) => b.value - a.value).slice(0, 10);

    // Movement totals by type
    const moveSummary = { inbound: 0, outbound: 0, adjustment: 0, transfer: 0 };
    movements.forEach((m) => { if (m.type in moveSummary) (moveSummary as any)[m.type] += m.quantity; });

    // Monthly movement trend
    const monthlyMoves: Record<string, { in: number; out: number }> = {};
    for (let m = months - 1; m >= 0; m--) {
      const d = new Date(); d.setMonth(d.getMonth() - m);
      const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
      monthlyMoves[key] = { in: 0, out: 0 };
    }
    movements.forEach((m) => {
      const key = new Date(m.created_at).toLocaleString("en", { month: "short", year: "2-digit" });
      if (monthlyMoves[key]) {
        if (m.type === "inbound") monthlyMoves[key].in += m.quantity;
        if (m.type === "outbound") monthlyMoves[key].out += m.quantity;
      }
    });
    const movementTrend = Object.entries(monthlyMoves).map(([month, v]) => ({ month, ...v }));

    // Top moved products
    const moveMap: Record<string, { name: string; sku: string; total: number }> = {};
    movements.filter((m) => m.type === "outbound").forEach((m) => {
      const id = m.product_id;
      if (!moveMap[id]) moveMap[id] = { name: (m as any).products?.name || "—", sku: (m as any).products?.sku || "—", total: 0 };
      moveMap[id].total += m.quantity;
    });
    const topMovers = Object.values(moveMap).sort((a, b) => b.total - a.total).slice(0, 8);

    // Category breakdown
    const catMap: Record<string, number> = {};
    activeProducts.forEach((p) => {
      const cat = p.category || "Uncategorized";
      catMap[cat] = (catMap[cat] || 0) + p.quantity_on_hand * p.unit_cost;
    });
    const byCategory = Object.entries(catMap).map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);

    return apiSuccess({
      summary: {
        total_value: totalValue,
        active_products: activeProducts.length,
        low_stock_count: lowStockItems.length,
        zero_stock_count: zeroStockItems.length,
        warehouse_count: warehouses.filter((w) => w.is_active).length,
        movement_summary: moveSummary,
      },
      low_stock_items: lowStockItems.slice(0, 20),
      top_by_value: topByValue,
      top_movers: topMovers,
      movement_trend: movementTrend,
      by_category: byCategory,
    }, "Inventory report retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}