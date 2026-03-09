"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Building2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { clsx } from "clsx";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || password.length < 8) { setError("Password must be at least 8 characters."); return; }
        if (password !== confirm) { setError("Passwords do not match."); return; }
        setBusy(true); setError("");
        try {
            const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
            if (error) setError(error.message);
            else {
                setDone(true);
                setTimeout(() => router.replace("/dashboard"), 2500);
            }
        } catch { setError("Network error. Please try again."); }
        finally { setBusy(false); }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-100 via-white to-blue-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg mb-3">
                        <Building2 className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">ERP System</h1>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-surface-200 p-8">
                    {done ? (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            <p className="text-sm font-medium text-gray-900">Password updated!</p>
                            <p className="text-xs text-gray-400">Redirecting to dashboard…</p>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-base font-semibold text-gray-900 mb-1">Set a new password</h2>
                            <p className="text-xs text-gray-400 mb-6">Choose a strong password for your account.</p>

                            <form onSubmit={handleReset} className="space-y-4">
                                {["New password", "Confirm password"].map((label, i) => (
                                    <div key={label}>
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
                                        <div className="relative">
                                            <input type={showPwd ? "text" : "password"}
                                                value={i === 0 ? password : confirm}
                                                onChange={(e) => { i === 0 ? setPassword(e.target.value) : setConfirm(e.target.value); setError(""); }}
                                                placeholder="••••••••" disabled={busy}
                                                className={clsx(
                                                    "w-full px-3 py-2.5 pr-10 text-sm rounded-xl border bg-white transition-colors outline-none",
                                                    "focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-300 disabled:opacity-60",
                                                    error ? "border-red-400" : "border-surface-400"
                                                )} />
                                            {i === 0 && (
                                                <button type="button" onClick={() => setShowPwd((p) => !p)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {error && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                                    </div>
                                )}

                                <button type="submit" disabled={busy}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white shadow-sm disabled:opacity-60 transition-all">
                                    {busy ? <><Loader2 className="w-4 h-4 animate-spin" />Updating…</> : "Update password"}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}