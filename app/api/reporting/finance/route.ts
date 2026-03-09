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

    const [invoiceRes, transactionRes] = await Promise.all([
      supabase.from("invoices").select("total_amount, status, type, issue_date, due_date"),
      supabase.from("transactions").select("amount, type, date, category").gte("date", cutoffStr),
    ]);

    const invoices = invoiceRes.data || [];
    const transactions = transactionRes.data || [];

    // Revenue = paid AR invoices
    const revenue = invoices
      .filter((i) => i.type === "accounts_receivable" && i.status === "paid")
      .reduce((s, i) => s + i.total_amount, 0);

    // Expenses = posted debit transactions
    const expenses = transactions
      .filter((t) => t.type === "debit")
      .reduce((s, t) => s + t.amount, 0);

    // Open invoices aging
    const today = new Date();
    const aging = { current: 0, days_30: 0, days_60: 0, days_90_plus: 0 };
    invoices
      .filter((i) => ["sent", "approved", "overdue"].includes(i.status))
      .forEach((i) => {
        const due = new Date(i.due_date);
        const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
        if (days <= 0) aging.current += i.total_amount;
        else if (days <= 30) aging.days_30 += i.total_amount;
        else if (days <= 60) aging.days_60 += i.total_amount;
        else aging.days_90_plus += i.total_amount;
      });

    // Monthly P&L breakdown
    const monthlyMap: Record<string, { revenue: number; expenses: number }> = {};
    for (let m = months - 1; m >= 0; m--) {
      const d = new Date(); d.setMonth(d.getMonth() - m);
      const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
      monthlyMap[key] = { revenue: 0, expenses: 0 };
    }
    invoices
      .filter((i) => i.type === "accounts_receivable" && i.status === "paid" && i.issue_date >= cutoffStr)
      .forEach((i) => {
        const d = new Date(i.issue_date);
        const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
        if (monthlyMap[key]) monthlyMap[key].revenue += i.total_amount;
      });
    transactions
      .filter((t) => t.type === "debit")
      .forEach((t) => {
        const d = new Date(t.date);
        const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
        if (monthlyMap[key]) monthlyMap[key].expenses += t.amount;
      });

    const monthly = Object.entries(monthlyMap).map(([month, v]) => ({
      month, ...v, profit: v.revenue - v.expenses,
    }));

    // Category breakdown for expenses
    const categoryMap: Record<string, number> = {};
    transactions.filter((t) => t.type === "debit").forEach((t) => {
      const cat = t.category || "Uncategorized";
      categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
    });
    const expensesByCategory = Object.entries(categoryMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // AR / AP totals
    const totalAR = invoices
      .filter((i) => i.type === "accounts_receivable" && ["sent", "approved", "overdue"].includes(i.status))
      .reduce((s, i) => s + i.total_amount, 0);
    const totalAP = invoices
      .filter((i) => i.type === "accounts_payable" && ["sent", "approved", "overdue"].includes(i.status))
      .reduce((s, i) => s + i.total_amount, 0);

    return apiSuccess({
      summary: { revenue, expenses, profit: revenue - expenses, total_ar: totalAR, total_ap: totalAP },
      monthly,
      aging,
      expenses_by_category: expensesByCategory,
    }, "Finance report retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}