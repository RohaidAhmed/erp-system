"use client";

/**
 * useAuth — client-side auth hook
 *
 * In production, replace the mock session with a real Supabase session:
 *
 *   import { createClient } from "@/lib/supabase/client";
 *   const supabase = createClient();
 *   const { data: { session } } = await supabase.auth.getSession();
 *   // then fetch the user row from public.users by session.user.id
 *
 * The hook exposes the user object and permission helpers so every page
 * can gate UI elements and actions without duplicating RBAC logic.
 */

import { useState, useEffect } from "react";
import type { User, UserRole } from "@/types";
import { hasPermission, canView, canCreate, canApprove } from "@/lib/utils/rbac";

type Module = "finance" | "hr" | "inventory" | "procurement" | "sales" | "production" | "reporting";

// ── Mock session ───────────────────────────────────────────────────────────────
// Replace this with a real Supabase auth call in production.
const MOCK_USER: User = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@erp.local",
    full_name: "Admin User",
    role: "super_admin",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate async session fetch
        const timer = setTimeout(() => {
            setUser(MOCK_USER);
            setLoading(false);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const role = user?.role as UserRole | undefined;

    return {
        user,
        loading,
        role,

        // Permission helpers — all return false while loading (safe default)
        can: {
            view: (mod: Module) => !!role && canView(role, mod),
            create: (mod: Module) => !!role && canCreate(role, mod),
            edit: (mod: Module) => !!role && hasPermission(role, mod, "edit"),
            approve: (mod: Module) => !!role && canApprove(role, mod),
            full: (mod: Module) => !!role && hasPermission(role, mod, "full"),
        },

        // Finance-specific invoice permissions
        invoice: {
            canCreate: () => !!role && (hasPermission(role, "finance", "full") || hasPermission(role, "finance", "create")),
            canEdit: () => !!role && (hasPermission(role, "finance", "full") || hasPermission(role, "finance", "edit")),
            canApprove: () => !!role && (hasPermission(role, "finance", "full") || hasPermission(role, "finance", "approve")),
            canVoid: () => !!role && hasPermission(role, "finance", "full"), // only finance_manager / super_admin
        },
    };
}