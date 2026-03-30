import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status },
  );
}

export function fromZodError(e: ZodError): NextResponse<ApiErrorBody> {
  return fail("VALIDATION_ERROR", "Invalid request body or query", 422, e.flatten());
}
