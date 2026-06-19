import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { lintMigrationText } from "./lint-migrations.mjs";

describe("migration lint", () => {
  it("flags destructive migration operations", () => {
    assert.deepEqual(
      lintMigrationText(
        "packages/database/migrations/9999_test.sql",
        'ALTER TABLE "matters" DROP COLUMN "legacy";',
      ).map((finding) => finding.type),
      ["drop_column"],
    );
  });

  it("flags obvious not-null additions without defaults", () => {
    assert.deepEqual(
      lintMigrationText(
        "packages/database/migrations/9999_test.sql",
        'ALTER TABLE "matters" ADD COLUMN "reviewed_at" timestamp NOT NULL;',
      ).map((finding) => finding.type),
      ["not_null_without_default"],
    );
  });

  it("allows additive nullable columns", () => {
    assert.deepEqual(
      lintMigrationText(
        "packages/database/migrations/9999_test.sql",
        'ALTER TABLE "matters" ADD COLUMN "reviewed_at" timestamp;',
      ),
      [],
    );
  });
});
