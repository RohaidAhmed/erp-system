export function dayCount(s: string, e: string): number {
    if (!s || !e || e < s) return 0;
    return Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24)) + 1;
}