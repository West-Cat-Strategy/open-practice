import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDot, collectWorkspaceImportGraph } from "./check-architecture-graph.mjs";

describe("architecture graph", () => {
  it("reports disallowed workspace imports", () => {
    const files = {
      "packages/domain/src/index.ts": 'import { db } from "@open-practice/database";\n',
      "apps/api/src/server.ts": 'import { buildSampleData } from "@open-practice/domain";\n',
    };
    const graph = collectWorkspaceImportGraph({
      cwd: "/synthetic",
      exec: () => Object.keys(files).join("\n"),
      read: (file) => files[file.replace("/synthetic/", "")],
    });

    assert.deepEqual(graph.violations, [
      {
        file: "packages/domain/src/index.ts",
        from: "@open-practice/domain",
        to: "@open-practice/database",
        message:
          "@open-practice/domain may not import @open-practice/database according to docs/development/repo-guide.md.",
      },
    ]);
  });

  it("builds a compact dot graph", () => {
    assert.match(
      buildDot({
        edges: [
          {
            from: "@open-practice/api",
            to: "@open-practice/domain",
            file: "apps/api/src/server.ts",
          },
        ],
      }),
      /"@open-practice\/api" -> "@open-practice\/domain"/,
    );
  });
});
