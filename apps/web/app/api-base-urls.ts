type BrowserApiBaseUrlEnv = {
  NEXT_PUBLIC_API_BASE_URL?: string;
  OPEN_PRACTICE_DOCKER_LOCAL_DEV?: string;
};

export function resolveBrowserApiBaseUrl(env: BrowserApiBaseUrlEnv): string {
  if (env.OPEN_PRACTICE_DOCKER_LOCAL_DEV === "true") return "";
  return env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

export const serverApiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
export const browserApiBaseUrl = resolveBrowserApiBaseUrl({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  OPEN_PRACTICE_DOCKER_LOCAL_DEV: process.env.OPEN_PRACTICE_DOCKER_LOCAL_DEV,
});
