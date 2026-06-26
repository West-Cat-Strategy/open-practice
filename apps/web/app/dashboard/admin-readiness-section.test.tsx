import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminReadinessSection, buildAdminReadinessSummary } from "./admin-readiness-section";
import { emptyProvidersStatusResponse } from "../provider-status-dashboard";
import type {
  CapabilitiesResponse,
  EmailSettings,
  ImapSettings,
  MatterSummary,
  PracticeOverview,
  ProvidersStatusResponse,
  SessionResponse,
  SetupStatusResponse,
  StaffReportingWorkspaceResponse,
  WorkerHealthResponse,
} from "../types";

const session: SessionResponse = {
  user: {
    id: "user-admin",
    firmId: "firm-west-legal",
    displayName: "Owner Admin",
    email: "owner@example.test",
    role: "owner_admin",
    assignedMatterIds: ["matter-001"],
    mfaEnabled: true,
  },
};

const capabilities: CapabilitiesResponse = {
  sections: [
    {
      key: "matters",
      label: "Matters",
      enabled: true,
      resource: "matter",
      actions: ["read", "create"],
    },
    {
      key: "reports",
      label: "Reports",
      enabled: true,
      resource: "report",
      actions: ["read", "export"],
    },
    {
      key: "audit",
      label: "Audit",
      enabled: true,
      resource: "audit_log",
      actions: ["read"],
    },
  ],
};

const overview: PracticeOverview = {
  firm: { id: "firm-west-legal", name: "West Legal", defaultProvince: "BC" },
  metrics: {
    openMatters: 1,
    intakeMatters: 0,
    portalGrants: 0,
    trustBalanceCents: 0,
    unbilledMinutes: 0,
  },
  users: [session.user],
};

const setupStatus: SetupStatusResponse = {
  required: false,
  blocked: false,
};

const reportingWorkspace = {
  generatedAt: "2026-05-30T00:00:00.000Z",
  definitions: [{ key: "invoice_aging" }],
  exportProfiles: [{ id: "csv_summary" }],
  reports: [],
  history: [],
  workspacePolicy: {
    customSql: false,
    biEmbeds: false,
    scheduledEmailDelivery: false,
    rawReportBodiesInJobMetadata: false,
  },
} as unknown as StaffReportingWorkspaceResponse;

const workerHealth: WorkerHealthResponse = {
  status: "healthy",
  generatedAt: "2026-05-30T00:00:00.000Z",
  configuredQueues: 2,
  reservedQueues: 0,
  notConfiguredQueues: 0,
  totalRuns: 3,
  activeOrQueued: 0,
  failed: 0,
  stalled: 0,
  queues: [],
};

const matters = [{ id: "matter-001" }] as unknown as MatterSummary[];

const providerStatus: ProvidersStatusResponse = {
  ...emptyProvidersStatusResponse("read_only_configuration_posture"),
  providerSettings: [
    {
      kind: "inbound_email",
      status: "disabled",
      reason: "provider_disabled",
      providers: [
        {
          key: "maildrop",
          enabled: false,
          disabledReason: "provider_disabled",
          updatedAt: "2026-05-30T00:00:00.000Z",
        },
      ],
    },
  ],
  objectStorage: { status: "configured", provider: "s3" },
  email: {
    status: "configured",
    provider: "mailpit",
    queue: { queueName: "email", status: "configured" },
  },
  inboundEmail: {
    status: "disabled",
    reason: "provider_disabled",
    addresses: [],
    workerQueue: { queueName: "inbound_email", status: "configured" },
  },
  externalUploads: {
    status: "available",
    provider: "s3",
    tokenSigning: "configured",
    s3: "configured",
  },
  documentProcessing: {
    ...emptyProvidersStatusResponse().documentProcessing,
    status: "disabled",
    reason: "not_configured",
    workerQueues: [{ queueName: "ocr", status: "not_configured", reason: "queue_not_configured" }],
  },
  bullmq: {
    producerQueues: [{ queueName: "email", status: "configured" }],
    workerQueues: [
      { queueName: "email", status: "configured" },
      { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
      {
        queueName: "ai_triage",
        status: "reserved",
        reason: "deferred_worker",
        task: "classification",
        actionable: false,
      },
    ],
    reservedWorkerQueues: [
      {
        queueName: "ai_triage",
        status: "reserved",
        reason: "deferred_worker",
        task: "classification",
        actionable: false,
      },
    ],
  },
  jobs: {
    summary: { total: 2, queued: 1, active: 0, failed: 1, terminal: 0, byQueue: [] },
    latestRuns: [],
  },
};

const emailSettings: EmailSettings = {
  key: "default",
  enabled: true,
  host: "smtp.example.test",
  port: 587,
  secure: false,
  username: "mailer@example.test",
  fromAddress: "Open Practice <mailer@example.test>",
  passwordConfigured: true,
  configValid: true,
  missingFields: [],
  createdAt: "2026-05-30T00:00:00.000Z",
  updatedAt: "2026-05-30T00:00:00.000Z",
};

const imapSettings: ImapSettings = {
  key: "imap",
  enabled: true,
  host: "imap.example.test",
  port: 993,
  secure: true,
  username: "inbound@example.test",
  mailbox: "INBOX",
  pollIntervalSeconds: 300,
  markSeen: false,
  passwordConfigured: true,
  uidValidity: 12,
  lastSuccessfullyQueuedUid: 30,
  lastPollAt: "2026-05-30T00:00:00.000Z",
  lastSuccessfulPollAt: "2026-05-30T00:00:00.000Z",
  nextPollAt: "2026-05-30T00:05:00.000Z",
  configValid: true,
  missingFields: [],
  createdAt: "2026-05-30T00:00:00.000Z",
  updatedAt: "2026-05-30T00:00:00.000Z",
};

function input() {
  return {
    apiBaseUrl: "http://127.0.0.1:4000",
    capabilities,
    devHeaders: { "x-open-practice-dev-user": "owner@example.test" },
    emailSettings,
    imapSettings,
    matters,
    overview,
    providerStatus,
    reportingWorkspace,
    session,
    setupStatus,
    workerHealth,
  };
}

describe("AdminReadinessSection", () => {
  it("summarizes support posture without creating impersonation claims", () => {
    const summary = buildAdminReadinessSummary(input());

    expect(summary.access).toContainEqual(
      expect.objectContaining({
        key: "support-access",
        status: "disabled",
        detail: expect.stringContaining("No support impersonation"),
      }),
    );
    expect(summary.operations).toContainEqual(
      expect.objectContaining({
        key: "regional-privacy",
        detail: expect.stringContaining("does not claim regional hosting guarantees"),
      }),
    );
    expect(summary.providers).toContainEqual(
      expect.objectContaining({
        key: "provider-required-blockers",
        status: "blocked",
        detail: expect.stringContaining("OCR queue not configured: queue not configured"),
      }),
    );
    expect(summary.providers).toContainEqual(
      expect.objectContaining({
        key: "provider-disabled-boundaries",
        detail: expect.stringContaining("inbound email disabled: provider disabled · maildrop"),
      }),
    );
    expect(summary.providers).toContainEqual(
      expect.objectContaining({
        key: "provider-watch-items",
        detail: expect.stringContaining("1 failed provider jobs"),
      }),
    );
    expect(
      buildAdminReadinessSummary({
        ...input(),
        providerStatus: {
          ...providerStatus,
          email: {
            ...providerStatus.email,
            status: "degraded",
            reason: "provider_rate_limited",
            provider: "mailpit",
          },
        },
      }).providers,
    ).toContainEqual(
      expect.objectContaining({
        key: "provider-required-blockers",
        detail: expect.stringContaining("outbound email degraded: provider rate limited · mailpit"),
      }),
    );
    expect(summary.operations).toContainEqual(
      expect.objectContaining({
        key: "private-pilot-object-storage-blocker",
        status: "proof-gated",
        tone: "review",
        detail: expect.stringContaining("current source-only MinIO posture"),
      }),
    );
  });

  it("renders bounded export and backup/restore readiness copy", () => {
    const markup = renderToStaticMarkup(createElement(AdminReadinessSection, input()));

    expect(markup).toContain("Portability and migration");
    expect(markup).toContain("bounded staff export metadata");
    expect(markup).toContain("Backup and restore evidence");
    expect(markup).toContain("no hosted backup guarantee");
    expect(markup).toContain("Provider readiness");
    expect(markup).toContain("read-only posture");
    expect(markup).toContain("Required provider blockers");
    expect(markup).toContain("Optional disabled boundaries");
    expect(markup).toContain("Private-pilot object storage proof");
    expect(markup).toContain("local residual-watch");
    expect(markup).toContain("External HTTPS S3");
    expect(markup).toContain("same-contract remediation candidate");
    expect(markup).not.toContain("private deployment");
    expect(markup).not.toContain("synthetic-secret");
  });

  it("renders email settings without exposing configured secrets", () => {
    const markup = renderToStaticMarkup(createElement(AdminReadinessSection, input()));

    expect(markup).toContain("Transactional SMTP");
    expect(markup).toContain("Inbound IMAP");
    expect(markup).toContain("smtp.example.test");
    expect(markup).toContain("imap.example.test");
    expect(markup).not.toContain('value="Configured"');
    expect(markup).not.toContain("synthetic-smtp-secret");
    expect(markup).not.toContain("synthetic-imap-secret");
  });
});
