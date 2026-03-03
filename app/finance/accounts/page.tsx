"use client";

import { useEffect, useState, useRef } from "react";
import {
    Plus,
    RefreshCw,
    X,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    Loader2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import {
    PageWrapper,
    StatusBadge,
    TableSkeleton,
    EmptyState,
    SectionTitle,
    formatCurrency,
} from "@/components/ui";
import type { Account, AccountType, Currency } from "@/types";
import { clsx } from "clsx";

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
    asset: "bg-blue-50 text-blue-700",
    liability: "bg-red-50 text-red-700",
    equity: "bg-purple-50 text-purple-700",
    revenue: "bg-green-50 text-green-700",
    expense: "bg-orange-50 text-orange-700",
};

const ACCOUNT_TYPES: {
    value: AccountType;
    label: string;
    description: string;
}[] = [
        {
            value: "asset",
            label: "Asset",
            description: "Resources owned by the business",
        },
        {
            value: "liability",
            label: "Liability",
            description: "Obligations owed to others",
        },
        {
            value: "equity",
            label: "Equity",
            description: "Owner's interest in the business",
        },
        {
            value: "revenue",
            label: "Revenue",
            description: "Income from business operations",
        },
        {
            value: "expense",
            label: "Expense",
            description: "Costs incurred in operations",
        },
    ];

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR", "AED"];

// ── Form state type ────────────────────────────────────────────────────────────

interface FormFields {
    account_code: string;
    name: string;
    type: AccountType | "";
    currency: Currency;
    parent_id: string;
    description: string;
}

interface FormErrors {
    account_code?: string;
    name?: string;
    type?: string;
}

const EMPTY_FORM: FormFields = {
    account_code: "",
    name: "",
    type: "",
    currency: "USD",
    parent_id: "",
    description: "",
};

// ── Add Account Drawer ─────────────────────────────────────────────────────────

interface AddAccountDrawerProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (account: Account) => void;
    existingAccounts: Account[];
}

function AddAccountDrawer({
    open,
    onClose,
    onSuccess,
    existingAccounts,
}: AddAccountDrawerProps) {
    const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<
        "idle" | "success" | "error"
    >("idle");
    const [serverError, setServerError] = useState("");
    const firstInputRef = useRef<HTMLInputElement>(null);

    // Focus first input when drawer opens
    useEffect(() => {
        if (open) {
            setTimeout(() => firstInputRef.current?.focus(), 120);
            setFields(EMPTY_FORM);
            setErrors({});
            setSubmitStatus("idle");
            setServerError("");
        }
    }, [open]);

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const set = (key: keyof FormFields, value: string) => {
        setFields((prev) => ({ ...prev, [key]: value }));
        if (errors[key as keyof FormErrors]) {
            setErrors((prev) => ({ ...prev, [key]: undefined }));
        }
    };

    const validate = (): boolean => {
        const next: FormErrors = {};
        if (!fields.account_code.trim())
            next.account_code = "Account code is required.";
        else if (!/^[A-Za-z0-9\-_.]+$/.test(fields.account_code.trim()))
            next.account_code =
                "Only letters, numbers, hyphens, underscores allowed.";
        if (!fields.name.trim()) next.name = "Account name is required.";
        if (!fields.type) next.type = "Please select an account type.";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        setServerError("");
        try {
            const res = await fetch("/api/finance/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    account_code: fields.account_code.trim(),
                    name: fields.name.trim(),
                    type: fields.type,
                    currency: fields.currency,
                    parent_id: fields.parent_id || undefined,
                    description: fields.description.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSubmitStatus("success");
                onSuccess(data.data);
                setTimeout(onClose, 1000);
            } else {
                setSubmitStatus("error");
                setServerError(data.message || "Failed to create account.");
            }
        } catch {
            setSubmitStatus("error");
            setServerError("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    // Parent accounts: only same type or empty (for sub-accounts)
    const parentOptions = existingAccounts.filter(
        (a) => !fields.type || a.type === fields.type,
    );

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                className={clsx(
                    "fixed inset-0 bg-black/30 z-40 transition-opacity duration-300",
                    open ? "opacity-100" : "opacity-0 pointer-events-none",
                )}
            />

            {/* Drawer panel */}
            <div
                className={clsx(
                    "fixed top-0 right-0 h-full w-[440px] bg-white shadow-2xl z-50 flex flex-col",
                    "transition-transform duration-300 ease-in-out",
                    open ? "translate-x-0" : "translate-x-full",
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">
                            Add Account
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Create a new chart of accounts entry
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 px-6 py-2.5 bg-surface-100 border-b border-surface-200 text-xs text-gray-500">
                    <span>Finance</span>
                    <ChevronRight className="w-3 h-3" />
                    <span>Chart of Accounts</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-gray-700 font-medium">New Account</span>
                </div>

                {/* Form body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Account Code + Name (side by side) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">
                                Account Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                ref={firstInputRef}
                                type="text"
                                value={fields.account_code}
                                onChange={(e) => set("account_code", e.target.value)}
                                placeholder="e.g. 1001"
                                className={clsx(
                                    "input font-mono",
                                    errors.account_code && "border-red-400 focus:ring-red-400",
                                )}
                            />
                            {errors.account_code && (
                                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {errors.account_code}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="label">Currency</label>
                            <select
                                value={fields.currency}
                                onChange={(e) => set("currency", e.target.value)}
                                className="input"
                            >
                                {CURRENCIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Account Name */}
                    <div>
                        <label className="label">
                            Account Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={fields.name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="e.g. Cash and Cash Equivalents"
                            className={clsx(
                                "input",
                                errors.name && "border-red-400 focus:ring-red-400",
                            )}
                        />
                        {errors.name && (
                            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {errors.name}
                            </p>
                        )}
                    </div>

                    {/* Account Type — card selector */}
                    <div>
                        <label className="label">
                            Account Type <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {ACCOUNT_TYPES.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        set("type", opt.value);
                                        set("parent_id", "");
                                    }}
                                    className={clsx(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all duration-150",
                                        fields.type === opt.value
                                            ? "border-brand-500 bg-brand-50 ring-1 ring-brand-400"
                                            : "border-surface-400 bg-white hover:border-surface-500 hover:bg-surface-50",
                                    )}
                                >
                                    <span
                                        className={clsx(
                                            "w-2 h-2 rounded-full flex-shrink-0",
                                            fields.type === opt.value
                                                ? "bg-brand-500"
                                                : "bg-surface-400",
                                        )}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className={clsx(
                                                "text-sm font-medium",
                                                fields.type === opt.value
                                                    ? "text-brand-700"
                                                    : "text-gray-700",
                                            )}
                                        >
                                            {opt.label}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {opt.description}
                                        </p>
                                    </div>
                                    {fields.type === opt.value && (
                                        <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                                    )}
                                </button>
                            ))}
                        </div>
                        {errors.type && (
                            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {errors.type}
                            </p>
                        )}
                    </div>

                    {/* Parent Account */}
                    <div>
                        <label className="label">
                            Parent Account{" "}
                            <span className="text-xs text-gray-400 font-normal">
                                (optional)
                            </span>
                        </label>
                        <select
                            value={fields.parent_id}
                            onChange={(e) => set("parent_id", e.target.value)}
                            disabled={!fields.type}
                            className={clsx(
                                "input",
                                !fields.type && "opacity-50 cursor-not-allowed",
                            )}
                        >
                            <option value="">— None (top-level account) —</option>
                            {parentOptions.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.account_code} — {a.name}
                                </option>
                            ))}
                        </select>
                        {!fields.type && (
                            <p className="mt-1 text-xs text-gray-400">
                                Select a type first to see available parent accounts.
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="label">
                            Description{" "}
                            <span className="text-xs text-gray-400 font-normal">
                                (optional)
                            </span>
                        </label>
                        <textarea
                            value={fields.description}
                            onChange={(e) => set("description", e.target.value)}
                            placeholder="Brief description of this account's purpose…"
                            rows={3}
                            className="input resize-none"
                        />
                    </div>

                    {/* Server error */}
                    {serverError && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{serverError}</p>
                        </div>
                    )}

                    {/* Success message */}
                    {submitStatus === "success" && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <p className="text-sm text-emerald-700 font-medium">
                                Account created successfully!
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">
                        <span className="text-red-500">*</span> Required fields
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="btn-secondary"
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || submitStatus === "success"}
                            className="btn-primary min-w-[120px] justify-center"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
                                </>
                            ) : submitStatus === "success" ? (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
                                </>
                            ) : (
                                <>
                                    <Plus className="w-3.5 h-3.5" /> Create Account
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const load = () => {
        setLoading(true);
        fetch("/api/finance/accounts?pageSize=50")
            .then((r) => r.json())
            .then((res) => {
                if (res.success) {
                    setAccounts(res.data);
                    setTotal(res.pagination?.totalCount || 0);
                }
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const handleAccountCreated = (newAccount: Account) => {
        setAccounts((prev) => [newAccount, ...prev]);
        setTotal((prev) => prev + 1);
    };

    return (
        <>
            <Header
                title="Chart of Accounts"
                subtitle="Finance Module"
                actions={
                    <div className="flex items-center gap-2">
                        <button onClick={load} className="btn-secondary">
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </button>
                        <button onClick={() => setDrawerOpen(true)} className="btn-primary">
                            <Plus className="w-3.5 h-3.5" /> New Account
                        </button>
                    </div>
                }
            />

            <PageWrapper>
                <SectionTitle title="Accounts" count={total} />
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-100">
                                    <th className="text-left table-header px-4 py-3">Code</th>
                                    <th className="text-left table-header px-4 py-3">Name</th>
                                    <th className="text-left table-header px-4 py-3">Type</th>
                                    <th className="text-right table-header px-4 py-3">Balance</th>
                                    <th className="text-left table-header px-4 py-3">Currency</th>
                                    <th className="text-left table-header px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6}>
                                            <TableSkeleton rows={8} cols={6} />
                                        </td>
                                    </tr>
                                ) : accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>
                                            <EmptyState
                                                title="No accounts found"
                                                description="Create your first account to get started."
                                                action={
                                                    <button
                                                        onClick={() => setDrawerOpen(true)}
                                                        className="btn-primary"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> New Account
                                                    </button>
                                                }
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    accounts.map((acc) => (
                                        <tr
                                            key={acc.id}
                                            className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-4 py-3 font-mono text-xs text-gray-600">
                                                {acc.account_code}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {acc.name}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`badge capitalize ${TYPE_COLORS[acc.type] || "bg-gray-100 text-gray-600"}`}
                                                >
                                                    {acc.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium tabular-nums">
                                                {formatCurrency(acc.balance, acc.currency)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {acc.currency}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge
                                                    status={acc.is_active ? "active" : "terminated"}
                                                    label={acc.is_active ? "Active" : "Inactive"}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </PageWrapper>

            <AddAccountDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onSuccess={handleAccountCreated}
                existingAccounts={accounts}
            />
        </>
    );
}
