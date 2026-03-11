"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Building2, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { clsx } from "clsx";

function StrengthBar({ password }: { password: string }) {
    const checks = [
        password.length >= 8,
        /[A-Z]/.test(password),
        /[0-9]/.test(password),
        /[^A-Za-z0-9]/.test(password),
    ];
    const score = checks.filter(Boolean).length;
    const colors = ["bg-gray-200", "bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-emerald-500"];
    const labels = ["", "Weak", "Fair", "Good", "Strong"];
    if (!password) return null;
    return (
        <div className="mt-2 space-y-1">
            <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={clsx("h-1 flex-1 rounded-full transition-colors", i < score ? colors[score] : "bg-gray-200")} />
                ))}
            </div>
            <p className={clsx("text-xs font-medium", score <= 1 ? "text-red-500" : score <= 2 ? "text-amber-500" : "text-emerald-600")}>
                {labels[score]}
            </p>
        </div>
    );
}

export default function AcceptInvitePage() {
    const router = useRouter();
    const [user, setUser] = useState<{ email: string; full_name?: string } | null>(null);
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const [checking, setChecking] = useState(true);

    // Confirm a session exists (callback already verified the OTP)
    useEffect(() => {
        getSupabaseBrowserClient().auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUser({
                    email: user.email || "",
                    full_name: user.user_metadata?.full_name,
                });
            } else {
                // No session — invite link may be expired or already used
                router.replace("/auth/login?error=invite_expired");
            }
            setChecking(false);
        });
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || password.length < 8) { setError("Password must be at least 8 characters."); return; }
        if (password !== confirm) { setError("Passwords don't match."); return; }

        setBusy(true); setError("");
        try {
            const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
            if (error) { setError(error.message); return; }
            setDone(true);
            setTimeout(() => router.replace("/dashboard"), 2000);
        } catch { setError("Network error. Please try again."); }
        finally { setBusy(false); }
    };

    if (checking) {
        return (
            <Screen>
                <div className="bg-white rounded-2xl shadow-xl border border-surface-200 p-12 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    <p className="text-sm text-gray-500">Verifying invite link…</p>
                </div>
            </Screen>
        );
    }

    if (done) {
        return (
            <Screen>
                <div className="bg-white rounded-2xl shadow-xl border border-surface-200 p-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Welcome aboard!</h2>
                        <p className="text-sm text-gray-500 mt-1">Your account is ready. Redirecting to the dashboard…</p>
                    </div>
                </div>
            </Screen>
        );
    }

    return (
        <Screen>
            <div className="bg-white rounded-2xl shadow-xl border border-surface-200 overflow-hidden">
                {/* Header */}
                <div className="px-8 pt-7 pb-6 bg-gradient-to-br from-brand-600 to-brand-700">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs text-brand-200 font-medium">You've been invited</p>
                            <h2 className="text-base font-bold text-white">Set your password</h2>
                        </div>
                    </div>
                    {user && (
                        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-white/10">
                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-white">
                                    {(user.full_name || user.email)[0].toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                {user.full_name && <p className="text-sm font-medium text-white truncate">{user.full_name}</p>}
                                <p className="text-xs text-brand-200 truncate">{user.email}</p>
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
                    <p className="text-xs text-gray-500">
                        Choose a strong password to secure your account. You'll use it every time you sign in.
                    </p>

                    {/* Password */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            New Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showPwd ? "text" : "password"}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                placeholder="••••••••"
                                autoComplete="new-password"
                                autoFocus
                                disabled={busy}
                                className={clsx(
                                    "w-full px-3 py-2.5 pr-10 text-sm rounded-xl border bg-white transition-colors outline-none",
                                    "focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-300 disabled:opacity-60",
                                    error ? "border-red-400" : "border-surface-400"
                                )}
                            />
                            <button type="button" onClick={() => setShowPwd((p) => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <StrengthBar password={password} />
                    </div>

                    {/* Confirm */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Confirm Password <span className="text-red-500">*</span>
                        </label>
                        <input
                            type={showPwd ? "text" : "password"}
                            value={confirm}
                            onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                            placeholder="••••••••"
                            autoComplete="new-password"
                            disabled={busy}
                            className={clsx(
                                "w-full px-3 py-2.5 text-sm rounded-xl border bg-white transition-colors outline-none",
                                "focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-300 disabled:opacity-60",
                                error ? "border-red-400" : "border-surface-400"
                            )}
                        />
                        {confirm && password && confirm !== password && (
                            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Passwords don't match
                            </p>
                        )}
                        {confirm && password && confirm === password && (
                            <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Passwords match
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                        </div>
                    )}

                    <button type="submit" disabled={busy || !password || !confirm}
                        className={clsx(
                            "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all shadow-sm",
                            "bg-brand-600 hover:bg-brand-700 text-white",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}>
                        {busy
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Setting password…</>
                            : "Set password & sign in"}
                    </button>
                </form>
            </div>
        </Screen>
    );
}

function Screen({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-100 via-white to-blue-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg mb-3">
                        <Building2 className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">ERP System</h1>
                    <p className="text-sm text-gray-500 mt-1">Enterprise Resource Planning</p>
                </div>
                {children}
            </div>
        </div>
    );
}