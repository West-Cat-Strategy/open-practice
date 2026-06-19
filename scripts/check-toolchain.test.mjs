import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectToolchainFailures,
  dockerPnpmVersion,
  parsePackageManager,
} from "./check-toolchain.mjs";

describe("toolchain policy check", () => {
  it("passes when Node, pnpm, and Dockerfile versions match policy", () => {
    const result = collectToolchainFailures({
      dockerfile: "ARG PNPM_VERSION=11.5.3\n",
      nodeVersion: "24.1.0",
      packageJson: { packageManager: "pnpm@11.5.3" },
      pnpmVersion: "11.5.3",
    });

    assert.deepEqual(result.failures, []);
    assert.equal(result.packageManager.version, "11.5.3");
  });

  it("reports local runtime and package-manager drift", () => {
    const result = collectToolchainFailures({
      dockerfile: "ARG PNPM_VERSION=11.5.2\n",
      nodeVersion: "23.9.0",
      packageJson: { packageManager: "pnpm@11.5.3" },
      pnpmVersion: "11.5.4",
    });

    assert.deepEqual(result.failures, [
      "Node.js 23.9.0 is below the local validation floor >=24.",
      "pnpm --version (11.5.4) must match packageManager (11.5.3).",
      "Dockerfile PNPM_VERSION (11.5.2) must match packageManager (11.5.3).",
    ]);
  });

  it("requires pinned pnpm packageManager and Dockerfile ARG values", () => {
    assert.throws(
      () => parsePackageManager("npm@11.0.0"),
      /packageManager must be pinned as pnpm@x\.y\.z/,
    );
    assert.throws(() => dockerPnpmVersion("FROM node\n"), /ARG PNPM_VERSION/);
  });
});
