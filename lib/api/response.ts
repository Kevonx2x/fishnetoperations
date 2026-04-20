import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; field?: string; details?: unknown };
};

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
  field?: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(field ? { field } : {}),
        details,
      },
    },
    { status },
  );
}

export function fromZodError(e: ZodError): NextResponse<ApiErrorBody> {
  const flat = e.flatten();
  const first = e.issues[0];
  const field =
    first && first.path.length > 0 ? first.path.map(String).join(".") : undefined;
  const message = first?.message ?? "Invalid request body or query";
  return fail("VALIDATION_ERROR", message, 422, { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors }, field);
}
