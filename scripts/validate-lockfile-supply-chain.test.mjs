import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectAllowBuilds,
  collectPackageEntries,
  validateLockfileSupplyChain,
} from "./validate-lockfile-supply-chain.mjs";

const workspaceText = `packages:
  - "apps/*"

allowBuilds:
  esbuild: true
  sharp: true
  native-disabled: false
`;

describe("lockfile supply-chain policy", () => {
  it("parses native build approvals", () => {
    assert.deepEqual(
      [...collectAllowBuilds(workspaceText).entries()],
      [
        ["esbuild", true],
        ["sharp", true],
        ["native-disabled", false],
      ],
    );
  });

  it("collects package entries from a pnpm lockfile", () => {
    const entries = collectPackageEntries(`lockfileVersion: "9.0"

packages:
  safe@1.0.0:
    resolution: {integrity: sha512-safe}

snapshots:
  safe@1.0.0: {}
`);
    assert.deepEqual(
      entries.map((entry) => entry.key),
      ["safe@1.0.0"],
    );
  });

  it("accepts registry-backed packages with approved native builds", () => {
    const result = validateLockfileSupplyChain({
      workspaceText,
      lockfileText: `lockfileVersion: "9.0"

packages:
  esbuild@0.28.1:
    resolution: {integrity: sha512-safe}
    requiresBuild: true
  sharp@0.34.5:
    resolution: {integrity: sha512-safe}
    requiresBuild: true
`,
    });

    assert.deepEqual(result.findings, []);
  });

  it("flags non-registry refs, missing integrity, and unapproved native builds", () => {
    const result = validateLockfileSupplyChain({
      workspaceText,
      lockfileText: `lockfileVersion: "9.0"

importers:
  .:
    dependencies:
      unsafe:
        specifier: github:example/unsafe
        version: github:example/unsafe

packages:
  unsafe@1.0.0:
    resolution: {tarball: https://example.test/unsafe.tgz}
  unapproved-native@1.0.0:
    resolution: {integrity: sha512-safe}
    requiresBuild: true
`,
    });

    assert.deepEqual(
      result.findings.map((finding) => finding.type),
      [
        "non_registry_dependency_reference",
        "non_registry_dependency_reference",
        "registry_drift",
        "missing_integrity",
        "native_build_not_approved",
      ],
    );
  });
});
