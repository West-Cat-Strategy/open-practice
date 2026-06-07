import { cookies } from "next/headers";
import { serverApiBaseUrl } from "../api-base-urls";
import type { ConnectorOperationsResponse } from "../_features/connectors/models";

export const devHeaders = {
  "x-open-practice-user-id": process.env.DEV_AUTH_USER_ID ?? "user-admin",
  "x-open-practice-firm-id": process.env.DEV_AUTH_FIRM_ID ?? "firm-west-legal",
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function buildApiHeaders(): Promise<Record<string, string>> {
  const cookieHeader = (await cookies()).toString();
  return {
    ...(process.env.NODE_ENV === "production" ? {} : devHeaders),
    ...(cookieHeader ? { cookie: cookieHeader } : {}),
  };
}

export async function apiGet<T>(path: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(`${serverApiBaseUrl}${path}`, {
    cache: "no-store",
    headers,
  });
  if (!response.ok) {
    throw new ApiRequestError(
      `Open Practice API request failed: ${response.status} ${path}`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export async function apiGetOptional<T>(
  path: string,
  fallback: T,
  headers: Record<string, string>,
  forbiddenFallback = fallback,
): Promise<T> {
  const response = await fetch(`${serverApiBaseUrl}${path}`, {
    cache: "no-store",
    headers,
  });
  if (response.status === 404) return fallback;
  if (response.status === 403) return forbiddenFallback;
  if (!response.ok) {
    throw new ApiRequestError(
      `Open Practice API request failed: ${response.status} ${path}`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export async function apiGetOptionalWithStatus<T>(
  path: string,
  fallback: T,
  headers: Record<string, string>,
): Promise<{ data: T; status: ConnectorOperationsResponse["status"] }> {
  try {
    return { data: await apiGet<T>(path, headers), status: "available" };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 403) {
      return { data: fallback, status: "access_denied" };
    }
    if (error instanceof ApiRequestError && error.status === 404) {
      return { data: fallback, status: "unavailable" };
    }
    throw error;
  }
}
