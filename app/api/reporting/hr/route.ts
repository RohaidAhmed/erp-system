import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiServerError } from "@/lib/utils/api-response";

export async function GET(_req: NextRequest) {
  try {
    const supabase = createServerClient();

    const [empRes, payrollRes, leaveRes, deptRes] = await Promise.all([
      supabase.from("employees").select("id, status, department_id, position, employment_type, hire_date, departments(name)"),
      supabase.from("payroll_runs").select("net_pay, status, period_start, period_end, payroll_items(net_pay, status)"),
      supabase.from("leave_requests").select("id, status, leave_type, days_requested, created_at"),
      supabase.from("departments").select("id, name, parent_id"),
    ]);

    const employees = empRes.data || [];
    const payrolls = payrollRes.data || [];
    const leaves = leaveRes.data || [];
    const depts = deptRes.data || [];

    const active = employees.filter((e) => e.status === "active");

    // Department headcount
    const deptMap: Record<string, { name: string; count: number }> = {};
    active.forEach((e) => {
      const dept = (e as any).departments;
      if (!dept) return;
      if (!deptMap[dept.name]) deptMap[dept.name] = { name: dept.name, count: 0 };
      deptMap[dept.name].count++;
    });
    const byDepartment = Object.values(deptMap).sort((a, b) => b.count - a.count);

    // Employment type breakdown
    const typeMap: Record<string, number> = {};
    active.forEach((e) => { const t = e.employment_type || "full_time"; typeMap[t] = (typeMap[t] || 0) + 1; });
    const byType = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

    // Payroll summary (last 3 months)
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
    const recentPayrolls = payrolls.filter((p) => p.status === "paid" && new Date(p.period_start) >= cutoff);
    const totalPayroll = recentPayrolls.reduce((s, p) => s + (p.net_pay || 0), 0);
    const avgPayroll = recentPayrolls.length > 0 ? totalPayroll / recentPayrolls.length : 0;

    // Monthly payroll trend
    const payrollTrend: { month: string; amount: number }[] = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(); d.setMonth(d.getMonth() - m);
      const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
      const amount = payrolls
        .filter((p) => p.status === "paid" && p.period_start >= monthStart && p.period_start <= monthEnd)
        .reduce((s, p) => s + (p.net_pay || 0), 0);
      payrollTrend.push({ month: key, amount });
    }

    // Leave requests summary
    const leaveSummary = {
      pending: leaves.filter((l) => l.status === "pending").length,
      approved: leaves.filter((l) => l.status === "approved").length,
      total_days: leaves.filter((l) => l.status === "approved").reduce((s, l) => s + l.days_requested, 0),
    };
    const leaveByType: Record<string, number> = {};
    leaves.forEach((l) => { leaveByType[l.leave_type] = (leaveByType[l.leave_type] || 0) + 1; });
    const leaveTypes = Object.entries(leaveByType).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

    // Tenure buckets
    const now = new Date();
    const tenure = { under_1: 0, one_3: 0, three_5: 0, over_5: 0 };
    active.forEach((e) => {
      const years = (now.getTime() - new Date(e.hire_date).getTime()) / (365.25 * 86400000);
      if (years < 1) tenure.under_1++;
      else if (years < 3) tenure.one_3++;
      else if (years < 5) tenure.three_5++;
      else tenure.over_5++;
    });

    return apiSuccess({
      summary: {
        active_employees: active.length,
        total_employees: employees.length,
        on_leave: employees.filter((e) => e.status === "on_leave").length,
        total_payroll_3m: totalPayroll,
        avg_monthly_payroll: avgPayroll,
        pending_leaves: leaveSummary.pending,
      },
      by_department: byDepartment,
      by_type: byType,
      payroll_trend: payrollTrend,
      leave_summary: leaveSummary,
      leave_by_type: leaveTypes,
      tenure_buckets: [
        { label: "< 1 year", count: tenure.under_1 },
        { label: "1-3 years", count: tenure.one_3 },
        { label: "3-5 years", count: tenure.three_5 },
        { label: "5+ years", count: tenure.over_5 },
      ],
    }, "HR report retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}