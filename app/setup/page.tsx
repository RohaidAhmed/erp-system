"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Building2, CheckCircle2, AlertCircle, Loader2,
    Eye, EyeOff, ShieldCheck, ArrowRight, Lock,
} from "lucide-react";
import { clsx } from "clsx";

type Step = "checking" | "ready" | "done" | "locked";

interface FormState {
    full_name: string;
    email: string;
    password: string;
    confirm: string;
    setup_key: string;
}

function StrengthBar({ password }: { password: string }) {
    const checks = [
        password.length >= 8,
        /[A-Z]/.test(password),
        /[0-9]/.test(password),
        /[^A-Za-z0-9]/.test(password),
    ];
    const score = checks.filter(Boolean).length;
    const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
    const colors = ["bg-gray-200", "bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-emerald-500"];

    if (!password) return null;

    return (
        <div className="mt-2 space-y-1.5">
            <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={clsx("h-1 flex-1 rounded-full transition-colors duration-300", i < score ? colors[score] : "bg-gray-200")} />
                ))}
            </div>
            <div className="flex items-center justify-between">
                <p className={clsx("text-xs font-medium", score <= 1 ? "text-red-500" : score === 2 ? "text-amber-500" : score === 3 ? "text-yellow-600" : "text-emerald-600")}>
                    {labels[score]}
                </p>
                <div className="flex gap-3 text-xs text-gray-400">
                    <span className={checks[0] ? "text-emerald-600" : ""}>8+ chars</span>
                    <span className={checks[1] ? "text-emerald-600" : ""}>uppercase</span>
                    <span className={checks[2] ? "text-emerald-600" : ""}>number</span>
                    <span className={checks[3] ? "text-emerald-600" : ""}>symbol</span>
                </div>
            </div>
        </div>
    );
}

export default function SetupPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("checking");
    const [form, setForm] = useState<FormState>({ full_name: "", email: "", password: "", confirm: "", setup_key: "" });
    const [showPwd, setShowPwd] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
    const [needsKey, setNeedsKey] = useState(false);

    // Check if setup is already done
    useEffect(() => {
        fetch("/api/setup")
            .then((r) => r.json())
            .then((res) => {
                if (res.data?.setup_complete) setStep("locked");
                else setStep("ready");
            })
            .catch(() => setStep("ready"));
    }, []);

    const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((p) => ({ ...p, [field]: e.target.value }));
        setFieldErrs((p) => ({ ...p, [field]: "" }));
        setError("");
    };

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!form.full_name.trim()) errs.full_name = "Required.";
        if (!form.email.trim()) errs.email = "Required.";
        else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Invalid email.";
        if (!form.password) errs.password = "Required.";
        else if (form.password.length < 8) errs.password = "At least 8 characters.";
        if (form.password !== form.confirm) errs.confirm = "Passwords don't match.";
        setFieldErrs(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setBusy(true); setError("");

        try {
            const res = await fetch("/api/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    full_name: form.full_name.trim(),
                    email: form.email.trim().toLowerCase(),
                    password: form.password,
                    setup_key: form.setup_key || undefined,
                }),
            });
            const data = await res.json();

            if (data.success) {
                setStep("done");
                setTimeout(() => router.push("/auth/login?setup=1"), 2200);
            } else if (res.status === 403) {
                setNeedsKey(true);
                setError("A setup key is required. Set SETUP_SECRET_KEY in your environment.");
            } else {
                setError(data.message || "Setup failed.");
            }
        } catch {
            setError("Network error — check your connection.");
        } finally {
            setBusy(false);
        }
    };

    // ── States ──────────────────────────────────────────────────────────────────
    if (step === "checking") {
        return (
            <Screen>
                <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    <p className="text-sm text-gray-500">Checking installation status…</p>
                </div>
            </Screen>
        );
    }

    if (step === "locked") {
        return (
            <Screen>
                <div className="bg-white rounded-2xl shadow-xl border border-surface-200 p-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Setup already complete</h2>
                        <p className="text-sm text-gray-500 mt-1.5">A super admin account already exists.<br />This page is disabled for security.</p>
                    </div>
                    <button onClick={() => router.push("/auth/login")}
                        className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors">
                        Go to Login <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </Screen>
        );
    }

    if (step === "done") {
        return (
            <Screen>
                <div className="bg-white rounded-2xl shadow-xl border border-surface-200 p-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center animate-bounce">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Setup complete!</h2>
                        <p className="text-sm text-gray-500 mt-1.5">
                            Super admin account created for <strong>{form.email}</strong>.<br />
                            Redirecting to login…
                        </p>
                    </div>
                    <div className="w-48 h-1.5 bg-surface-200 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-brand-500 rounded-full animate-[grow_2.2s_ease-out_forwards]" style={{ width: "0%" }} />
                    </div>
                </div>
            </Screen>
        );
    }

    // ── Main form ──────────────────────────────────────────────────────────────
    return (
        <Screen>
            <div className="bg-white rounded-2xl shadow-xl border border-surface-200 overflow-hidden">
                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b border-surface-200 bg-gradient-to-br from-brand-600 to-brand-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-brand-200 uppercase tracking-wider">First-Run Setup</p>
                            <h2 className="text-base font-bold text-white">Create Super Admin Account</h2>
                        </div>
                    </div>
                    <p className="text-sm text-brand-100 leading-relaxed">
                        This account will have full access to all modules and can manage other users.
                        Complete this once — the setup page locks after creation.
                    </p>
                </div>

                {/* Steps indicator */}
                <div className="flex border-b border-surface-200">
                    {["Account Details", "Password", "Confirm"].map((label, i) => (
                        <div key={label} className={clsx(
                            "flex-1 px-4 py-2.5 text-center text-xs font-medium border-b-2 transition-colors",
                            i === 0 ? "border-brand-500 text-brand-600 bg-brand-50" : "border-transparent text-gray-400"
                        )}>
                            <span className="inline-flex items-center gap-1.5">
                                <span className={clsx("w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold",
                                    i === 0 ? "bg-brand-600 text-white" : "bg-surface-300 text-gray-500")}>
                                    {i + 1}
                                </span>
                                {label}
                            </span>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
                    {/* Full name */}
                    <Field label="Full Name" error={fieldErrs.full_name} required>
                        <input type="text" value={form.full_name} onChange={set("full_name")}
                            placeholder="e.g. Sarah Khan" autoFocus
                            className={inputClass(fieldErrs.full_name)} />
                    </Field>

                    {/* Email */}
                    <Field label="Email Address" error={fieldErrs.email} required>
                        <input type="email" value={form.email} onChange={set("email")}
                            placeholder="admin@company.com" autoComplete="email"
                            className={inputClass(fieldErrs.email)} />
                    </Field>

                    {/* Password */}
                    <Field label="Password" error={fieldErrs.password} required>
                        <div className="relative">
                            <input type={showPwd ? "text" : "password"} value={form.password} onChange={set("password")}
                                placeholder="••••••••" autoComplete="new-password"
                                className={clsx(inputClass(fieldErrs.password), "pr-10")} />
                            <button type="button" onClick={() => setShowPwd((p) => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <StrengthBar password={form.password} />
                    </Field>

                    {/* Confirm */}
                    <Field label="Confirm Password" error={fieldErrs.confirm} required>
                        <input type={showPwd ? "text" : "password"} value={form.confirm} onChange={set("confirm")}
                            placeholder="••••••••" autoComplete="new-password"
                            className={inputClass(fieldErrs.confirm)} />
                    </Field>

                    {/* Optional setup key */}
                    {needsKey && (
                        <Field label="Setup Key" hint="Set via SETUP_SECRET_KEY environment variable">
                            <input type="password" value={form.setup_key} onChange={set("setup_key")}
                                placeholder="Enter the secret key from your server environment"
                                className={inputClass()} />
                        </Field>
                    )}

                    {error && (
                        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button type="submit" disabled={busy}
                        className={clsx(
                            "w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold transition-all shadow-sm",
                            "bg-brand-600 hover:bg-brand-700 text-white",
                            "disabled:opacity-60 disabled:cursor-not-allowed"
                        )}>
                        {busy
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account…</>
                            : <><ShieldCheck className="w-4 h-4" />Create Super Admin Account</>}
                    </button>

                    <p className="text-center text-xs text-gray-400">
                        This page will be permanently disabled after setup.
                    </p>
                </form>
            </div>
        </Screen>
    );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Screen({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center shadow-xl">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-white leading-none">ERP System</p>
                        <p className="text-xs text-brand-300 mt-0.5">Enterprise Resource Planning</p>
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}

function Field({ label, error, hint, required, children }: {
    label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
            {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
    );
}

function inputClass(error?: string) {
    return clsx(
        "w-full px-3 py-2.5 text-sm rounded-xl border bg-white transition-colors outline-none",
        "focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-300",
        error ? "border-red-400 bg-red-50" : "border-surface-400"
    );
}