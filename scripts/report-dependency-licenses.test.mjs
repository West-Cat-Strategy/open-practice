import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDependencyLicenseReport,
  packageLicenseEntries,
} from "./report-dependency-licenses.mjs";

describe("dependency license report", () => {
  it("emits package-level JSON with blocked and review markers", () => {
    const raw = {
      MIT: [{ name: "safe-package", versions: ["1.0.0"] }],
      "AGPL-3.0": [{ name: "review-package", versions: ["2.0.0", "2.1.0"] }],
      "MPL-2.0": [{ name: "mpl-package", versions: ["4.0.0"] }],
      UNKNOWN: [{ name: "blocked-package", versions: ["3.0.0"] }],
    };

    assert.deepEqual(packageLicenseEntries(raw), [
      {
        name: "blocked-package",
        version: "3.0.0",
        licenseGroup: "UNKNOWN",
        reviewRequired: false,
        blocked: true,
      },
      {
        name: "mpl-package",
        version: "4.0.0",
        licenseGroup: "MPL-2.0",
        reviewRequired: true,
        blocked: false,
      },
      {
        name: "review-package",
        version: "2.0.0",
        licenseGroup: "AGPL-3.0",
        reviewRequired: true,
        blocked: false,
      },
      {
        name: "review-package",
        version: "2.1.0",
        licenseGroup: "AGPL-3.0",
        reviewRequired: true,
        blocked: false,
      },
      {
        name: "safe-package",
        version: "1.0.0",
        licenseGroup: "MIT",
        reviewRequired: false,
        blocked: false,
      },
    ]);

    const report = buildDependencyLicenseReport(raw);
    assert.equal(report.totals.packages, 4);
    assert.equal(report.totals.packageVersions, 5);
    assert.equal(report.totals.blockedGroups, 1);
    assert.equal(report.totals.reviewRequiredGroups, 2);
  });
});
