import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError } from "@/lib/utils/api-response";

export async function GET(_req: NextRequest) {
    try {
        const supabase = createServerClient();
        const { data, error } = await supabase
            .from("shifts")
            .select("*")
            .eq("is_active", true)
            .order("start_time", { ascending: true });
        if (error) return apiError(error.message);
        return apiSuccess(data, "Shifts retrieved.");
    } catch (err) {
        return apiServerError(err);
    }
}