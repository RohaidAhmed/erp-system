"use client";

import { useState, useEffect, useCallback } from "react";
import type { ApiResponse, Pagination } from "@/types";

interface UseFetchOptions {
  params?: Record<string, string>;
  enabled?: boolean;
}

interface UseFetchResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  pagination: Pagination | null;
  refetch: () => void;
  setParam: (key: string, value: string) => void;
}

export function useFetch<T>(endpoint: string, options: UseFetchOptions = {}): UseFetchResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [params, setParams] = useState<Record<string, string>>(options.params || {});

  const refetch = useCallback(() => {
    if (options.enabled === false) return;
    setLoading(true);
    setError(null);
    const searchParams = new URLSearchParams(params);
    fetch(`${endpoint}?${searchParams}`)
      .then((r) => r.json())
      .then((res: ApiResponse<T[]>) => {
        if (res.success && res.data) {
          setData(res.data);
          setPagination(res.pagination || null);
        } else {
          setError(res.message || "Failed to load data.");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [endpoint, params, options.enabled]);

  useEffect(() => { refetch(); }, [refetch]);

  const setParam = useCallback((key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { data, loading, error, pagination, refetch, setParam };
}

// Mutation hook
export function useMutation<TInput, TOutput>(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST"
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body?: TInput): Promise<ApiResponse<TOutput>> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data: ApiResponse<TOutput> = await res.json();
        if (!data.success) setError(data.message);
        return data;
      } catch (e: any) {
        setError(e.message);
        return { success: false, data: null, message: e.message, errors: [], timestamp: new Date().toISOString() };
      } finally {
        setLoading(false);
      }
    },
    [endpoint, method]
  );

  return { mutate, loading, error };
}
