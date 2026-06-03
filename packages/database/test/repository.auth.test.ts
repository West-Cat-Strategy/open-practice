import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

describe("repository auth credential boundaries", () => {
  it("scopes passkey deletion by firm, user, and credential id", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.registerWebAuthnCredential({
      id: "passkey-admin",
      firmId: "firm-west-legal",
      userId: "user-admin",
      credentialId: "credential-admin",
      publicKey: "public-key-admin",
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: "2026-06-02T12:00:00.000Z",
    });
    await repository.registerWebAuthnCredential({
      id: "passkey-licensee",
      firmId: "firm-west-legal",
      userId: "user-licensee",
      credentialId: "credential-licensee",
      publicKey: "public-key-licensee",
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: "2026-06-02T12:01:00.000Z",
    });

    await repository.deleteWebAuthnCredential("firm-west-legal", "user-admin", "passkey-licensee");

    await expect(
      repository.listWebAuthnCredentials("firm-west-legal", "user-licensee"),
    ).resolves.toEqual([expect.objectContaining({ id: "passkey-licensee" })]);

    await repository.deleteWebAuthnCredential(
      "firm-west-legal",
      "user-licensee",
      "passkey-licensee",
    );

    await expect(
      repository.listWebAuthnCredentials("firm-west-legal", "user-licensee"),
    ).resolves.toEqual([]);
    await expect(
      repository.listWebAuthnCredentials("firm-west-legal", "user-admin"),
    ).resolves.toEqual([expect.objectContaining({ id: "passkey-admin" })]);
  });
});
