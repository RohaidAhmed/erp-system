import { NextResponse } from "next/server";
import type { ApiResponse, Pagination } from "@/types";

export function apiSuccess<T>(
  data: T,
  message = "Operation completed successfully",
  pagination?: Pagination,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      pagination,
      errors: [],
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function apiError(
  message: string,
  errors: { field: string; message: string }[] = [],
  status = 400
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      message,
      errors,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function apiUnauthorized(): NextResponse<ApiResponse<null>> {
  return apiError("Unauthorized. Valid authentication token required.", [], 401);
}

export function apiNotFound(resource = "Resource"): NextResponse<ApiResponse<null>> {
  return apiError(`${resource} not found.`, [], 404);
}

export function apiServerError(err: unknown): NextResponse<ApiResponse<null>> {
  console.error("[API Error]", err);
  return apiError("An internal server error occurred.", [], 500);
}

export function getPagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

export function buildPagination(page: number, pageSize: number, totalCount: number): Pagination {
  return {
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}
