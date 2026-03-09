import { createServerClient } from "@/lib/supabase/server";
import { apiError, apiServerError, apiSuccess, buildPagination, getPagination } from "@/lib/utils/api-response";
import { NextRequest } from "next/server";


export async function GET(req: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(req.url);
        const { page, pageSize, from, to } = getPagination(searchParams);
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        let query = supabase
            .from("departments")
            .select("*");

        const {data, error, count} = await query;
        if (error) return apiError(error.message);
        return apiSuccess(data, "Departments retrieved!", buildPagination(page, pageSize, count ?? 0));
    }
    catch (err) {
        return apiServerError(err);
    }
}