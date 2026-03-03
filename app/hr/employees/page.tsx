"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, UserCircle } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, StatusBadge, TableSkeleton, EmptyState, SectionTitle, formatCurrency, formatDate } from "@/components/ui";
import type { Employee } from "@/types";
import Link from "next/link";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "50" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/hr/employees?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setEmployees(res.data); setTotal(res.pagination?.totalCount || 0); }
      })
      .finally(() => setLoading(false));
  };

  // function addEmployee(){
  //   setLoading(true);
  //   fetch(`/api/hr/employees`)
  // }

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <>
      <Header
        title="Employee Directory"
        subtitle="Human Resources Module"
        actions={
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input !w-auto text-xs py-1.5">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </select>
            <Link  className="btn-primary" href={"/hr/employees/addEmployees"}><Plus className="w-3.5 h-3.5" /> Add Employee</Link >
          </div>
        }
      />
      <PageWrapper>
        <SectionTitle title="Employees" count={total} />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="text-left table-header px-4 py-3">Employee</th>
                  <th className="text-left table-header px-4 py-3">Code</th>
                  <th className="text-left table-header px-4 py-3">Department</th>
                  <th className="text-left table-header px-4 py-3">Position</th>
                  <th className="text-left table-header px-4 py-3">Type</th>
                  <th className="text-right table-header px-4 py-3">Salary</th>
                  <th className="text-left table-header px-4 py-3">Hired</th>
                  <th className="text-left table-header px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8}><TableSkeleton rows={8} cols={8} /></td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState title="No employees found" description="Add your first employee to get started." /></td></tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                            <UserCircle className="w-4 h-4 text-brand-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{emp.full_name}</p>
                            <p className="text-xs text-gray-500">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{emp.employee_code}</td>
                      <td className="px-4 py-3 text-gray-700">{(emp as any).departments?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{emp.position}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 capitalize">{emp.employment_type.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(emp.salary, emp.currency)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(emp.hire_date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageWrapper>
    </>
  );
}
