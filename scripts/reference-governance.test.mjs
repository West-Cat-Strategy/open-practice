import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildReferenceLock, openPracticeReferences } from "./reference-governance.mjs";

const root = "/Users/bryan/projects/open-practice";
const referencesRoot = "/Users/bryan/projects/reference-repos/repos";
const indexPath = "/Users/bryan/projects/reference-repos/docs/index.json";

function reference(overrides = {}) {
  return {
    id: "owner__repo",
    displayName: "Reference Repo",
    upstream: {
      url: "https://github.com/owner/repo.git",
      branch: "main",
      commit: "abc123",
      committedAt: "2026-05-18 12:00:00 +0000",
    },
    paths: {
      central: "/Users/bryan/projects/reference-repos/repos/owner__repo",
      doc: "owner__repo.md",
      compatibilityAliases: [],
    },
    sourceFamilies: ["open-practice"],
    domains: ["workflow"],
    reuseClass: "architecture_only",
    license: "MIT",
    licenseRisk: "low",
    ...overrides,
  };
}

describe("reference governance helpers", () => {
  it("filters the central index to Open Practice references", () => {
    const index = {
      repos: [
        reference({ id: "open__one" }),
        reference({ id: "metadata__only", curationMode: "metadata_only" }),
        reference({ id: "other__family", sourceFamilies: ["pokemonhackstudio"] }),
      ],
    };

    assert.deepEqual(
      openPracticeReferences(index).map((entry) => entry.id),
      ["open__one"],
    );
    assert.deepEqual(
      openPracticeReferences(index, { includeMetadataOnly: true }).map((entry) => entry.id),
      ["metadata__only", "open__one"],
    );
  });

  it("builds a lock entry with central metadata and compatibility paths", () => {
    const lock = buildReferenceLock({
      index: {
        repos: [
          reference({
            aliases: [{ family: "open-practice", legacyName: "Legacy__Repo" }],
            paths: {
              central: "/Users/bryan/projects/reference-repos/repos/owner__repo",
              doc: "owner__repo.md",
              compatibilityAliases: [
                "/Users/bryan/projects/open-practice/.references/oss/Legacy__Repo",
              ],
            },
          }),
        ],
      },
      root,
      referencesRoot,
      indexPath,
    });

    assert.equal(lock.referenceIndex.sourceFamily, "open-practice");
    assert.deepEqual(lock.references[0], {
      id: "owner__repo",
      name: "Legacy__Repo",
      displayName: "Reference Repo",
      url: "https://github.com/owner/repo.git",
      commit: "abc123",
      branch: "main",
      committedAt: "2026-05-18 12:00:00 +0000",
      centralPath: "../reference-repos/repos/owner__repo",
      compatibilityPath: ".references/oss/Legacy__Repo",
      compatibilityPaths: [".references/oss/Legacy__Repo"],
      sourceFamilies: ["open-practice"],
      reuseClass: "architecture_only",
      license: "MIT",
      licenseRisk: "low",
      curationMode: "clone_on_demand",
      metadataOnly: false,
      centralIndex: {
        path: indexPath,
        doc: "owner__repo.md",
        sourceFamily: "open-practice",
        includeMetadataOnly: false,
      },
      domains: ["workflow"],
      guardrail: undefined,
    });
  });
});
