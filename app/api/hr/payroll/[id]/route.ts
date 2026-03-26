import { createServerClient } from "@/lib/supabase/server";
import { apiError, apiServerError, apiSuccess } from "@/lib/utils/api-response";
import { NextRequest } from "next/server";


// PATCH /api/hr/payrolls
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createServerClient();
        const { id } = params;
        const body = await req.json();

        const { data, error } = await supabase
            .from("payrolls")
            .update({
                ...body,
            })
            .select("*")
            .eq("id", id)
            .single();

        if (error) return apiError(error.message);

        return apiSuccess(data, "Payroll Updated");
    } catch (error) {
        return apiServerError(error)
    }
}

// PATCH /api/hr/payrolls
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createServerClient();
        const { id } = params;
        const body = await req.json();

        const { data, error } = await supabase
            .from("payrolls")
            .update({
                ...body
            })
            .select("*")
            .eq("id", id)
            .single();

        if (error) return apiError(error.message);

        return apiSuccess(data, `Payroll ${body.status}`);
    } catch (error) {
        return apiServerError(error)
    }
}