"use client";

/**
 * /auth/callback — handles ALL Supabase redirect flows
 *
 * Supabase sends auth tokens in the URL hash fragment (#access_token=...)
 * which NEVER reaches the server. This must be a client component so we can
 * read window.location.hash, call supabase.auth.setSession(), then redirect.
 *
 * Handles:
 *   - Invite links       → /auth/accept-invite  (user must set a password)
 *   - Password recovery  → /auth/reset-password
 *   - Email confirmation → /dashboard
 *   - Magic links        → /dashboard
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Building2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Suspense } from "react";

function CallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState("");

    useEffect(() => {
        const supabase = getSupabaseBrowserClient();

        // Parse hash fragment: #access_token=...&refresh_token=...&type=invite&...
        const hash = window.location.hash.slice(1); // strip leading #
        const params = new URLSearchParams(hash);

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");         // "invite" | "recovery" | "signup" | "magiclink"

        // Also check query params (PKCE flow uses ?code=... without hash)
        const code = searchParams.get("code");
        const queryType = searchParams.get("type");

        async function handle() {
            // ── Hash-based token flow (invite, recovery, magic link) ──────────────
            if (accessToken && refreshToken) {
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (error) {
                    setError("This link has expired or already been used. Please request a new one.");
                    return;
                }

                if (type === "invite") {
                    // Invited users must set a password before using the app
                    router.replace("/auth/accept-invite");
                } else if (type === "recovery") {
                    router.replace("/auth/reset-password");
                } else {
                    router.replace("/dashboard");
                }
                return;
            }

            // ── PKCE code flow (some Supabase configs send ?code= instead) ────────
            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    setError("Authentication failed. Please try again.");
                    return;
                }
                if (queryType === "recovery") {
                    router.replace("/auth/reset-password");
                } else {
                    router.replace("/dashboard");
                }
                return;
            }

            // Nothing to work with
            setError("Invalid or missing authentication token.");
        }

        handle();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-surface-100 via-white to-blue-50 flex items-center justify-center p-4">
                <div className="w-full max-w-sm">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg mb-3">
                            <Building2 className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">ERP System</h1>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-surface-200 p-8 flex flex-col items-center gap-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Link invalid or expired</p>
                            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{error}</p>
                        </div>
                        <button
                            onClick={() => window.location.href = "/auth/login"}
                            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
                        >
                            Back to login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-100 via-white to-blue-50 flex items-center justify-center p-4">
            <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg">
                    <Building2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                    <p className="text-sm text-gray-600">Signing you in…</p>
                </div>
            </div>
        </div>
    );
}

export default function CallbackPage() {
    return (
        <Suspense>
            <CallbackHandler />
        </Suspense>
    );
}