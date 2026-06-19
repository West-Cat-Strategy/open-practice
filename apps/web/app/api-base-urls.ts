type BrowserApiBaseUrlEnv = {
  NEXT_PUBLIC_API_BASE_URL?: string;
  OPEN_PRACTICE_BROWSER_API_MODE?: string;
  OPEN_PRACTICE_DOCKER_LOCAL_DEV?: string;
};

function nonEmptyEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveBrowserApiBaseUrl(env: BrowserApiBaseUrlEnv): string {
  const mode = nonEmptyEnv(env.OPEN_PRACTICE_BROWSER_API_MODE);
  if (mode === "same-origin" || env.OPEN_PRACTICE_DOCKER_LOCAL_DEV === "true") {
    return "";
  }
  return nonEmptyEnv(env.NEXT_PUBLIC_API_BASE_URL) ?? "http://localhost:4000";
}

export const serverApiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
export const browserApiBaseUrl = resolveBrowserApiBaseUrl({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  OPEN_PRACTICE_BROWSER_API_MODE: process.env.OPEN_PRACTICE_BROWSER_API_MODE,
  OPEN_PRACTICE_DOCKER_LOCAL_DEV: process.env.OPEN_PRACTICE_DOCKER_LOCAL_DEV,
});
