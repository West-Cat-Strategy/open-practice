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
