import {
  shouldUpdateSignatureRequestStatus,
  type SignatureProviderEventRecord,
  type SignatureProviderStatus,
  type SignatureRequestRecord,
  type SignatureRequestSignerRecord,
  type SignatureWebhookAttemptRecord,
} from "@open-practice/domain";
import { and, asc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  mapSignatureProviderEventRow,
  mapSignatureRequestRow,
  mapSignatureRequestSignerRow,
  mapSignatureWebhookAttemptRow,
} from "../drizzle-mappers.js";
import type { SignatureRequestCreateInput } from "../signatures-contracts.js";

function clientPortalEmbeddedSignerId(event: SignatureProviderEventRecord): string | undefined {
  return event.evidence.mode === "client_portal_embedded" &&
    typeof event.evidence.signerId === "string"
    ? event.evidence.signerId
    : undefined;
}

export async function listDrizzleSignatureRequests(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string } = {},
): Promise<SignatureRequestRecord[]> {
  const rows = await db
    .select()
    .from(schema.signatureRequests)
    .where(
      options.matterId
        ? and(
            eq(schema.signatureRequests.firmId, firmId),
            eq(schema.signatureRequests.matterId, options.matterId),
          )
        : eq(schema.signatureRequests.firmId, firmId),
    );
  return rows.map(mapSignatureRequestRow);
}

export async function listDrizzleSignatureRequestSigners(
  db: OpenPracticeDatabase,
  firmId: string,
  signatureRequestId: string,
): Promise<SignatureRequestSignerRecord[]> {
  const rows = await db
    .select()
    .from(schema.signatureRequestSigners)
    .where(
      and(
        eq(schema.signatureRequestSigners.firmId, firmId),
        eq(schema.signatureRequestSigners.signatureRequestId, signatureRequestId),
      ),
    );
  return rows.map(mapSignatureRequestSignerRow);
}

export async function createDrizzleSignatureRequest(
  db: OpenPracticeDatabase,
  input: SignatureRequestCreateInput,
): Promise<{ request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] }> {
  await db.transaction(async (tx) => {
    await tx.insert(schema.signatureRequests).values({
      ...input.request,
      createdAt: new Date(input.request.createdAt),
      completedAt: input.request.completedAt ? new Date(input.request.completedAt) : null,
      declinedAt: input.request.declinedAt ? new Date(input.request.declinedAt) : null,
    });
    await tx.insert(schema.signatureRequestSigners).values(
      input.signers.map((signer) => ({
        ...signer,
        completedAt: signer.completedAt ? new Date(signer.completedAt) : null,
      })),
    );
    await tx.insert(schema.signatureProviderEvents).values({
      ...input.event,
      occurredAt: new Date(input.event.occurredAt),
    });
  });
  return { request: input.request, signers: input.signers };
}

export async function recordDrizzleSignatureProviderEvent(
  db: OpenPracticeDatabase,
  event: SignatureProviderEventRecord,
  webhookAttempt?: SignatureWebhookAttemptRecord,
): Promise<SignatureProviderEventRecord> {
  const [current] = await db
    .select()
    .from(schema.signatureRequests)
    .where(
      and(
        eq(schema.signatureRequests.firmId, event.firmId),
        eq(schema.signatureRequests.id, event.signatureRequestId),
      ),
    );
  const signerId = clientPortalEmbeddedSignerId(event);
  const [currentSigner] = signerId
    ? await db
        .select()
        .from(schema.signatureRequestSigners)
        .where(
          and(
            eq(schema.signatureRequestSigners.firmId, event.firmId),
            eq(schema.signatureRequestSigners.id, signerId),
            eq(schema.signatureRequestSigners.signatureRequestId, event.signatureRequestId),
          ),
        )
    : [];
  await db.transaction(async (tx) => {
    await tx.insert(schema.signatureProviderEvents).values({
      ...event,
      occurredAt: new Date(event.occurredAt),
    });
    if (webhookAttempt) {
      await tx.insert(schema.signatureWebhookAttempts).values({
        ...webhookAttempt,
        receivedAt: new Date(webhookAttempt.receivedAt),
        processedAt: webhookAttempt.processedAt ? new Date(webhookAttempt.processedAt) : null,
      });
    }
    if (
      signerId &&
      currentSigner &&
      shouldUpdateSignatureRequestStatus(currentSigner.status as SignatureProviderStatus, event)
    ) {
      await tx
        .update(schema.signatureRequestSigners)
        .set({
          status: event.status,
          completedAt: event.status === "completed" ? new Date(event.occurredAt) : undefined,
        })
        .where(
          and(
            eq(schema.signatureRequestSigners.firmId, event.firmId),
            eq(schema.signatureRequestSigners.id, signerId),
            eq(schema.signatureRequestSigners.signatureRequestId, event.signatureRequestId),
          ),
        );
    }
    if (event.evidence.mode === "client_portal_embedded") {
      return;
    }
    if (
      current &&
      shouldUpdateSignatureRequestStatus(current.status as SignatureProviderStatus, event)
    ) {
      await tx
        .update(schema.signatureRequests)
        .set({
          status: event.status,
          evidence: event.evidence,
          completedAt: event.status === "completed" ? new Date(event.occurredAt) : undefined,
          declinedAt: event.status === "declined" ? new Date(event.occurredAt) : undefined,
        })
        .where(
          and(
            eq(schema.signatureRequests.firmId, event.firmId),
            eq(schema.signatureRequests.id, event.signatureRequestId),
          ),
        );
    }
  });
  return event;
}

export async function recordDrizzleSignatureWebhookAttempt(
  db: OpenPracticeDatabase,
  attempt: SignatureWebhookAttemptRecord,
): Promise<SignatureWebhookAttemptRecord> {
  await db.insert(schema.signatureWebhookAttempts).values({
    ...attempt,
    receivedAt: new Date(attempt.receivedAt),
    processedAt: attempt.processedAt ? new Date(attempt.processedAt) : null,
  });
  return attempt;
}

export async function listDrizzleSignatureProviderEvents(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { signatureRequestId?: string } = {},
): Promise<SignatureProviderEventRecord[]> {
  const rows = await db
    .select()
    .from(schema.signatureProviderEvents)
    .where(
      options.signatureRequestId
        ? and(
            eq(schema.signatureProviderEvents.firmId, firmId),
            eq(schema.signatureProviderEvents.signatureRequestId, options.signatureRequestId),
          )
        : eq(schema.signatureProviderEvents.firmId, firmId),
    )
    .orderBy(asc(schema.signatureProviderEvents.occurredAt));
  return rows.map(mapSignatureProviderEventRow);
}

export async function listDrizzleSignatureWebhookAttempts(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { provider?: SignatureWebhookAttemptRecord["provider"]; externalId?: string } = {},
): Promise<SignatureWebhookAttemptRecord[]> {
  const filters = [eq(schema.signatureWebhookAttempts.firmId, firmId)];
  if (options.provider)
    filters.push(eq(schema.signatureWebhookAttempts.provider, options.provider));
  if (options.externalId) {
    filters.push(eq(schema.signatureWebhookAttempts.externalId, options.externalId));
  }
  const rows = await db
    .select()
    .from(schema.signatureWebhookAttempts)
    .where(and(...filters))
    .orderBy(asc(schema.signatureWebhookAttempts.receivedAt));
  return rows.map(mapSignatureWebhookAttemptRow);
}
