import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

describe("repository intake persistence", () => {
  it("stores immutable published intake template versions separately from mutable drafts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const [template] = await repository.listIntakeTemplates("firm-west-legal");
    const [seedVersion] = await repository.listIntakeTemplateVersions(
      "firm-west-legal",
      template.id,
    );
    expect(seedVersion).toMatchObject({
      id: "intake-template-001:v2",
      templateId: template.id,
      version: 2,
      definitionVersion: 2,
    });

    const updatedDraft = await repository.updateIntakeTemplate({
      ...template,
      name: "Residential tenancy intake draft",
      definitionVersion: 3,
      definition: {
        ...template.definition,
        questions: [
          ...template.definition.questions,
          {
            id: "draft_only_question",
            label: "Draft-only question",
            type: "text",
            required: false,
          },
        ],
      },
      updatedAt: "2026-06-16T12:00:00.000Z",
    });
    await repository.createIntakeTemplateVersion({
      id: "intake-template-001:v3",
      firmId: updatedDraft.firmId,
      templateId: updatedDraft.id,
      version: 3,
      definitionVersion: updatedDraft.definitionVersion,
      definition: updatedDraft.definition,
      publishedAt: "2026-06-16T12:05:00.000Z",
      publishedByUserId: "user-admin",
      metadata: { source: "test" },
    });

    await expect(
      repository.getIntakeTemplateVersion("firm-west-legal", "intake-template-001:v2"),
    ).resolves.toMatchObject({
      definition: expect.not.objectContaining({
        questions: expect.arrayContaining([expect.objectContaining({ id: "draft_only_question" })]),
      }),
    });
    await expect(
      repository.getLatestIntakeTemplateVersion("firm-west-legal", template.id),
    ).resolves.toMatchObject({
      id: "intake-template-001:v3",
      version: 3,
      definition: expect.objectContaining({
        questions: expect.arrayContaining([expect.objectContaining({ id: "draft_only_question" })]),
      }),
    });
    await repository.createIntakeSession({
      id: "intake-session-version-pin",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      templateId: template.id,
      publishedTemplateVersionId: "intake-template-001:v3",
      provider: "embedded",
      externalId: "embedded:intake-session-version-pin",
      status: "in_progress",
      evidence: {},
      createdAt: now,
      updatedAt: now,
    });
    await expect(
      repository.getIntakeSession("firm-west-legal", "intake-session-version-pin"),
    ).resolves.toMatchObject({
      publishedTemplateVersionId: "intake-template-001:v3",
    });
  });

  it("preserves embedded intake template definitions and answer resolution snapshots", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const [template] = await repository.listIntakeTemplates("firm-west-legal");
    const resolution = {
      templateId: template.id,
      templateVersion: template.definitionVersion,
      visibleQuestionIds: [
        "issue_type",
        "urgent",
        "repair_details",
        "client_display_name",
        "matter_title",
      ],
      visibleFormItemIds: [
        "intro",
        "client-name-item",
        "matter-title-item",
        "issue-type-item",
        "urgent-item",
        "repair-details-item",
        "evidence-upload",
        "client-attestation",
      ],
      requiredIncompleteItemIds: ["evidence-upload", "client-attestation"],
      matchedBranchRuleIds: ["repair-package"],
      eligiblePackageIds: ["repair_notice_package"],
      selectedPackageIds: ["repair_notice_package"],
      packageSummaries: [
        {
          packageId: "repair_notice_package",
          title: "Repair notice package",
          default: true,
          documentCount: 1,
          documentIds: ["repair_notice_letter"],
        },
      ],
      packageDocuments: [
        {
          packageId: "repair_notice_package",
          packageDocumentId: "repair_notice_letter",
          title: "Repair notice letter",
        },
      ],
    };

    expect(template).toMatchObject({
      id: "intake-template-001",
      definitionVersion: 2,
      definition: expect.objectContaining({
        schemaVersion: 2,
        sections: expect.arrayContaining([expect.objectContaining({ id: "issue-details" })]),
        packages: expect.arrayContaining([
          expect.objectContaining({ id: "repair_notice_package" }),
        ]),
      }),
    });
    await repository.createAnswerSnapshot({
      id: "answer-snapshot-resolution",
      firmId: "firm-west-legal",
      intakeSessionId: "intake-session-001",
      capturedAt: now,
      answers: { issue_type: "repair" },
      resolution,
    });
    await expect(
      repository.listAnswerSnapshots("firm-west-legal", {
        intakeSessionId: "intake-session-001",
      }),
    ).resolves.toEqual([expect.objectContaining({ resolution })]);
    await expect(
      repository.createGeneratedDocument({
        id: "generated-package-doc",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        provider: "embedded",
        externalId: "embedded:intake-session-001:repair_notice_package:repair_notice_letter",
        title: "Repair notice letter",
        packageId: "repair_notice_package",
        packageDocumentId: "repair_notice_letter",
        evidence: {},
        createdAt: now,
      }),
    ).resolves.toMatchObject({
      packageId: "repair_notice_package",
      packageDocumentId: "repair_notice_letter",
    });
  });

  it("links submitted intake form links to snapshots and records review decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const [template] = await repository.listIntakeTemplates("firm-west-legal");
    const link = await repository.createIntakeFormLink({
      id: "intake-form-link-review",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      intakeSessionId: "intake-session-001",
      tokenHash: "review-link-token-hash",
      requestedByUserId: "user-admin",
      clientContactId: "contact-ada",
      expiresAt: "2099-06-01T00:00:00.000Z",
      createdAt: now,
    });
    const snapshot = await repository.createAnswerSnapshot({
      id: "answer-snapshot-review",
      firmId: "firm-west-legal",
      intakeSessionId: "intake-session-001",
      capturedAt: now,
      answers: { issue_type: "repair" },
      resolution: {
        templateId: template.id,
        templateVersion: template.definitionVersion,
        visibleQuestionIds: ["issue_type"],
        matchedBranchRuleIds: [],
        eligiblePackageIds: [],
        selectedPackageIds: [],
        packageSummaries: [],
        packageDocuments: [],
      },
    });

    await expect(
      repository.reserveIntakeFormLinkSubmission({
        firmId: "firm-west-legal",
        id: link.id,
        clientSubmissionId: "browser-submit-001",
        submissionFingerprint: "fingerprint-001",
      }),
    ).resolves.toMatchObject({
      id: link.id,
      clientSubmissionId: "browser-submit-001",
      submissionFingerprint: "fingerprint-001",
    });
    await expect(
      repository.reserveIntakeFormLinkSubmission({
        firmId: "firm-west-legal",
        id: link.id,
        clientSubmissionId: "browser-submit-002",
        submissionFingerprint: "fingerprint-002",
      }),
    ).resolves.toMatchObject({
      id: link.id,
      clientSubmissionId: "browser-submit-001",
      submissionFingerprint: "fingerprint-001",
    });
    await expect(
      repository.saveIntakeFormLinkDraft({
        firmId: "firm-west-legal",
        id: link.id,
        answers: { issue_type: "repair", urgent: true },
        draftUpdatedAt: now,
      }),
    ).resolves.toMatchObject({
      id: link.id,
      draftAnswers: { issue_type: "repair", urgent: true },
      draftUpdatedAt: now,
    });
    await expect(
      repository.markIntakeFormLinkSubmitted({
        firmId: "firm-west-legal",
        id: link.id,
        submittedAt: now,
        answerSnapshotId: snapshot.id,
      }),
    ).resolves.toMatchObject({ id: link.id, answerSnapshotId: snapshot.id });
    await expect(
      repository.saveIntakeFormLinkDraft({
        firmId: "firm-west-legal",
        id: link.id,
        answers: { issue_type: "changed" },
        draftUpdatedAt: "2099-01-01T00:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      id: link.id,
      draftAnswers: { issue_type: "repair", urgent: true },
      draftUpdatedAt: now,
    });
    await expect(
      repository.createIntakeFormReview({
        id: "intake-form-review-accepted",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-session-001",
        formLinkId: link.id,
        answerSnapshotId: snapshot.id,
        decision: "accepted",
        decidedByUserId: "user-admin",
        decidedAt: now,
      }),
    ).resolves.toMatchObject({
      formLinkId: link.id,
      answerSnapshotId: snapshot.id,
      decision: "accepted",
    });
    await expect(
      repository.listIntakeFormReviews("firm-west-legal", { formLinkId: link.id }),
    ).resolves.toEqual([
      expect.objectContaining({
        formLinkId: link.id,
        answerSnapshotId: snapshot.id,
        decision: "accepted",
      }),
    ]);
  });
});
