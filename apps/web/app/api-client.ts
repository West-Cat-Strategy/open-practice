export class DashboardApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(`Dashboard API request failed with status ${status}`);
  }
}

export type DashboardJsonRequest = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  headers?: HeadersInit;
  payload?: unknown;
};

export async function requestDashboardJson<T>(
  apiBaseUrl: string,
  path: string,
  request: DashboardJsonRequest = {},
): Promise<T> {
  const headers = new Headers(request.headers);
  const init: RequestInit = {
    method: request.method ?? "GET",
    credentials: "include",
    headers,
  };

  if (request.payload !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(request.payload);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new DashboardApiError(response.status, payload);
  }

  return payload as T;
}

export function dashboardApiStatus(error: unknown): number | "network" {
  return error instanceof DashboardApiError ? error.status : "network";
}
