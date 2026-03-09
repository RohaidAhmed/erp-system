"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Building2 } from "lucide-react";
import { clsx } from "clsx";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get("next") || "/dashboard";
    const urlError = searchParams.get("error");

    const [mode, setMode] = useState<"login" | "forgot">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(urlError === "auth_callback_failed" ? "Authentication failed. Please try again." : "");
    const [info, setInfo] = useState("");

    // Redirect if already logged in
    useEffect(() => {
        getSupabaseBrowserClient().auth.getSession().then(({ data: { session } }) => {
            if (session) router.replace(next);
        });
    }, [next, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) { setError("Email and password are required."); return; }
        setBusy(true); setError("");
        try {
            const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
            if (error) {
                setError(error.message === "Invalid login credentials"
                    ? "Incorrect email or password."
                    : error.message);
            } else {
                router.replace(next);
            }
        } catch { setError("Network error. Please try again."); }
        finally { setBusy(false); }
    };

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) { setError("Enter your email address."); return; }
        setBusy(true); setError(""); setInfo("");
        try {
            const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
            });
            if (error) setError(error.message);
            else setInfo("Password reset link sent — check your inbox.");
        } catch { setError("Network error. Please try again."); }
        finally { setBusy(false); }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-100 via-white to-blue-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg mb-3">
                        <Building2 className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">ERP System</h1>
                    <p className="text-sm text-gray-500 mt-1">Enterprise Resource Planning</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-surface-200 p-8">
                    <h2 className="text-base font-semibold text-gray-900 mb-1">
                        {mode === "login" ? "Sign in to your account" : "Reset your password"}
                    </h2>
                    <p className="text-xs text-gray-400 mb-6">
                        {mode === "login" ? "Enter your credentials to access the ERP." : "We'll email you a reset link."}
                    </p>

                    <form onSubmit={mode === "login" ? handleLogin : handleForgot} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Email address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                                placeholder="you@company.com"
                                autoComplete="email"
                                autoFocus
                                disabled={busy}
                                className={clsx(
                                    "w-full px-3 py-2.5 text-sm rounded-xl border bg-white transition-colors outline-none",
                                    "focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
                                    "placeholder:text-gray-300 disabled:opacity-60",
                                    error ? "border-red-400" : "border-surface-400"
                                )}
                            />
                        </div>

                        {mode === "login" && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPwd ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        disabled={busy}
                                        className={clsx(
                                            "w-full px-3 py-2.5 pr-10 text-sm rounded-xl border bg-white transition-colors outline-none",
                                            "focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
                                            "placeholder:text-gray-300 disabled:opacity-60",
                                            error ? "border-red-400" : "border-surface-400"
                                        )}
                                    />
                                    <button type="button" onClick={() => setShowPwd((p) => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                            </div>
                        )}
                        {info && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />{info}
                            </div>
                        )}

                        <button type="submit" disabled={busy}
                            className={clsx(
                                "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all",
                                "bg-brand-600 hover:bg-brand-700 text-white shadow-sm",
                                "disabled:opacity-60 disabled:cursor-not-allowed"
                            )}>
                            {busy
                                ? <><Loader2 className="w-4 h-4 animate-spin" />{mode === "login" ? "Signing in…" : "Sending…"}</>
                                : mode === "login" ? "Sign in" : "Send reset link"}
                        </button>
                    </form>

                    {/* Toggle mode */}
                    <div className="mt-5 text-center">
                        {mode === "login" ? (
                            <button onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}
                                className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors">
                                Forgot your password?
                            </button>
                        ) : (
                            <button onClick={() => { setMode("login"); setError(""); setInfo(""); }}
                                className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                                ← Back to sign in
                            </button>
                        )}
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                    Access is restricted to authorised users only.
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}