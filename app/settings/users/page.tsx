"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    Plus, RefreshCw, Search, X, ChevronRight, CheckCircle2,
    Loader2, AlertCircle, Lock, Shield, UserCircle, Power,
    PowerOff, Mail, KeyRound,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { PageWrapper, TableSkeleton, EmptyState, SectionTitle, formatDate } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { getRoleLabel } from "@/lib/utils/rbac";
import type { User, UserRole } from "@/types";
import { clsx } from "clsx";

// ── Role config ────────────────────────────────────────────────────────────────
const ROLES: UserRole[] = [
    "super_admin", "finance_manager", "hr_manager", "inventory_manager",
    "procurement_officer", "sales_executive", "production_manager", "viewer",
];

const ROLE_COLORS: Record<UserRole, string> = {
    super_admin: "bg-purple-50 text-purple-700 border-purple-200",
    finance_manager: "bg-emerald-50 text-emerald-700 border-emerald-200",
    hr_manager: "bg-blue-50 text-blue-700 border-blue-200",
    inventory_manager: "bg-amber-50 text-amber-700 border-amber-200",
    procurement_officer: "bg-teal-50 text-teal-700 border-teal-200",
    sales_executive: "bg-brand-50 text-brand-700 border-brand-200",
    production_manager: "bg-orange-50 text-orange-700 border-orange-200",
    viewer: "bg-gray-100 text-gray-600 border-gray-200",
};

function RoleBadge({ role }: { role: UserRole }) {
    return (
        <span className={clsx("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", ROLE_COLORS[role])}>
            <Shield className="w-2.5 h-2.5" />{getRoleLabel(role)}
        </span>
    );
}

// ── Drawer shell ───────────────────────────────────────────────────────────────
function Drawer({ open, onClose, title, subtitle, children }: {
    open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode;
}) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [onClose]);
    return (
        <>
            <div onClick={onClose} className={clsx("fixed inset-0 bg-black/30 z-40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0 pointer-events-none")} />
            <div className={clsx("fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[380px]">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-1.5 px-6 py-2 bg-surface-100 border-b border-surface-200 text-xs text-gray-500 flex-shrink-0">
                    <span>Settings</span><ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Users & Roles</span>
                </div>
                {children}
            </div>
        </>
    );
}

function Footer({ onCancel, onSubmit, busy, ok, label, disabled }: {
    onCancel: () => void; onSubmit: () => void; busy: boolean; ok: boolean; label: string; disabled?: boolean;
}) {
    return (
        <div className="px-6 py-4 border-t border-surface-300 bg-surface-50 flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required</p>
            <div className="flex gap-2">
                <button onClick={onCancel} className="btn-secondary" disabled={busy}>Cancel</button>
                <button onClick={onSubmit} disabled={busy || ok || disabled} className="btn-primary min-w-[130px] justify-center">
                    {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : ok ? <><CheckCircle2 className="w-3.5 h-3.5" />Saved!</> : label}
                </button>
            </div>
        </div>
    );
}

// ── Invite User Drawer ─────────────────────────────────────────────────────────
function InviteDrawer({ open, onClose, onSuccess }: {
    open: boolean; onClose: () => void; onSuccess: (u: User) => void;
}) {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<UserRole>("viewer");
    const [busy, setBusy] = useState(false);
    const [ok, setOk] = useState(false);
    const [err, setErr] = useState("");
    const firstRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) { setFullName(""); setEmail(""); setRole("viewer"); setErr(""); setOk(false); setTimeout(() => firstRef.current?.focus(), 120); }
    }, [open]);

    const handleSubmit = async () => {
        if (!fullName.trim()) { setErr("Full name is required."); return; }
        if (!email.trim()) { setErr("Email is required."); return; }
        setBusy(true); setErr("");
        try {
            const res = await fetch("/api/settings/users", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ full_name: fullName, email, role }),
            });
            const data = await res.json();
            if (data.success) { setOk(true); onSuccess(data.data); setTimeout(onClose, 900); }
            else setErr(data.message || "Failed to invite user.");
        } catch { setErr("Network error."); }
        finally { setBusy(false); }
    };

    return (
        <Drawer open={open} onClose={onClose} title="Invite User" subtitle="Send an invite email with a set-password link">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div>
                    <label className="label">Full Name <span className="text-red-500">*</span></label>
                    <input ref={firstRef} type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Sarah Ahmed" className="input" />
                </div>
                <div>
                    <label className="label">Email Address <span className="text-red-500">*</span></label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="sarah@company.com" className="input" />
                </div>
                <div>
                    <label className="label">Role</label>
                    <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input">
                        {ROLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                    </select>
                    <p className="mt-1.5 text-xs text-gray-400">The user's permissions are based on their role. This can be changed later.</p>
                </div>

                {/* Role permission summary */}
                <div className="p-3 rounded-lg bg-surface-100 border border-surface-300">
                    <p className="text-xs font-medium text-gray-700 mb-2">{getRoleLabel(role)} — module access</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {["Finance", "HR", "Inventory", "Procurement", "Sales", "Production", "Reporting"].map((mod) => {
                            const modKey = mod.toLowerCase().replace(" & crm", "").replace("human resources", "hr") as any;
                            const hasAccess = role === "super_admin" || role === `${modKey}_manager` || role === `${modKey}_officer` || role === `${modKey}_executive`;
                            return (
                                <div key={mod} className="flex items-center gap-1.5 text-xs">
                                    <span className={hasAccess ? "text-emerald-500" : "text-gray-300"}>
                                        {hasAccess ? "✓" : "✗"}
                                    </span>
                                    <span className={hasAccess ? "text-gray-700" : "text-gray-400"}>{mod}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{err}</div>}
                {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Invite sent to {email}!</div>}
            </div>
            <Footer onCancel={onClose} onSubmit={handleSubmit} busy={busy} ok={ok} label="Send Invite" />
        </Drawer>
    );
}

// ── Edit User Drawer ───────────────────────────────────────────────────────────
function EditUserDrawer({ editUser, onClose, onSuccess, currentUserId }: {
    editUser: User | null; onClose: () => void; onSuccess: (u: User) => void; currentUserId?: string;
}) {
    const open = !!editUser;
    const [role, setRole] = useState<UserRole>("viewer");
    const [busy, setBusy] = useState(false);
    const [ok, setOk] = useState(false);
    const [err, setErr] = useState("");
    const [toggling, setToggling] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [confirmToggle, setConfirmToggle] = useState(false);
    const [actionMsg, setActionMsg] = useState("");

    useEffect(() => {
        if (editUser) { setRole(editUser.role); setOk(false); setErr(""); setConfirmToggle(false); setActionMsg(""); }
    }, [editUser]);

    const handleSave = async () => {
        if (!editUser) return;
        setBusy(true); setErr("");
        try {
            const res = await fetch(`/api/settings/users/${editUser.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (data.success) { setOk(true); onSuccess(data.data); setTimeout(() => setOk(false), 2000); }
            else setErr(data.message || "Update failed.");
        } catch { setErr("Network error."); }
        finally { setBusy(false); }
    };

    const handleToggle = async () => {
        if (!editUser) return;
        setToggling(true); setErr("");
        try {
            const res = await fetch(`/api/settings/users/${editUser.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: !editUser.is_active }),
            });
            const data = await res.json();
            if (data.success) { onSuccess(data.data); setTimeout(onClose, 300); }
            else setErr(data.message || "Failed.");
        } catch { setErr("Network error."); }
        finally { setToggling(false); setConfirmToggle(false); }
    };

    const handleResetPassword = async () => {
        if (!editUser) return;
        setResetting(true); setErr(""); setActionMsg("");
        try {
            const res = await fetch(`/api/settings/users/${editUser.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reset_password" }),
            });
            const data = await res.json();
            if (data.success) setActionMsg("Password reset email sent.");
            else setErr(data.message || "Failed.");
        } catch { setErr("Network error."); }
        finally { setResetting(false); }
    };

    const isSelf = editUser?.id === currentUserId;

    return (
        <Drawer open={open} onClose={onClose} title="Edit User"
            subtitle={editUser ? `${editUser.full_name} · ${editUser.email}` : ""}>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {editUser && (
                    <>
                        {/* Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                                editUser.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-500")}>
                                <span className={clsx("w-1.5 h-1.5 rounded-full", editUser.is_active ? "bg-emerald-500" : "bg-gray-400")} />
                                {editUser.is_active ? "Active" : "Inactive"}
                            </span>
                            <RoleBadge role={editUser.role} />
                            {isSelf && <span className="badge bg-brand-50 text-brand-700 text-xs">You</span>}
                        </div>

                        {/* Read-only fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Full Name</label>
                                <input type="text" value={editUser.full_name} disabled className="input opacity-60 cursor-not-allowed bg-surface-200" />
                            </div>
                            <div>
                                <label className="label">Email</label>
                                <input type="email" value={editUser.email} disabled className="input opacity-60 cursor-not-allowed bg-surface-200" />
                            </div>
                        </div>

                        {/* Role */}
                        <div>
                            <label className="label">Role</label>
                            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input">
                                {ROLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                            </select>
                            {isSelf && role !== "super_admin" && (
                                <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />Removing your own super_admin role will lock you out of this page.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                            <div><span className="text-gray-400">Last login:</span><br /><span className="font-medium text-gray-700">{editUser.last_login ? formatDate(editUser.last_login) : "Never"}</span></div>
                            <div><span className="text-gray-400">Member since:</span><br /><span className="font-medium text-gray-700">{formatDate(editUser.created_at)}</span></div>
                        </div>

                        {/* Actions */}
                        <div className="pt-2 border-t border-surface-300 space-y-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>

                            {/* Reset password */}
                            <button onClick={handleResetPassword} disabled={resetting}
                                className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors">
                                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                                Send password reset email
                            </button>

                            {actionMsg && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{actionMsg}</p>}

                            {/* Toggle active */}
                            {!isSelf && (
                                editUser.is_active ? (
                                    !confirmToggle ? (
                                        <button onClick={() => setConfirmToggle(true)}
                                            className="flex items-center gap-2 text-xs font-medium text-red-500 hover:text-red-700 transition-colors">
                                            <PowerOff className="w-3.5 h-3.5" /> Deactivate user
                                        </button>
                                    ) : (
                                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                                            <p className="text-xs text-red-700 font-medium">Deactivate <strong>{editUser.full_name}</strong>? They will be unable to log in.</p>
                                            <div className="flex gap-2">
                                                <button onClick={handleToggle} disabled={toggling} className="btn-danger text-xs py-1.5 px-3">{toggling ? "Deactivating…" : "Confirm"}</button>
                                                <button onClick={() => setConfirmToggle(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <button onClick={handleToggle} disabled={toggling}
                                        className="flex items-center gap-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                                        <Power className="w-3.5 h-3.5" /> Reactivate user
                                    </button>
                                )
                            )}
                        </div>
                    </>
                )}
                {err && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{err}</div>}
                {ok && <div className="flex gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" />Role updated!</div>}
            </div>
            <Footer onCancel={onClose} onSubmit={handleSave} busy={busy} ok={ok} label="Save Changes" />
        </Drawer>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function UsersPage() {
    const { user: currentUser, loading: authLoading } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [search, setSearch] = useState("");

    const isSuperAdmin = currentUser?.role === "super_admin";

    const load = useCallback(() => {
        if (!isSuperAdmin) { setLoading(false); return; }
        setLoading(true);
        const p = new URLSearchParams({ pageSize: "100" });
        if (search) p.set("search", search);
        fetch(`/api/settings/users?${p}`)
            .then((r) => r.json())
            .then((res) => { if (res.success) { setUsers(res.data); setTotal(res.pagination?.totalCount || 0); } })
            .finally(() => setLoading(false));
    }, [search, isSuperAdmin]);

    useEffect(() => { if (!authLoading) load(); }, [load, authLoading]);

    const handleAdded = (u: User) => { setUsers((p) => [u, ...p]); setTotal((t) => t + 1); };
    const handleUpdated = (u: User) => { setUsers((p) => p.map((x) => x.id === u.id ? u : x)); setEditUser(u); };

    if (!authLoading && !isSuperAdmin) {
        return (
            <>
                <Header title="Users & Roles" subtitle="Settings" />
                <PageWrapper>
                    <div className="card p-12 flex flex-col items-center gap-3 text-center">
                        <Lock className="w-10 h-10 text-gray-300" />
                        <div>
                            <p className="text-sm font-medium text-gray-600">Super Admin access required</p>
                            <p className="text-xs text-gray-400 mt-1">Only super admins can manage users and roles.</p>
                        </div>
                    </div>
                </PageWrapper>
            </>
        );
    }

    const summary = {
        active: users.filter((u) => u.is_active).length,
        inactive: users.filter((u) => !u.is_active).length,
        byRole: ROLES.map((r) => ({ role: r, count: users.filter((u) => u.role === r && u.is_active).length })).filter((r) => r.count > 0),
    };

    return (
        <>
            <Header title="Users & Roles" subtitle="Settings"
                actions={
                    <div className="flex items-center gap-2">
                        <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
                        <button onClick={() => setInviteOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />Invite User</button>
                    </div>
                }
            />
            <PageWrapper>
                {!loading && (
                    <div className="grid grid-cols-4 gap-3 mb-4">
                        <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
                            <span className="text-xs text-gray-500">Active Users</span>
                            <span className="text-2xl font-bold text-gray-900">{summary.active}</span>
                        </div>
                        <div className="rounded-xl border border-surface-300 bg-white px-4 py-3 flex items-center justify-between">
                            <span className="text-xs text-gray-500">Inactive</span>
                            <span className="text-2xl font-bold text-gray-400">{summary.inactive}</span>
                        </div>
                        <div className="col-span-2 rounded-xl border border-surface-300 bg-white px-4 py-3">
                            <p className="text-xs text-gray-500 mb-2">Active by Role</p>
                            <div className="flex flex-wrap gap-1.5">
                                {summary.byRole.map(({ role, count }) => (
                                    <span key={role} className={clsx("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", ROLE_COLORS[role])}>
                                        {count} {getRoleLabel(role)}
                                    </span>
                                ))}
                                {!summary.byRole.length && <span className="text-xs text-gray-400">No users yet</span>}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1 min-w-[160px] max-w-[280px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name or email…" className="input pl-8 text-xs py-1.5" />
                    </div>
                </div>

                <SectionTitle title="System Users" count={total} />

                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-200 bg-surface-100">
                                    {["User", "Email", "Role", "Last Login", "Status", ""].map((h) => (
                                        <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? <tr><td colSpan={6}><TableSkeleton rows={5} cols={6} /></td></tr>
                                    : users.length === 0 ? (
                                        <tr><td colSpan={6}>
                                            <EmptyState title="No users found" description="Invite a user to get started."
                                                action={<button onClick={() => setInviteOpen(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" />Invite User</button>} />
                                        </td></tr>
                                    ) : users.map((u) => (
                                        <tr key={u.id} onClick={() => setEditUser(u)}
                                            className={clsx("border-b border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer group", !u.is_active && "opacity-50")}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xs font-bold text-brand-700">
                                                            {u.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-xs">{u.full_name}</p>
                                                        {u.id === currentUser?.id && <span className="text-xs text-brand-600 font-medium">You</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 flex items-center gap-1.5 mt-2">
                                                <Mail className="w-3 h-3 text-gray-400" />{u.email}
                                            </td>
                                            <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                                            <td className="px-4 py-3 text-xs text-gray-500">{u.last_login ? formatDate(u.last_login) : <span className="text-gray-300">Never</span>}</td>
                                            <td className="px-4 py-3">
                                                <span className={clsx("badge text-xs", u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400")}>
                                                    {u.is_active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <UserCircle className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" />
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </PageWrapper>

            <InviteDrawer open={inviteOpen} onClose={() => setInviteOpen(false)} onSuccess={handleAdded} />
            <EditUserDrawer editUser={editUser} onClose={() => setEditUser(null)} onSuccess={handleUpdated} currentUserId={currentUser?.id} />
        </>
    );
}