"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, RefreshCw, X, ChevronRight, AlertCircle, CheckCircle2,
  Loader2, ArrowUpRight, ArrowDownLeft, Search,
} from "lucide-react";
import Header from "@/components/layout/Header";
import {
  PageWrapper, StatusBadge, TableSkeleton, EmptyState,
  SectionTitle, formatCurrency, formatDate,
} from "@/components/ui";
import type { Transaction, Account, TransactionType, TransactionStatus } from "@/types";
import { clsx } from "clsx";

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: TransactionStatus[] = ["pending", "posted", "void"];

const TYPE_OPTIONS: { value: TransactionType; label: string; description: string; color: string }[] = [
  { value: "debit", label: "Debit", description: "Increases assets & expenses; decreases liabilities & equity", color: "text-blue-600" },
  { value: "credit", label: "Credit", description: "Increases liabilities, equity & revenue; decreases assets", color: "text-emerald-600" },
];

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", PKR: "₨", AED: "د.إ",
};

// ── Form types ─────────────────────────────────────────────────────────────────

interface FormFields {
  account_id: string;
  amount: string;
  type: TransactionType | "";
  date: string;
  reference: string;
  description: string;
}

interface FormErrors {
  account_id?: string;
  amount?: string;
  type?: string;
  date?: string;
  reference?: string;
}

const today = () => new Date().toISOString().split("T")[0];

const EMPTY_FORM: FormFields = {
  account_id: "", amount: "", type: "", date: today(), reference: "", description: "",
};

// ── Add Transaction Drawer ─────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (txn: Transaction) => void;
  accounts: Account[];
}

function AddTransactionDrawer({ open, onClose, onSuccess, accounts }: DrawerProps) {
  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const firstInputRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (open) {
      setFields({ ...EMPTY_FORM, date: today() });
      setErrors({});
      setSubmitStatus("idle");
      setServerError("");
      setTimeout(() => firstInputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const set = (key: keyof FormFields, value: string) => {
    setFields((p) => ({ ...p, [key]: value }));
    if (errors[key as keyof FormErrors]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const selectedAccount = accounts.find((a) => a.id === fields.account_id);

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!fields.account_id) next.account_id = "Select an account.";
    if (!fields.type) next.type = "Select debit or credit.";
    if (!fields.date) next.date = "Date is required.";
    if (!fields.reference.trim()) next.reference = "Reference is required.";
    const amt = parseFloat(fields.amount);
    if (!fields.amount) next.amount = "Amount is required.";
    else if (isNaN(amt) || amt <= 0) next.amount = "Enter a valid positive amount.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: fields.account_id,
          amount: parseFloat(fields.amount),
          type: fields.type,
          date: fields.date,
          reference: fields.reference.trim(),
          description: fields.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitStatus("success");
        onSuccess(data.data);
        setTimeout(onClose, 900);
      } else {
        setSubmitStatus("error");
        setServerError(data.message || "Failed to create transaction.");
      }
    } catch {
      setSubmitStatus("error");
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const currencySymbol = CURRENCY_SYMBOL[selectedAccount?.currency ?? "USD"] ?? "$";

  return (
    <>
      <div
        onClick={onClose}
        className={clsx(
          "fixed inset-0 bg-black/30 z-40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />
      <div
        className={clsx(
          "fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Transaction</h2>
            <p className="text-xs text-gray-500 mt-0.5">Record a debit or credit journal entry</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-surface-100 border-b border-surface-200 text-xs text-gray-500">
          <span>Finance</span><ChevronRight className="w-3 h-3" />
          <span>Transactions</span><ChevronRight className="w-3 h-3" />
          <span className="text-gray-700 font-medium">New Entry</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Account */}
          <div>
            <label className="label">Account <span className="text-red-500">*</span></label>
            <select
              ref={firstInputRef}
              value={fields.account_id}
              onChange={(e) => set("account_id", e.target.value)}
              className={clsx("input", errors.account_id && "border-red-400 focus:ring-red-400")}
            >
              <option value="">— Select account —</option>
              {["asset", "liability", "equity", "revenue", "expense"].map((type) => {
                const group = accounts.filter((a) => a.type === type && a.is_active);
                if (!group.length) return null;
                return (
                  <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                    {group.map((a) => (
                      <option key={a.id} value={a.id}>{a.account_code} — {a.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {errors.account_id && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.account_id}
              </p>
            )}
            {selectedAccount && (
              <div className="mt-2 px-3 py-2.5 rounded-lg bg-surface-100 border border-surface-300 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="capitalize font-medium text-gray-600">{selectedAccount.type}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{selectedAccount.currency}</span>
                </div>
                <span className="font-semibold text-gray-800 tabular-nums">
                  Balance: {formatCurrency(selectedAccount.balance, selectedAccount.currency)}
                </span>
              </div>
            )}
          </div>

          {/* Transaction Type */}
          <div>
            <label className="label">Transaction Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("type", opt.value)}
                  className={clsx(
                    "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-150",
                    fields.type === opt.value
                      ? opt.value === "debit"
                        ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300"
                        : "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300"
                      : "border-surface-400 bg-white hover:bg-surface-50"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={clsx(
                      "text-sm font-semibold",
                      fields.type === opt.value ? opt.color : "text-gray-700"
                    )}>
                      {opt.label}
                    </span>
                    {opt.value === "debit"
                      ? <ArrowUpRight className={clsx("w-4 h-4", fields.type === "debit" ? "text-blue-500" : "text-gray-300")} />
                      : <ArrowDownLeft className={clsx("w-4 h-4", fields.type === "credit" ? "text-emerald-500" : "text-gray-300")} />
                    }
                  </div>
                  <p className="text-xs text-gray-500 leading-snug">{opt.description}</p>
                </button>
              ))}
            </div>
            {errors.type && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.type}
              </p>
            )}
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={fields.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0.00"
                  className={clsx("input pl-7 tabular-nums", errors.amount && "border-red-400 focus:ring-red-400")}
                />
              </div>
              {errors.amount && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.amount}
                </p>
              )}
            </div>
            <div>
              <label className="label">Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={fields.date}
                onChange={(e) => set("date", e.target.value)}
                className={clsx("input", errors.date && "border-red-400 focus:ring-red-400")}
              />
              {errors.date && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.date}
                </p>
              )}
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="label">
              Reference <span className="text-red-500">*</span>
              <span className="ml-1 text-xs text-gray-400 font-normal">Journal / doc number</span>
            </label>
            <input
              type="text"
              value={fields.reference}
              onChange={(e) => set("reference", e.target.value)}
              placeholder="e.g. JE-2026-0041"
              className={clsx("input font-mono", errors.reference && "border-red-400 focus:ring-red-400")}
            />
            {errors.reference && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.reference}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="label">
              Description <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={fields.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Narrative or memo for this transaction…"
              rows={3}
              className="input resize-none"
            />
          </div>

          {/* Double-entry reminder */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              <span className="font-semibold">Double-entry reminder:</span> Every debit requires a matching credit on the opposing account to keep the books balanced.
            </p>
          </div>

          {serverError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}
          {submitStatus === "success" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">Transaction recorded successfully!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required fields</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || submitStatus === "success"}
              className="btn-primary min-w-[150px] justify-center"
            >
              {submitting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              ) : submitStatus === "success" ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
              ) : (
                <><Plus className="w-3.5 h-3.5" /> Record Transaction</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Summary bar ────────────────────────────────────────────────────────────────

function SummaryBar({ transactions }: { transactions: Transaction[] }) {
  const totalDebit = transactions.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const totalCredit = transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const balance = totalDebit - totalCredit;

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[
        { label: "Total Debits", value: totalDebit, textColor: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
        { label: "Total Credits", value: totalCredit, textColor: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
        {
          label: "Net Balance", value: balance,
          textColor: balance >= 0 ? "text-blue-700" : "text-red-600",
          bg: balance >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"
        },
      ].map((item) => (
        <div key={item.label} className={clsx("rounded-xl border px-4 py-3 flex items-center justify-between", item.bg)}>
          <span className="text-xs font-medium text-gray-500">{item.label}</span>
          <span className={clsx("text-sm font-bold tabular-nums", item.textColor)}>
            {formatCurrency(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "50" });
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (search) params.set("search", search);
    fetch(`/api/finance/transactions?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) { setTransactions(res.data); setTotal(res.pagination?.totalCount || 0); }
      })
      .finally(() => setLoading(false));
  }, [status, type, dateFrom, dateTo, search]);

  useEffect(() => {
    fetch("/api/finance/accounts?pageSize=200")
      .then((r) => r.json())
      .then((res) => { if (res.success) setAccounts(res.data); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (txn: Transaction) => {
    setTransactions((prev) => [txn, ...prev]);
    setTotal((prev) => prev + 1);
  };

  const totals = {
    dr: transactions.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0),
    cr: transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0),
  };

  return (
    <>
      <Header
        title="Transactions"
        subtitle="Finance Module — Journal Entries"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={() => setDrawerOpen(true)} className="btn-primary">
              <Plus className="w-3.5 h-3.5" /> New Transaction
            </button>
          </div>
        }
      />

      <PageWrapper>
        {!loading && transactions.length > 0 && <SummaryBar transactions={transactions} />}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference…" className="input pl-8 text-xs py-1.5" />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Types</option>
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto text-xs py-1.5">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input !w-auto text-xs py-1.5" title="From date" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input !w-auto text-xs py-1.5" title="To date" />
        </div>

        <SectionTitle title="Journal Entries" count={total} />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-100">
                  <th className="text-left table-header px-4 py-3">Date</th>
                  <th className="text-left table-header px-4 py-3">Reference</th>
                  <th className="text-left table-header px-4 py-3">Account</th>
                  <th className="text-left table-header px-4 py-3">Type</th>
                  <th className="text-right table-header px-4 py-3">Debit</th>
                  <th className="text-right table-header px-4 py-3">Credit</th>
                  <th className="text-left table-header px-4 py-3">Description</th>
                  <th className="text-left table-header px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8}><TableSkeleton rows={8} cols={8} /></td></tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        title="No transactions found"
                        description="Record your first journal entry to get started."
                        action={
                          <button onClick={() => setDrawerOpen(true)} className="btn-primary">
                            <Plus className="w-3.5 h-3.5" /> New Transaction
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(txn.date)}</td>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{txn.reference}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900 font-medium text-xs leading-none">{(txn as any).accounts?.account_code}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{(txn as any).accounts?.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          txn.type === "debit" ? "text-blue-600" : "text-emerald-600"
                        )}>
                          {txn.type === "debit"
                            ? <ArrowUpRight className="w-3 h-3" />
                            : <ArrowDownLeft className="w-3 h-3" />
                          }
                          {txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-700 font-medium">
                        {txn.type === "debit" ? formatCurrency(txn.amount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700 font-medium">
                        {txn.type === "credit" ? formatCurrency(txn.amount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                        {txn.description || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={txn.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Totals footer */}
              {!loading && transactions.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-surface-300 bg-surface-100">
                    <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Page Totals
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-700">
                      {formatCurrency(totals.dr)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-700">
                      {formatCurrency(totals.cr)}
                    </td>
                    <td colSpan={2} className="px-4 py-3 text-right text-xs">
                      {totals.dr === totals.cr ? (
                        <span className="text-emerald-600 font-medium flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Balanced
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium flex items-center justify-end gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Out of balance by {formatCurrency(Math.abs(totals.dr - totals.cr))}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </PageWrapper>

      <AddTransactionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={handleCreated}
        accounts={accounts}
      />
    </>
  );
}