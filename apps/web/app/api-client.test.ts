import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardApiError, dashboardApiStatus, requestDashboardJson } from "./api-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dashboard API client", () => {
  it("sends JSON requests with credentials and dev headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const payload = await requestDashboardJson<{ ok: boolean }>(
      "http://localhost:4000",
      "/api/example",
      {
        method: "POST",
        headers: { "x-open-practice-dev-user": "owner" },
        payload: { matterId: "matter-001" },
      },
    );

    expect(payload).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/example",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ matterId: "matter-001" }),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers;
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get("Content-Type")).toBe("application/json");
    expect((headers as Headers).get("x-open-practice-dev-user")).toBe("owner");
  });

  it("throws status-only errors without exposing response bodies in the message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "private diagnostic" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(requestDashboardJson("http://localhost:4000", "/api/example")).rejects.toThrow(
      DashboardApiError,
    );

    try {
      await requestDashboardJson("http://localhost:4000", "/api/example");
    } catch (error) {
      expect(dashboardApiStatus(error)).toBe(403);
      expect(String(error)).not.toContain("private diagnostic");
    }
  });
});
