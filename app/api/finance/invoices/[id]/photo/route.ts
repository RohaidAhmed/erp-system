import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const BUCKET = "invoices-photos";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createServerClient();

        // Verify invoice exists
        const { data: inv, error: invErr } = await supabase
            .from("invoices")
            .select("id, photo_url")
            .eq("id", params.id)
            .single();

        if (invErr || !inv) {
            return NextResponse.json(
                { success: false, message: "Invoice not found." },
                { status: 404 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("photo") as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, message: "No file provided." },
                { status: 400 }
            );
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { success: false, message: "Only JPEG, PNG, WebP or GIF images are allowed." },
                { status: 400 }
            );
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json(
                { success: false, message: "File size must be under 5 MB." },
                { status: 400 }
            );
        }

        const ext = file.type.split("/")[1].replace("jpeg", "jpg");
        const filePath = `${params.id}/photo.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        // Delete old photo if it exists and path differs
        if (inv.photo_url) {
            const oldPath = inv.photo_url.split(`${BUCKET}/`)[1]?.split("?")[0];
            if (oldPath && oldPath !== filePath) {
                await supabase.storage.from(BUCKET).remove([oldPath]);
            }
        }

        // Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadErr) {
            return NextResponse.json(
                { success: false, message: uploadErr.message },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        const photoUrl = `${urlData.publicUrl}?v=${Date.now()}`; // cache-bust

        // Save URL to invoice record
        const { error: updateErr } = await supabase
            .from("invoices")
            .update({ photo_url: urlData.publicUrl })
            .eq("id", params.id)
            .select("id, photo_url")
            .single();

        if (updateErr) {
            return NextResponse.json(
                { success: false, message: updateErr.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { photo_url: photoUrl },
            message: "Photo uploaded successfully.",
        });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, message: err?.message || "Server error." },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createServerClient();

        const { data: inv } = await supabase
            .from("invoices")
            .select("id, photo_url")
            .eq("id", params.id)
            .single();

        if (inv?.photo_url) {
            const path = inv.photo_url.split(`${BUCKET}/`)[1]?.split("?")[0];
            if (path) await supabase.storage.from(BUCKET).remove([path]);
        }

        await supabase
            .from("invoices")
            .update({ photo_url: null })
            .eq("id", params.id);

        return NextResponse.json({ success: true, message: "Photo removed." });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, message: err?.message || "Server error." },
            { status: 500 }
        );
    }
}