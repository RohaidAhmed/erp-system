import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, apiServerError, apiNotFound } from "@/lib/utils/api-response";

// GET /api/procurement/suppliers/[id]
export async function GET(_req: NextRequest,) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("suppliers").select("*");
    if (error || !data) return apiNotFound("Supplier");
    return apiSuccess(data, "Supplier retrieved.");
  } catch (err) {
    return apiServerError(err);
  }
}

// // PUT /api/procurement/suppliers/[id] — edit supplier fields (code is immutable)
// export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
//   try {
//     const supabase = createServerClient();
//     const { data: existing } = await supabase.from("suppliers").select("id").eq("id", params.id).single();
//     if (!existing) return apiNotFound("Supplier");

//     const body = await req.json();
//     if (!body.name?.trim())  return apiError("Name is required.");
//     if (!body.email?.trim()) return apiError("Email is required.");

//     const rating = body.performance_rating !== undefined && body.performance_rating !== null
//       ? parseFloat(body.performance_rating)
//       : null;
//     if (rating !== null && (rating < 0 || rating > 5)) {
//       return apiError("Performance rating must be between 0 and 5.");
//     }

//     const { data, error } = await supabase.from("suppliers").update({
//       name:               body.name.trim(),
//       email:              body.email.trim().toLowerCase(),
//       phone:              body.phone?.trim() || null,
//       address:            body.address?.trim() || null,
//       payment_terms:      parseInt(body.payment_terms || 30),
//       currency:           body.currency || "USD",
//       performance_rating: rating,
//     }).eq("id", params.id).select().single();

//     if (error) return apiError(error.message);
//     return apiSuccess(data, "Supplier updated.");
//   } catch (err) {
//     return apiServerError(err);
//   }
// }

// // PATCH /api/procurement/suppliers/[id] — toggle is_active
// export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
//   try {
//     const supabase = createServerClient();
//     const { is_active } = await req.json();
//     if (typeof is_active !== "boolean") return apiError("'is_active' boolean is required.");

//     // Block deactivation if supplier has open POs
//     if (!is_active) {
//       const { count } = await supabase
//         .from("purchase_orders")
//         .select("*", { count: "exact", head: true })
//         .eq("supplier_id", params.id)
//         .not("status", "in", '("received","cancelled")');
//       if ((count ?? 0) > 0) {
//         return apiError(
//           `Cannot deactivate a supplier with ${count} open purchase order(s). Close or cancel them first.`,
//           [], 409
//         );
//       }
//     }

//     const { data, error } = await supabase.from("suppliers").update({ is_active })
//       .eq("id", params.id).select().single();
//     if (error) return apiError(error.message);
//     return apiSuccess(data, is_active ? "Supplier reactivated." : "Supplier deactivated.");
//   } catch (err) {
//     return apiServerError(err);
//   }
// }