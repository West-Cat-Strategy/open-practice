import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialFirstMatterFormState } from "../dashboard-utils";
import { FirstMatterWorkspace } from "./first-matter-workspace";

describe("FirstMatterWorkspace", () => {
  it("renders the zero-matter starter intake form without changing copy or classes", () => {
    const html = renderToStaticMarkup(
      createElement(FirstMatterWorkspace, {
        canCreateMatter: true,
        creating: false,
        form: {
          ...initialFirstMatterFormState,
          title: "Synthetic starter intake",
          practiceArea: "Residential tenancy",
          clientDisplayName: "Synthetic Client",
          clientEmail: "client@example.test",
          clientPhone: "+1-555-0100",
        },
        onChange: () => {},
        onCreate: () => {},
        status: "No matter has been created in this session.",
      }),
    );

    expect(html).toContain('class="panel first-matter-panel"');
    expect(html).toContain('id="matter-workspace"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain("Matter command centre");
    expect(html).toContain("Create the first matter");
    expect(html).toContain("Starter intake");
    expect(html).toContain("Synthetic starter intake");
    expect(html).toContain("Residential tenancy");
    expect(html).toContain("Safe metadata");
    expect(html).toContain("Create matter");
    expect(html).toContain("No matter has been created in this session.");
  });

  it("keeps matter creation disabled when the active role cannot create matters", () => {
    const html = renderToStaticMarkup(
      createElement(FirstMatterWorkspace, {
        canCreateMatter: false,
        creating: false,
        form: {
          ...initialFirstMatterFormState,
          title: "Synthetic starter intake",
          practiceArea: "Residential tenancy",
          clientDisplayName: "Synthetic Client",
        },
        onChange: () => {},
        onCreate: () => {},
        status: "No matter has been created in this session.",
      }),
    );

    expect(html).toContain('class="primary-button first-matter-submit" disabled=""');
    expect(html).toContain(
      "Your current role can use operational surfaces, but matter creation is not available.",
    );
  });
});
