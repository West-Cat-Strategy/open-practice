import { describe, expect, it } from "vitest";
import { type AccessLogRecord, type ExternalUploadLinkRecord } from "@open-practice/domain";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

describe("repository portal links and access logs", () => {
  it("manages per-document portal access in memory", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const grant = await repository.createPortalGrant({
      id: "portal-grant-document-access",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      contactId: "contact-ada",
      accountUserId: "user-client-external",
      grantedByUserId: "user-admin",
      permissions: ["view_documents"],
    });

    const access = await repository.createPortalDocumentAccess({
      id: "portal-document-access-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      documentId: "doc-001",
      portalGrantId: grant.id,
      permission: "view_document",
      grantedByUserId: "user-admin",
      createdAt: now,
      expiresAt: "2026-05-01T00:00:00.000Z",
    });

    await expect(
      repository.listPortalDocumentAccess("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toMatchObject([
      {
        id: access.id,
        documentId: "doc-001",
        portalGrantId: grant.id,
        permission: "view_document",
      },
    ]);
    await expect(
      repository.listPortalDocumentAccess("firm-west-legal", { portalGrantId: grant.id }),
    ).resolves.toMatchObject([{ id: access.id }]);
    await expect(
      repository.revokePortalDocumentAccess({
        firmId: "firm-west-legal",
        id: access.id,
        revokedAt: "2026-04-25T13:00:00.000Z",
      }),
    ).resolves.toMatchObject({ revokedAt: "2026-04-25T13:00:00.000Z" });
  });

  it("persists share links and access logs in memory", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const share = await repository.createShareLink({
      id: "share-link-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "share-token-hash-001",
      grantedByUserId: "user-admin",
      permissions: ["view_documents"],
      requireEmailVerification: true,
      emailVerificationCodeHash: "share-code-hash-001",
      emailVerificationExpiresAt: "2026-04-26T12:00:00.000Z",
      expiresAt: "2026-05-01T00:00:00.000Z",
      createdAt: now,
    });
    await repository.createShareLink({
      id: "share-link-002",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "share-token-hash-002",
      grantedByUserId: "user-admin",
      permissions: ["view_documents"],
      requireEmailVerification: false,
      expiresAt: "2026-05-01T00:00:00.000Z",
      createdAt: "2026-04-25T13:00:00.000Z",
    });

    await expect(repository.listShareLinks("firm-west-legal")).resolves.toMatchObject([
      { id: "share-link-002", matterId: "matter-001" },
      { id: share.id, matterId: "matter-001" },
    ]);
    await expect(repository.getShareLink("firm-west-legal", share.id)).resolves.toMatchObject({
      id: share.id,
      emailVerificationCodeHash: "share-code-hash-001",
      emailVerificationExpiresAt: "2026-04-26T12:00:00.000Z",
    });
    await expect(repository.getShareLinkByTokenHash("share-token-hash-001")).resolves.toMatchObject(
      {
        id: share.id,
        emailVerificationCodeHash: "share-code-hash-001",
        emailVerificationExpiresAt: "2026-04-26T12:00:00.000Z",
      },
    );
    await expect(repository.createShareLink({ ...share, id: "duplicate-token" })).rejects.toThrow(
      "Share link token hash already exists",
    );

    await repository.createAccessLog({
      id: "access-log-001",
      firmId: "firm-west-legal",
      shareLinkId: share.id,
      resourceType: "share_link",
      resourceId: share.id,
      action: "view",
      occurredAt: now,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
      metadata: { outcome: "granted" },
    });
    await repository.createAccessLog({
      id: "access-log-002",
      firmId: "firm-west-legal",
      shareLinkId: share.id,
      resourceType: "share_link",
      resourceId: share.id,
      action: "view",
      occurredAt: "2026-04-25T13:00:00.000Z",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
      metadata: { outcome: "expired" },
    });
    await expect(
      repository.listAccessLogs("firm-west-legal", { shareLinkId: share.id }),
    ).resolves.toMatchObject([
      { resourceId: share.id, metadata: { outcome: "expired" } },
      { resourceId: share.id, metadata: { outcome: "granted" } },
    ]);

    await expect(
      repository.revokeShareLink({
        firmId: "firm-west-legal",
        id: share.id,
        revokedAt: "2026-04-25T13:00:00.000Z",
      }),
    ).resolves.toMatchObject({ revokedAt: "2026-04-25T13:00:00.000Z" });
  });

  it("manages external upload links and access log filters", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const activeLink: ExternalUploadLinkRecord = {
      id: "external-upload-active",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "hash-active-upload",
      requestedByUserId: "user-admin",
      expiresAt: "2026-04-25T13:00:00.000Z",
      maxUploads: 2,
      usedUploads: 0,
      createdAt: now,
    };
    const revokedLink: ExternalUploadLinkRecord = {
      id: "external-upload-revoked",
      firmId: "firm-west-legal",
      matterId: "matter-002",
      tokenHash: "hash-revoked-upload",
      requestedByUserId: "user-admin",
      expiresAt: "2026-04-25T13:00:00.000Z",
      maxUploads: 1,
      usedUploads: 0,
      createdAt: "2026-04-25T12:01:00.000Z",
    };
    const expiredLink: ExternalUploadLinkRecord = {
      id: "external-upload-expired",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "hash-expired-upload",
      requestedByUserId: "user-admin",
      expiresAt: "2026-04-25T11:00:00.000Z",
      maxUploads: 1,
      usedUploads: 0,
      createdAt: "2026-04-25T12:02:00.000Z",
    };

    await repository.createExternalUploadLink(activeLink);
    await repository.createExternalUploadLink(revokedLink);
    await repository.createExternalUploadLink(expiredLink);
    await expect(
      repository.createExternalUploadLink({ ...activeLink, id: "external-upload-duplicate" }),
    ).rejects.toThrow("External upload link token hash already exists");

    await expect(
      repository.listExternalUploadLinks("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual(expect.arrayContaining([activeLink, expiredLink]));
    await expect(
      repository.getExternalUploadLinkByTokenHash(activeLink.tokenHash),
    ).resolves.toEqual(activeLink);

    await expect(
      repository.claimExternalUploadUse({
        firmId: activeLink.firmId,
        id: activeLink.id,
        usedAt: "2026-04-25T12:30:00.000Z",
      }),
    ).resolves.toMatchObject({ usedUploads: 1 });
    await expect(
      repository.claimExternalUploadUse({
        firmId: activeLink.firmId,
        id: activeLink.id,
        usedAt: "2026-04-25T12:31:00.000Z",
      }),
    ).resolves.toMatchObject({ usedUploads: 2 });
    await expect(
      repository.claimExternalUploadUse({
        firmId: activeLink.firmId,
        id: activeLink.id,
        usedAt: "2026-04-25T12:32:00.000Z",
      }),
    ).resolves.toBeUndefined();
    await expect(
      repository.claimExternalUploadUse({
        firmId: expiredLink.firmId,
        id: expiredLink.id,
        usedAt: "2026-04-25T12:00:00.000Z",
      }),
    ).resolves.toBeUndefined();
    await expect(
      repository.revokeExternalUploadLink({
        firmId: revokedLink.firmId,
        id: revokedLink.id,
        revokedAt: "2026-04-25T12:45:00.000Z",
      }),
    ).resolves.toMatchObject({ revokedAt: "2026-04-25T12:45:00.000Z" });
    await expect(
      repository.claimExternalUploadUse({
        firmId: revokedLink.firmId,
        id: revokedLink.id,
        usedAt: "2026-04-25T12:46:00.000Z",
      }),
    ).resolves.toBeUndefined();

    const logs: AccessLogRecord[] = [
      {
        id: "access-share",
        firmId: "firm-west-legal",
        shareLinkId: "share-link-001",
        resourceType: "document",
        resourceId: "document-001",
        action: "view",
        occurredAt: now,
        metadata: {},
      },
      {
        id: "access-upload",
        firmId: "firm-west-legal",
        externalUploadLinkId: activeLink.id,
        resourceType: "document",
        resourceId: "document-uploaded",
        action: "upload",
        occurredAt: "2026-04-25T12:35:00.000Z",
        metadata: { filename: "evidence.pdf" },
      },
      {
        id: "access-other-upload",
        firmId: "firm-west-legal",
        externalUploadLinkId: revokedLink.id,
        resourceType: "document",
        resourceId: "document-other",
        action: "upload",
        occurredAt: "2026-04-25T12:36:00.000Z",
        metadata: {},
      },
    ];
    for (const log of logs) {
      await repository.createAccessLog(log);
    }

    await expect(
      repository.listAccessLogs("firm-west-legal", { shareLinkId: "share-link-001" }),
    ).resolves.toMatchObject([{ id: "access-share" }]);
    await expect(
      repository.listAccessLogs("firm-west-legal", { externalUploadLinkId: activeLink.id }),
    ).resolves.toMatchObject([{ id: "access-upload" }]);
  });
});
