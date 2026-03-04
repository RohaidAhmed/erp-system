"use client";

import { useEffect } from "react";
import { X, ChevronRight, Lock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { clsx } from "clsx";

// ── Drawer shell ───────────────────────────────────────────────────────────────

export function Drawer({
    open, onClose, title, subtitle, breadcrumb, width = "w-[500px]", children,
}: {
    open: boolean; onClose: () => void;
    title: string; subtitle?: string; breadcrumb: string;
    width?: string; children: React.ReactNode;
}) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    return (
        <>
            <div onClick={onClose} className={clsx(
                "fixed inset-0 bg-black/30 z-40 transition-opacity duration-300",
                open ? "opacity-100" : "opacity-0 pointer-events-none"
            )} />
            <div className={clsx(
                "fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col",
                "transition-transform duration-300 ease-in-out",
                open ? "translate-x-0" : "translate-x-full",
                width
            )}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-1.5 px-6 py-2.5 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
                    <span>HR</span><ChevronRight className="w-3 h-3" />
                    <span className="text-gray-700 font-medium">{breadcrumb}</span>
                </div>
                {children}
            </div>
        </>
    );
}

// ── Drawer footer ──────────────────────────────────────────────────────────────

export function DrawerFooter({
    onCancel, onSubmit, submitting, success, submitLabel, disabled,
}: {
    onCancel: () => void; onSubmit: () => void;
    submitting: boolean; success: boolean; submitLabel: string; disabled?: boolean;
}) {
    return (
        <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required fields</p>
            <div className="flex items-center gap-2">
                <button onClick={onCancel} className="btn-secondary" disabled={submitting}>Cancel</button>
                <button
                    onClick={onSubmit}
                    disabled={submitting || success || disabled}
                    className="btn-primary min-w-[130px] justify-center"
                >
                    {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                        : success ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
                            : submitLabel}
                </button>
            </div>
        </div>
    );
}

// ── Status action button ───────────────────────────────────────────────────────

export function StatusActionButton({
    label, icon: Icon, colorClass, onClick, loading, disabled, restricted, requiresRole,
}: {
    label: string; icon: React.ElementType; colorClass: string;
    onClick: () => void; loading?: boolean; disabled?: boolean;
    restricted?: boolean; requiresRole?: string;
}) {
    return (
        <button
            onClick={() => !restricted && !disabled && onClick()}
            disabled={disabled || loading}
            className={clsx(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                restricted || disabled
                    ? "border-surface-300 text-gray-300 cursor-not-allowed bg-surface-50"
                    : "border-surface-400 hover:border-surface-500 hover:bg-surface-50 text-gray-700"
            )}
        >
            <span className={clsx("flex items-center gap-2", restricted || disabled ? "text-gray-300" : colorClass)}>
                <Icon className="w-4 h-4" />
                {label}
            </span>
            {loading
                ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                : restricted
                    ? <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />{requiresRole || "Restricted"}
                    </span>
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
            }
        </button>
    );
}

// ── Banner components ──────────────────────────────────────────────────────────

export function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{message}</p>
        </div>
    );
}

export function SuccessBanner({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">{message}</p>
        </div>
    );
}

export function AccessDeniedBanner({ action, role }: { action: string; role?: string }) {
    return (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
                <p className="text-sm font-medium text-amber-800">Permission required</p>
                <p className="text-xs text-amber-600 mt-0.5">
                    Your role cannot <strong>{action}</strong>.{role && ` Requires: ${role}.`}
                </p>
            </div>
        </div>
    );
}

// ── Auth info strip ────────────────────────────────────────────────────────────

export function AuthStrip({ userName, userRole, permissions }: {
    userName: string; userRole: string;
    permissions: { label: string; allowed: boolean }[];
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{userName}</span>
            <span>·</span>
            <span className="capitalize">{userRole.replace(/_/g, " ")}</span>
            {permissions.map((p) => (
                <span key={p.label} className={p.allowed ? "text-emerald-600" : "text-gray-400"}>
                    {p.allowed ? "✓" : "✗"} {p.label}
                </span>
            ))}
        </div>
    );
}

// ── Form field helpers ─────────────────────────────────────────────────────────

export function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {message}
        </p>
    );
}

export function ToggleSwitch({ checked, onChange, label, description }: {
    checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
    return (
        <div className="flex items-center justify-between px-3 py-3 rounded-lg border border-surface-300 bg-surface-50">
            <div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
                {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={clsx(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200",
                    checked ? "bg-brand-600" : "bg-gray-300"
                )}
            >
                <span className={clsx(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
                    checked ? "translate-x-4" : "translate-x-1"
                )} />
            </button>
        </div>
    );
}