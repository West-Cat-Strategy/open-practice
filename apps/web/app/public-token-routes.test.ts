import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function appPath(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

describe("public token web routes", () => {
  it("keeps hash-token entry pages and removes legacy path-token pages", () => {
    for (const route of ["share-links", "guest-sessions", "external-uploads", "intake-forms"]) {
      expect(existsSync(appPath(`./${route}/page.tsx`))).toBe(true);
      expect(existsSync(appPath(`./${route}/[token]/page.tsx`))).toBe(false);
    }
  });
});
