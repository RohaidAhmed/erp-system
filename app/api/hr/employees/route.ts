import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  apiSuccess, apiError, apiServerError, getPagination, buildPagination,
} from "@/lib/utils/api-response";

// GET /api/hr/employees
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const { page, pageSize, from, to } = getPagination(searchParams);
    const status = searchParams.get("status");
    const department_id = searchParams.get("department_id");
    const search = searchParams.get("search");

    let query = supabase
      .from("employees")
      .select("*, departments(id, name)", { count: "exact" })
      .order("full_name", { ascending: true })
      .range(from, to);

    if (status) query = query.eq("status", status);
    if (department_id) query = query.eq("department_id", department_id);
    if (search) {
      // If search looks like an email, match exactly on email
      const isEmail =
        search.includes("@") && search.includes(".");

      if (isEmail) {
        query = query.eq("email", search);
      } else {
        query = query.ilike("full_name", `%${search}%`);
      }
    }

    const { data, error, count } = await query;
    if (error) return apiError(error.message);

    return apiSuccess(data, "Employees retrieved.", buildPagination(page, pageSize, count ?? 0));
  } catch (err) {
    return apiServerError(err);
  }
}

// POST /api/hr/employees
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const required = ["employee_code", "full_name", "email", "department_id", "position", "salary", "hire_date"];
    for (const field of required) {
      if (!body[field]) return apiError(`${field} is required.`, [{ field, message: "Required" }]);
    }

    if (body.salary <= 0) return apiError("Salary must be positive.", [{ field: "salary", message: "Must be > 0" }]);

    const { data, error } = await supabase
      .from("employees")
      .insert({
        employee_code: body.employee_code,
        full_name: body.full_name,
        email: body.email,
        phone: body.phone,
        department_id: body.department_id,
        position: body.position,
        employment_type: body.employment_type || "full_time",
        status: "active",
        salary: body.salary,
        currency: body.currency || "USD",
        hire_date: body.hire_date,
        manager_id: body.manager_id,
      })
      .select("*, departments(id, name)")
      .single();

    if (error) return apiError(error.message);
    return apiSuccess(data, "Employee created.", undefined, 201);
  } catch (err) {
    return apiServerError(err);
  }
}
