import { describe, expect, it } from "vitest";
import type {
  ActivityTimelineEntry,
  DocumentRecord,
  ExpenseEntry,
  Matter,
  MatterParty,
  TimeEntry,
  User,
} from "./models.js";
import { buildMatterSetupProfile } from "./matter-setup.js";

const matter: Matter = {
  id: "matter-setup-001",
  firmId: "firm-setup",
  number: "2026-0001",
  title: "Synthetic setup matter",
  practiceArea: "Residential tenancy",
  status: "intake",
  jurisdiction: "BC",
  responsibleUserId: "user-responsible",
  openedOn: "2026-05-01",
};

const responsibleUser: User = {
  id: "user-responsible",
  firmId: "firm-setup",
  displayName: "Responsible User",
  email: "responsible@example.test",
  role: "licensee",
  assignedMatterIds: [matter.id],
  mfaEnabled: true,
};

const reviewerUser: User = {
  id: "user-reviewer",
  firmId: "firm-setup",
  displayName: "Reviewer User",
  email: "reviewer@example.test",
  role: "firm_member",
  assignedMatterIds: [matter.id],
  mfaEnabled: true,
};

const party: MatterParty = {
  id: "party-setup",
  firmId: matter.firmId,
  matterId: matter.id,
  contactId: "contact-setup",
  role: "opposing_party",
  adverse: true,
  confidential: false,
};

const document: DocumentRecord = {
  id: "document-setup",
  firmId: matter.firmId,
  matterId: matter.id,
  title: "Synthetic filing",
  storageKey: "matters/setup/document.pdf",
  checksumSha256: "checksum",
  version: 1,
  classification: "general",
  legalHold: false,
  uploadStatus: "verified",
  checksumStatus: "verified",
  scanStatus: "passed",
  reviewStatus: "pending_review",
  reviewMetadata: {},
};

const activity: ActivityTimelineEntry = {
  id: "conflict-setup",
  firmId: matter.firmId,
  matterId: matter.id,
  occurredAt: "2026-05-01T12:00:00.000Z",
  title: "Conflict check completed",
  kind: "conflict",
  actorId: "user-responsible",
  metadata: { matterId: matter.id },
};

const timeEntry: TimeEntry = {
  id: "time-setup",
  firmId: matter.firmId,
  matterId: matter.id,
  userId: "user-responsible",
  performedAt: "2026-05-02",
  minutes: 45,
  rateCents: 20000,
  narrative: "Synthetic setup review",
  billable: true,
  billingStatus: "draft",
};

const expense: ExpenseEntry = {
  id: "expense-setup",
  firmId: matter.firmId,
  matterId: matter.id,
  incurredAt: "2026-05-02",
  amountCents: 2500,
  category: "filing",
  description: "Synthetic filing fee",
  reimbursable: true,
  billingStatus: "approved",
};

describe("buildMatterSetupProfile", () => {
  it("derives setup stage, fields, checklist, and financial cues from matter data", () => {
    const profile = buildMatterSetupProfile({
      matter,
      parties: [party],
      documents: [document],
      activity: [activity],
      trustBalanceCents: 12500,
      timeEntries: [timeEntry],
      expenses: [expense],
      users: [responsibleUser, reviewerUser],
    });

    expect(profile.stage).toEqual({
      key: "intake",
      label: "Intake",
      description: "Initial details are being gathered before active work.",
    });
    expect(profile.responsibleUser).toMatchObject({
      state: "assigned",
      responsibleUserId: "user-responsible",
      assignedUserIds: ["user-responsible", "user-reviewer"],
    });
    expect(profile.fieldDefinitions.map((field) => field.key)).toEqual([
      "practiceArea",
      "jurisdiction",
      "openedOn",
      "status",
    ]);
    expect(profile.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "parties", state: "complete", count: 1 }),
        expect.objectContaining({ key: "documents", state: "complete", count: 1 }),
        expect.objectContaining({ key: "conflicts", state: "review" }),
        expect.objectContaining({ key: "review", state: "review" }),
      ]),
    );
    expect(profile.financialSnapshot).toMatchObject({
      trustBalanceCents: 12500,
      unbilledTimeEntryCount: 1,
      unbilledMinutes: 45,
      unbilledExpenseCount: 1,
      unbilledExpenseCents: 2500,
      caution: expect.stringContaining("read-only setup context"),
    });
    expect(profile.financialSnapshot.cues.map((cue) => cue.key)).toEqual([
      "trust_balance",
      "unbilled_work",
    ]);
  });

  it("surfaces assignment gaps without inventing assignments", () => {
    expect(
      buildMatterSetupProfile({
        matter,
        users: [{ ...responsibleUser, assignedMatterIds: [] }],
      }).responsibleUser.state,
    ).toBe("missing_assignment");

    expect(
      buildMatterSetupProfile({
        matter,
        users: [
          { ...reviewerUser, assignedMatterIds: [matter.id] },
          { ...responsibleUser, assignedMatterIds: [] },
        ],
      }).responsibleUser.state,
    ).toBe("responsible_user_mismatch");

    expect(
      buildMatterSetupProfile({
        matter,
        users: [reviewerUser],
      }).responsibleUser.state,
    ).toBe("responsible_user_missing");
  });

  it("adds a closed-on field definition only when closure context is visible", () => {
    const profile = buildMatterSetupProfile({
      matter: { ...matter, status: "closed", closedOn: "2026-05-20" },
      users: [responsibleUser],
    });

    expect(profile.fieldDefinitions).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "closedOn", state: "complete" })]),
    );
  });
});
