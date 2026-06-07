import type { HostedPaymentRequestRecord } from "@open-practice/domain";
import { and, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type { HostedPaymentRequestUpdate } from "../hosted-payment-requests-contracts.js";
import { clone } from "../contracts.js";
import { hostedPaymentRequestInsert, mapHostedPaymentRequestRow } from "../drizzle-mappers.js";

export async function createDrizzleHostedPaymentRequest(
  db: OpenPracticeDatabase,
  request: HostedPaymentRequestRecord,
): Promise<HostedPaymentRequestRecord> {
  await db.insert(schema.hostedPaymentRequests).values(hostedPaymentRequestInsert(request));
  return clone(request);
}

export async function getDrizzleHostedPaymentRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  requestId: string,
): Promise<HostedPaymentRequestRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.hostedPaymentRequests)
    .where(
      and(
        eq(schema.hostedPaymentRequests.firmId, firmId),
        eq(schema.hostedPaymentRequests.id, requestId),
      ),
    );
  return row ? mapHostedPaymentRequestRow(row) : undefined;
}

export async function listDrizzleHostedPaymentRequests(
  db: OpenPracticeDatabase,
  firmId: string,
  options: {
    matterId?: string;
    invoiceId?: string;
    status?: HostedPaymentRequestRecord["status"];
  } = {},
): Promise<HostedPaymentRequestRecord[]> {
  const filters = [eq(schema.hostedPaymentRequests.firmId, firmId)];
  if (options.matterId) filters.push(eq(schema.hostedPaymentRequests.matterId, options.matterId));
  if (options.invoiceId)
    filters.push(eq(schema.hostedPaymentRequests.invoiceId, options.invoiceId));
  if (options.status) filters.push(eq(schema.hostedPaymentRequests.status, options.status));
  const rows = await db
    .select()
    .from(schema.hostedPaymentRequests)
    .where(and(...filters));
  return rows.map(mapHostedPaymentRequestRow);
}

export async function updateDrizzleHostedPaymentRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  requestId: string,
  updates: HostedPaymentRequestUpdate,
): Promise<HostedPaymentRequestRecord> {
  const setValues: Partial<typeof schema.hostedPaymentRequests.$inferInsert> = {};
  if ("status" in updates) setValues.status = updates.status;
  if ("delivery" in updates) setValues.delivery = updates.delivery;
  if ("reminder" in updates) setValues.reminder = updates.reminder;
  if ("paymentPlan" in updates) setValues.paymentPlan = updates.paymentPlan;
  if ("creditWriteOffPosture" in updates) {
    setValues.creditWriteOffPosture = updates.creditWriteOffPosture;
  }
  if ("processor" in updates) setValues.processor = updates.processor;
  if ("evidence" in updates) setValues.evidence = updates.evidence;
  if ("expiresAt" in updates) {
    setValues.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : null;
  }
  if ("updatedAt" in updates) {
    setValues.updatedAt = updates.updatedAt ? new Date(updates.updatedAt) : new Date();
  }

  if (Object.keys(setValues).length === 0) {
    const existing = await getDrizzleHostedPaymentRequest(db, firmId, requestId);
    if (!existing) throw new Error("Hosted payment request was not found");
    return existing;
  }

  const [row] = await db
    .update(schema.hostedPaymentRequests)
    .set(setValues)
    .where(
      and(
        eq(schema.hostedPaymentRequests.firmId, firmId),
        eq(schema.hostedPaymentRequests.id, requestId),
      ),
    )
    .returning();
  if (!row) throw new Error("Hosted payment request was not found");
  return mapHostedPaymentRequestRow(row);
}
