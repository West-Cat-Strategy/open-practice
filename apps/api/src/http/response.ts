export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export interface ApiRouteErrorBody {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

export class ApiHttpError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiHttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function successEnvelope<T>(data: T): ApiSuccessEnvelope<T> {
  return { success: true, data };
}

export function errorEnvelope(code: string, message: string, details?: unknown): ApiErrorEnvelope {
  return {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

export function apiRouteErrorBody({
  error,
  message,
  code,
  details,
}: ApiRouteErrorBody): ApiRouteErrorBody {
  return {
    error,
    message,
    ...(code === undefined ? {} : { code }),
    ...(details === undefined ? {} : { details }),
  };
}

export const UNEXPECTED_API_ERROR_CODE = "UNEXPECTED_API_ERROR";
export const UNEXPECTED_API_ERROR_MESSAGE = "Unexpected API error";

export function normalizeApiError(error: unknown): {
  statusCode: number;
  body: ApiErrorEnvelope;
} {
  if (error instanceof ApiHttpError) {
    return {
      statusCode: error.statusCode,
      body: errorEnvelope(error.code, error.message, error.details),
    };
  }

  if (error instanceof Error) {
    const statusCode =
      "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    return {
      statusCode,
      body: errorEnvelope(UNEXPECTED_API_ERROR_CODE, UNEXPECTED_API_ERROR_MESSAGE),
    };
  }

  return {
    statusCode: 500,
    body: errorEnvelope("UNKNOWN_ERROR", "Unknown API error"),
  };
}
