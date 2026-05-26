import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";
import type { ApiJobQueue } from "./types.js";

const jwtSecret = "test-public-consultation-secret-at-least-32-chars";
const servers: Array<{ close: () => Promise<void> }> = [];

function jobQueue(): ApiJobQueue & { added: unknown[] } {
  return {
    added: [],
    async add(name, data, options) {
      this.added.push({ name, data, options });
      return { id: options?.jobId ?? "public-intake-email-job" };
    },
  };
}

function testServer(
  input: {
    repository?: InMemoryOpenPracticeRepository;
    emailJobQueue?: ApiJobQueue;
  } = {},
) {
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    jwtSecret,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    emailJobQueue: input.emailJobQueue,
    publicConsultationIntake: {
      firmId: "firm-west-legal",
      actorUserId: "user-admin",
      allowedOrigins: ["https://crockettparalegal.ca", "http://localhost:4321"],
    },
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
  });
  servers.push(server);
  return { repository, server };
}

async function enableSmtp(repository: InMemoryOpenPracticeRepository): Promise<void> {
  const now = new Date().toISOString();
  await repository.upsertProviderSetting({
    id: "provider-smtp-public-intake-test",
    firmId: "firm-west-legal",
    kind: "smtp",
    key: "mailpit",
    enabled: true,
    encryptedConfig: "{}",
    createdAt: now,
    updatedAt: now,
  });
}

const publicPayload = {
  clientName: "Synthetic Public Client",
  telephone: "604-555-0100",
  email: "client@example.test",
  opposingPartyNames: "Synthetic Employer; Other Party",
  matterDescription: "Synthetic employment matter description with a deadline next week.",
  sourceUrl: "https://crockettparalegal.ca/#consultation-intake",
  disclosureAccepted: true,
  website: "",
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("public consultation intake routes", () => {
  it("accepts a public submission, persists pending review, and queues a redacted notification job", async () => {
    const queue = jobQueue();
    const { repository, server } = testServer({ emailJobQueue: queue });
    await enableSmtp(repository);

    const response = await server.inject({
      method: "POST",
      url: "/api/public/consultation-intakes",
      headers: { origin: "https://crockettparalegal.ca" },
      payload: publicPayload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "pending_review",
      notificationEmail: {
        templateKey: "public_consultation_intake.received",
        status: "queued",
      },
    });

    const [intake] = await repository.listPublicConsultationIntakes("firm-west-legal");
    expect(intake).toMatchObject({
      status: "pending",
      clientName: "Synthetic Public Client",
      telephone: "604-555-0100",
      opposingPartyNames: ["Synthetic Employer", "Other Party"],
      notificationEmailId: expect.any(String),
    });

    const [email] = await repository.listEmailOutbox("firm-west-legal");
    expect(email).toMatchObject({
      matterId: undefined,
      from: "info@crockettparalegal.ca",
      to: ["bryan@crockettparalegal.ca"],
      relatedResourceType: "public_consultation_intake",
      relatedResourceId: intake?.id,
    });
    expect(email?.textBody).toContain("Synthetic employment matter description");

    const jobs = await repository.listJobLifecycleRecords("firm-west-legal");
    expect(jobs).toHaveLength(1);
    const jobMetadata = JSON.stringify(jobs[0]?.metadata);
    expect(jobMetadata).toContain(intake?.id ?? "");
    expect(jobMetadata).not.toContain("Synthetic employment matter description");
    expect(jobMetadata).not.toContain("604-555-0100");
    expect(JSON.stringify(queue.added)).not.toContain("Synthetic employment matter description");
  });

  it("rejects submissions from origins that are not configured", async () => {
    const { repository, server } = testServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/public/consultation-intakes",
      headers: { origin: "https://not-crockett.example" },
      payload: publicPayload,
    });

    expect(response.statusCode).toBe(403);
    await expect(repository.listPublicConsultationIntakes("firm-west-legal")).resolves.toEqual([]);
  });

  it("absorbs honeypot submissions without creating a pending intake", async () => {
    const { repository, server } = testServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/public/consultation-intakes",
      headers: { origin: "https://crockettparalegal.ca" },
      payload: { ...publicPayload, website: "bot-value" },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ status: "received" });
    await expect(repository.listPublicConsultationIntakes("firm-west-legal")).resolves.toEqual([]);
  });

  it("saves notification settings, dismisses pending requests, and converts accepted requests to intake matters", async () => {
    const { repository, server } = testServer();

    const settingsResponse = await server.inject({
      method: "PUT",
      url: "/api/public-consultation-intakes/settings",
      payload: {
        enabled: true,
        senderAddress: "info@crockettparalegal.ca",
        recipientEmails: ["bryan@crockettparalegal.ca", "office@example.test"],
        allowedOrigins: ["https://crockettparalegal.ca", "http://localhost:4321"],
        reviewOwnerUserId: "user-admin",
      },
    });
    expect(settingsResponse.statusCode).toBe(200);

    const getSettingsResponse = await server.inject({
      method: "GET",
      url: "/api/public-consultation-intakes/settings",
    });
    expect(getSettingsResponse.json()).toMatchObject({
      recipientEmails: ["bryan@crockettparalegal.ca", "office@example.test"],
      reviewOwnerUserId: "user-admin",
    });

    const dismissedIntake = await repository.createPublicConsultationIntake({
      id: "public-intake-dismiss",
      firmId: "firm-west-legal",
      status: "pending",
      clientName: "Dismissed Client",
      telephone: "604-555-0200",
      opposingPartyNames: ["Dismissed Opponent"],
      matterDescription: "Synthetic dismissed matter.",
      disclosureAcceptedAt: "2026-05-26T12:00:00.000Z",
      submittedAt: "2026-05-26T12:00:00.000Z",
      metadata: {},
    });
    const dismissResponse = await server.inject({
      method: "POST",
      url: `/api/public-consultation-intakes/${dismissedIntake.id}/dismiss`,
      payload: { reason: "Outside scope" },
    });
    expect(dismissResponse.statusCode).toBe(200);
    expect(dismissResponse.json().intake).toMatchObject({
      id: dismissedIntake.id,
      status: "dismissed",
      dismissedReason: "Outside scope",
    });

    const acceptedIntake = await repository.createPublicConsultationIntake({
      id: "public-intake-convert",
      firmId: "firm-west-legal",
      status: "pending",
      clientName: "Converted Client",
      telephone: "604-555-0300",
      email: "converted@example.test",
      opposingPartyNames: ["Converted Opponent"],
      matterDescription: "Synthetic accepted matter.",
      disclosureAcceptedAt: "2026-05-26T12:05:00.000Z",
      submittedAt: "2026-05-26T12:05:00.000Z",
      metadata: {},
    });
    const convertResponse = await server.inject({
      method: "POST",
      url: `/api/public-consultation-intakes/${acceptedIntake.id}/convert`,
      payload: { practiceArea: "consultation", jurisdiction: "BC" },
    });
    expect(convertResponse.statusCode).toBe(201);
    expect(convertResponse.json().intake).toMatchObject({
      id: acceptedIntake.id,
      status: "converted",
      convertedMatterId: expect.any(String),
    });
    expect(convertResponse.json().matter).toMatchObject({
      status: "intake",
      title: "Consultation request - Converted Client",
    });
    expect(convertResponse.json().matter.parties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "prospective_client", adverse: false }),
        expect.objectContaining({ role: "opposing_party", adverse: true }),
      ]),
    );
  });
});
