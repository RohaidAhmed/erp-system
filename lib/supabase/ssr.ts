import { createServerClient as _createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Use inside Server Components, Route Handlers, and Server Actions.
 * Reads/writes cookies so the session stays in sync.
 */
export function createSupabaseServerClient() {
    const cookieStore = cookies();
    return _createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value; },
                set(name: string, value: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value, ...options }); } catch { }
                },
                remove(name: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value: "", ...options }); } catch { }
                },
            },
        }
    );
}