import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SignatureRequestsResponse } from "../types";
import { SignaturesSection } from "./signatures-section";

const syntheticSignature: SignatureRequestsResponse[number] = {
  id: "signature-request-synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  documentId: "document_synthetic",
  title: "Synthetic engagement letter",
  requestedByUserId: "user_synthetic",
  provider: "manual",
  externalId: "manual-envelope-synthetic",
  status: "pending_provider_submission",
  consentText: "Synthetic consent text",
  evidence: {},
  signerOrder: [{ role: "client", order: 1, required: true }],
  fieldPlacements: [
    {
      id: "synthetic-client-signature",
      role: "client",
      fieldType: "signature",
      page: 1,
      required: true,
      documentId: "document_synthetic",
      xPercent: 72,
      yPercent: 84,
    },
  ],
  validationStatus: "valid",
  createdAt: "2026-06-06T00:00:00.000Z",
};

describe("SignaturesSection", () => {
  it("renders signature requests without changing copy or classes", () => {
    const html = renderToStaticMarkup(
      createElement(SignaturesSection, {
        activeSignatures: [syntheticSignature],
      }),
    );

    expect(html).toContain('class="party-list"');
    expect(html).toContain('class="party-row"');
    expect(html).toContain("Synthetic engagement letter");
    expect(html).toContain("manual");
    expect(html).toContain("manual-envelope-synthetic");
    expect(html).toContain("valid envelope");
    expect(html).toContain("1 signer role");
    expect(html).toContain("1 field");
    expect(html).toContain("pending provider_submission");
    expect(html).not.toContain("ada@example.test");
    expect(html).not.toContain("Synthetic consent text");
    expect(html).not.toContain("xPercent");
    expect(html).not.toContain("72");
  });

  it("keeps the empty signature request state visible", () => {
    const html = renderToStaticMarkup(
      createElement(SignaturesSection, {
        activeSignatures: [],
      }),
    );

    expect(html).toContain("No signature requests are linked to this matter.");
  });

  it("renders legacy unchecked envelope posture", () => {
    const html = renderToStaticMarkup(
      createElement(SignaturesSection, {
        activeSignatures: [
          {
            ...syntheticSignature,
            signerOrder: [],
            fieldPlacements: [],
            validationStatus: "unchecked",
          },
        ],
      }),
    );

    expect(html).toContain("Envelope unchecked");
  });
});
