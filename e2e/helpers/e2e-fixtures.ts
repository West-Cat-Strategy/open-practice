import { expect, test as base, type Page } from "@playwright/test";

type ApiOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
};

type DevAuthHeaders = {
  "x-open-practice-firm-id": string;
  "x-open-practice-user-id": string;
};

type ShareLinkFixture = {
  token: string;
  verificationCode: string;
};

export const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://localhost:34110";
export const webBaseUrl = process.env.E2E_WEB_BASE_URL ?? "http://localhost:33110";

const defaultHeaders = {
  "x-open-practice-firm-id": "firm-west-legal",
  "x-open-practice-user-id": "user-admin",
} satisfies DevAuthHeaders;

const ignoredConsoleErrorPatterns = [
  /favicon\.ico/i,
  /Failed to load resource.*404/i,
  /Failed to load resource.*403 \(Forbidden\)/i,
  /Failed to load resource.*409 \(Conflict\)/i,
  /Download the React DevTools/i,
];

const ignoredPageErrorPatterns = [
  /^ChunkLoadError: Failed to load chunk \/_next\/static\/chunks\/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_[^ ]+\.js from module \[turbopack\]\/browser\/dev\/hmr-client\/hmr-client\.ts \[app-client\]/i,
];

function futureIso(days = 7): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function shouldIgnoreConsoleError(message: string): boolean {
  return ignoredConsoleErrorPatterns.some((pattern) => pattern.test(message));
}

function shouldIgnorePageError(message: string): boolean {
  return ignoredPageErrorPatterns.some((pattern) => pattern.test(message));
}

async function waitForWebReady(timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  let lastError = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(webBaseUrl, { redirect: "manual" });
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`web app was not ready at ${webBaseUrl}: ${lastError}`);
}

export async function expectPageHealthy(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/Open Practice/);
  const body = page.locator("body");
  await expect(body).not.toContainText(/Unhandled Runtime Error|Application error|Build Error/i);
  await expect(body).not.toContainText(/This page could not be found/i);
  await expect(
    page.getByRole("heading", { name: /^(404( not found)?|This page could not be found)$/i }),
  ).toHaveCount(0);
}

export class OpenPracticeE2EClient {
  constructor(
    readonly apiUrl = apiBaseUrl,
    readonly webUrl = webBaseUrl,
    readonly devHeaders: DevAuthHeaders = defaultHeaders,
  ) {}

  url(path: string): string {
    return `${this.webUrl}${path}`;
  }

  publicTokenUrl(path: string, token: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return this.url(`${normalizedPath}#${encodeURIComponent(token)}`);
  }

  async apiJson<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const headers = {
      ...this.devHeaders,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    };
    const response = await fetch(`${this.apiUrl}${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
    }
    return (await response.json()) as T;
  }

  async createShareLink(): Promise<ShareLinkFixture> {
    await this.apiJson("/api/e2e/shareable-document", {
      body: { matterId: "matter-001", title: "Synthetic shareable disclosure.pdf" },
    });
    const response = await this.apiJson<{ token: string }>("/api/shares", {
      body: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        requireEmailVerification: true,
        notificationEmail: "ada.morgan@example.test",
        deliveryConfirmation: { confirmed: true, channel: "email", recipientCount: 1 },
        expiresAt: futureIso(),
      },
    });
    const code = await this.apiJson<{ verificationCode: string }>(
      `/api/e2e/share-verification-code?matterId=matter-001&token=${encodeURIComponent(
        response.token,
      )}`,
    );
    return { token: response.token, verificationCode: code.verificationCode };
  }

  async createIntakeFormLink(): Promise<string> {
    const response = await this.apiJson<{ token: string }>("/api/intake-form-links", {
      body: {
        intakeSessionId: "intake-session-001",
        expiresAt: futureIso(),
      },
    });
    return response.token;
  }

  async createGuestSession(): Promise<{ guestId: string; sessionId: string; token: string }> {
    await this.apiJson("/api/calendar/events/calendar-event-002/meeting-link", {
      method: "PATCH",
      body: {
        matterId: "matter-001",
        mode: "hosted_webrtc",
      },
    });
    const sessionResponse = await this.apiJson<{ session: { id: string } }>(
      "/api/calendar/events/calendar-event-002/guest-sessions",
      {
        body: { matterId: "matter-001" },
      },
    );
    const sessionId = sessionResponse.session.id;
    await this.apiJson(`/api/calendar/events/calendar-event-002/guest-sessions/${sessionId}/open`, {
      body: { matterId: "matter-001" },
    });
    const guestResponse = await this.apiJson<{
      guest: { id: string };
      token: string;
    }>(`/api/calendar/events/calendar-event-002/guest-sessions/${sessionId}/guest-links`, {
      body: { matterId: "matter-001" },
    });
    return {
      guestId: guestResponse.guest.id,
      sessionId,
      token: guestResponse.token,
    };
  }

  async admitGuest(sessionId: string, guestId: string): Promise<void> {
    await this.apiJson(
      `/api/calendar/events/calendar-event-002/guest-sessions/${sessionId}/guests/${guestId}/admit`,
      { body: { matterId: "matter-001" } },
    );
  }

  async createExternalUploadLink(): Promise<string> {
    const response = await this.apiJson<{ token?: string }>("/api/external-uploads", {
      body: {
        matterId: "matter-001",
        maxUploads: 1,
        expiresAt: futureIso(),
      },
    });
    if (!response.token) throw new Error("External upload token was not returned");
    return response.token;
  }

  async ensureClientPortalAccount(userId = "user-client-external"): Promise<void> {
    await this.apiJson("/api/e2e/client-portal-account", {
      body: {
        matterId: "matter-001",
        contactId: "contact-ada",
        userId,
      },
    });
  }
}

export const test = base.extend<{ app: OpenPracticeE2EClient }>({
  app: async ({}, use) => {
    await use(new OpenPracticeE2EClient());
  },
  page: async ({ page }, use) => {
    await waitForWebReady();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !shouldIgnoreConsoleError(message.text())) {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      if (!shouldIgnorePageError(error.message)) pageErrors.push(error.message);
    });
    await use(page);
    expect(consoleErrors, "browser console errors").toEqual([]);
    expect(pageErrors, "uncaught page errors").toEqual([]);
  },
});

export { expect };
