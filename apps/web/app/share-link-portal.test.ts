import { describe, expect, it } from "vitest";
import { shareLinkAttentionItems, type PublicShareLinkResponse } from "./share-link-portal";

const payload = {
  share: {
    id: "share-001",
    permissions: ["view"],
    requireEmailVerification: true,
  },
  documents: [],
} satisfies PublicShareLinkResponse;

describe("public share link action summary", () => {
  it("surfaces verification without exposing document or matter internals", () => {
    expect(shareLinkAttentionItems({ payload: null, verificationRequired: true })).toEqual([
      {
        id: "share-email-verification",
        title: "Verify email",
        detail: "Complete verification before viewing the shared documents.",
        status: "required",
        tone: "risk",
      },
    ]);
  });

  it("keeps valid empty share links visible as waiting state", () => {
    expect(shareLinkAttentionItems({ payload, verificationRequired: false })).toEqual([
      {
        id: "share-no-documents",
        title: "No shared documents available",
        detail: "The link is valid, but no documents are currently visible from this page.",
        status: "waiting",
      },
    ]);
  });
});
