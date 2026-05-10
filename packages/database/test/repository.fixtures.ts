import { appendAuditEvent, type Firm } from "@open-practice/domain";
import { type FirstRunSetupInput } from "../src/repository/contracts.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

export const now = "2026-04-25T12:00:00.000Z";

export function setupInput(): FirstRunSetupInput {
  const firm: Firm = {
    id: "firm-north-shore-law",
    name: "North Shore Law",
    defaultProvince: "BC",
  };
  const ownerId = "user-owner";
  const firstMatterId = "matter-first";
  return {
    firm,
    settings: {
      firmId: firm.id,
      businessAddress: {
        line1: "100 Main Street",
        city: "Vancouver",
        province: "BC",
        postalCode: "V6B 1A1",
        country: "Canada",
      },
      officeEmail: "office@example.test",
      officePhone: "604-555-0100",
      practiceAreas: ["Residential tenancy"],
      invoicePrefix: "NSL",
      defaultPaymentTermsDays: 30,
      trustAccountLabel: "Pooled trust",
      trustFundsCaveatAcceptedAt: now,
      trustFundsCaveatAcceptedByUserId: ownerId,
      createdAt: now,
      updatedAt: now,
    },
    owner: {
      id: ownerId,
      firmId: firm.id,
      displayName: "Avery Owner",
      email: "avery@example.test",
      role: "owner_admin",
      assignedMatterIds: [firstMatterId],
      mfaEnabled: false,
    },
    ownerPasswordHash: "pbkdf2:sha256:1:salt:hash",
    ownerPasswordUpdatedAt: now,
    firstContact: {
      id: "contact-first-client",
      firmId: firm.id,
      kind: "person",
      displayName: "First Client",
      aliases: [],
      identifiers: [{ type: "email", value: "client@example.test" }],
    },
    firstMatter: {
      id: firstMatterId,
      firmId: firm.id,
      number: "2026-0001",
      title: "First file",
      practiceArea: "Residential tenancy",
      status: "intake",
      jurisdiction: "BC",
      responsibleUserId: ownerId,
      openedOn: "2026-04-25",
    },
    firstMatterParty: {
      id: "party-first-client",
      firmId: firm.id,
      matterId: firstMatterId,
      contactId: "contact-first-client",
      role: "prospective_client",
      adverse: false,
      confidential: true,
    },
    auditEvent: appendAuditEvent(undefined, {
      id: "audit-first-run",
      firmId: firm.id,
      actorId: ownerId,
      action: "setup.completed",
      resourceType: "firm",
      resourceId: firm.id,
      occurredAt: now,
      metadata: { firstMatterCreated: true },
    }),
  };
}

export async function createInboundMessageWithAttachment(
  repository: InMemoryOpenPracticeRepository,
  options: {
    messageId: string;
    attachmentId: string;
    matterId?: string;
    checksumSha256?: string;
  },
) {
  const matterId = options.matterId ?? "matter-002";
  const message = await repository.createInboundEmailMessage({
    id: options.messageId,
    firmId: "firm-west-legal",
    matterId,
    fromAddress: "client@example.test",
    toAddresses: [`${matterId}@open-practice.test`],
    subject: "Filed materials",
    receivedAt: now,
    rawStorageKey: `inbound/raw/${options.messageId}.eml`,
    labels: [],
    status: "triaged",
    metadata: {},
  });
  const attachmentInput = {
    id: options.attachmentId,
    firmId: "firm-west-legal",
    inboundMessageId: message.id,
    filename: "filing.pdf",
    contentType: "application/pdf",
    sizeBytes: 128,
    storageKey: `inbound/${message.id}/filing.pdf`,
  };
  const attachment = await repository.createInboundEmailAttachment(
    options.checksumSha256
      ? { ...attachmentInput, checksumSha256: options.checksumSha256 }
      : attachmentInput,
  );
  return { message, attachment };
}
