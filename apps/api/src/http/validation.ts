import { z, type ZodType } from "zod";
import { ApiHttpError } from "./response.js";

export type RequestPart = "body" | "query" | "params";

export type SafeValidationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: ApiHttpError;
    };

export function formatZodIssuePath(path: PropertyKey[]): string {
  return path.length > 0 ? path.map((part) => String(part)).join(".") : "root";
}

export function validateRequestPart<T>(
  schema: ZodType<T>,
  value: unknown,
  part: RequestPart,
): SafeValidationResult<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  const details = z.treeifyError(parsed.error);
  const flatIssues = parsed.error.issues.map((issue) => ({
    path: formatZodIssuePath(issue.path),
    message: issue.message,
  }));

  return {
    ok: false,
    error: new ApiHttpError(400, "VALIDATION_ERROR", `Invalid request ${part}`, {
      issues: flatIssues,
      tree: details,
    }),
  };
}

export function parseRequestPart<T>(schema: ZodType<T>, value: unknown, part: RequestPart): T {
  const result = validateRequestPart(schema, value, part);
  if (!result.ok) throw result.error;
  return result.data;
}
