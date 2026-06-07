import type { FastifyInstance } from "fastify";
import {
  type CalendarEventRecord,
  type CalendarGuestLinkRecord,
  canShareDocumentThroughPortal,
  type Contact,
  type ConversationThreadRecord,
  type DocumentRecord,
  type EmailOutboxRecord,
  type EmailReceiptTokenRecord,
  type ExternalUploadLinkRecord,
  type HostedPaymentRequestRecord,
  type IntakeFormItemActionRecord,
  type IntakeFormLinkRecord,
  type Matter,
  type PortalGrant,
  type ShareLinkRecord,
  type User,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  activePortalGrant,
  contactMatchesUser,
  hasPortalPermission,
  normalizedEmail,
  sanitizedUser,
  uniquePermissions,
} from "./shared.js";

type ClientPortalActionTone = "neutral" | "ready" | "risk";

type ClientPortalActionFamily =
  | "secure_share"
  | "external_upload"
  | "intake"
  | "guest_session"
  | "receipt"
  | "client_update"
  | "client_action"
  | "payment_request";

interface ClientPortalActionDetail {
  label: string;
  value: string;
  tone?: ClientPortalActionTone;
}

interface ClientPortalActionSummary {
  id: string;
  family: ClientPortalActionFamily;
  matterId: string;
  title: string;
  detail: string;
  status: string;
  tone: ClientPortalActionTone;
  updatedAt?: string;
  details?: ClientPortalActionDetail[];
}

interface ClientPortalMatterActionGroup {
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  actionCount: number;
  attentionCount: number;
  actions: ClientPortalActionSummary[];
}

type ClientPortalInvoiceRecord = Awaited<
  ReturnType<ApiRouteDependencies["repository"]["listInvoices"]>
>[number];

interface ClientPortalPaymentRequestSummary {
  id: string;
  status: string;
  amountCents: number;
  currency: HostedPaymentRequestRecord["currency"];
  deliveryStatus: string;
  reminderStatus: string;
  paymentPlanStatus: string;
  expiresAt?: string;
  updatedAt: string;
}

interface ClientPortalBillSummary {
  id: string;
  matterId: string;
  invoiceNumber: string;
  status: string;
  issuedAt?: string;
  dueAt?: string;
  totalCents: number;
  paidCents: number;
  balanceDueCents: number;
  currency: HostedPaymentRequestRecord["currency"];
  tone: ClientPortalActionTone;
  paymentRequestCount: number;
  paymentRequests: ClientPortalPaymentRequestSummary[];
}

interface ClientPortalMatterBillingGroup {
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  billCount: number;
  balanceDueCents: number;
  attentionCount: number;
  bills: ClientPortalBillSummary[];
}

interface ClientPortalBillingWorkspace {
  currency: HostedPaymentRequestRecord["currency"];
  billCount: number;
  totalBalanceDueCents: number;
  openPaymentRequestCount: number;
  attentionBillCount: number;
  matterBills: ClientPortalMatterBillingGroup[];
}

function expiredAt(value: string | undefined, now: string): boolean {
  return Boolean(value && Date.parse(value) <= Date.parse(now));
}

function formatCad(amountCents: number, currency: HostedPaymentRequestRecord["currency"]): string {
  return `${currency} ${(amountCents / 100).toFixed(2)}`;
}

function intakeLinkStatus(link: IntakeFormLinkRecord, now: string): string {
  if (link.revokedAt) return "revoked";
  if (link.submittedAt) return "submitted";
  if (expiredAt(link.expiresAt, now)) return "expired";
  return "active";
}

function receiptStatus(token: EmailReceiptTokenRecord, now: string): string {
  if (token.recordedAt) return "recorded";
  if (expiredAt(token.expiresAt, now)) return "expired";
  return "open";
}

function shareLinkStatus(link: ShareLinkRecord, now: string): string {
  if (link.revokedAt) return "revoked";
  if (expiredAt(link.expiresAt, now)) return "expired";
  return "active";
}

function externalUploadLinkStatus(link: ExternalUploadLinkRecord, now: string): string {
  if (link.revokedAt) return "revoked";
  if (expiredAt(link.expiresAt, now)) return "expired";
  if (link.usedUploads >= link.maxUploads) return "upload_limit_reached";
  return "active";
}

function guestLinkStatus(link: CalendarGuestLinkRecord, now: string): string {
  if (link.revokedAt) return "revoked";
  if (expiredAt(link.expiresAt, now)) return "expired";
  return link.status;
}

function paymentRequestStatus(request: HostedPaymentRequestRecord, now: string): string {
  if (request.status === "cancelled") return "cancelled";
  if (expiredAt(request.expiresAt, now)) return "expired";
  return request.status;
}

function clientVisibleInvoice(
  invoice: ClientPortalInvoiceRecord,
  contactIds: Set<string>,
): boolean {
  if (!invoice.clientContactId || !contactIds.has(invoice.clientContactId)) return false;
  return ["issued", "partially_paid", "paid"].includes(invoice.status);
}

function intakeActions(input: {
  links: IntakeFormLinkRecord[];
  itemActions: IntakeFormItemActionRecord[];
  contactId: string;
  now: string;
}): ClientPortalActionSummary[] {
  return input.links
    .filter((link) => link.clientContactId === input.contactId)
    .flatMap((link) => {
      const status = intakeLinkStatus(link, input.now);
      const incompleteItemActions = input.itemActions.filter(
        (action) =>
          action.formLinkId === link.id && !["completed", "declined"].includes(action.status),
      );
      const summaries: ClientPortalActionSummary[] = [
        {
          id: `intake:${link.id}`,
          family: "intake",
          matterId: link.matterId,
          title: status === "active" ? "Complete intake form" : "Intake form status",
          detail:
            status === "active"
              ? `${incompleteItemActions.length} embedded form action${
                  incompleteItemActions.length === 1 ? "" : "s"
                } pending.`
              : `This intake form is ${status}.`,
          status,
          tone: status === "active" ? "risk" : status === "submitted" ? "ready" : "neutral",
          updatedAt: link.submittedAt ?? link.draftUpdatedAt ?? link.createdAt,
        },
      ];
      for (const action of incompleteItemActions) {
        summaries.push({
          id: `client-action:intake:${action.id}`,
          family: "client_action",
          matterId: action.matterId,
          title: action.kind === "signature" ? "Signature item pending" : "Upload item pending",
          detail: `Form item ${action.itemId} is ${action.status.replaceAll("_", " ")}.`,
          status: action.status,
          tone: "risk",
          updatedAt: action.completedAt ?? action.createdAt,
        });
      }
      return summaries;
    });
}

function receiptActions(input: {
  tokens: EmailReceiptTokenRecord[];
  emails: EmailOutboxRecord[];
  userEmail: string;
  now: string;
}): ClientPortalActionSummary[] {
  const emailById = new Map(input.emails.map((email) => [email.id, email]));
  const normalizedUserEmail = normalizedEmail(input.userEmail);
  return input.tokens.flatMap((token) => {
    const email = emailById.get(token.emailId);
    const addressedToClient = email?.to.some(
      (recipient) => normalizedEmail(recipient) === normalizedUserEmail,
    );
    if (!email || !addressedToClient) return [];
    const status = receiptStatus(token, input.now);
    return [
      {
        id: `receipt:${token.id}`,
        family: "receipt",
        matterId: token.matterId,
        title: status === "open" ? "Acknowledge email receipt" : "Email receipt status",
        detail: `${email.templateKey} delivery receipt is ${status}.`,
        status,
        tone: status === "open" ? "risk" : status === "recorded" ? "ready" : "neutral",
        updatedAt: token.recordedAt ?? token.createdAt,
      },
    ];
  });
}

function isClientUpdateEmail(email: EmailOutboxRecord): boolean {
  return email.templateKey === "client.update" || email.templateKey === "client_update";
}

function clientUpdateActions(input: {
  emails: EmailOutboxRecord[];
  userEmail: string;
}): ClientPortalActionSummary[] {
  const normalizedUserEmail = normalizedEmail(input.userEmail);
  return input.emails.flatMap((email) => {
    if (!email.matterId) return [];
    if (!isClientUpdateEmail(email)) return [];
    if (!email.to.some((recipient) => normalizedEmail(recipient) === normalizedUserEmail)) {
      return [];
    }
    return {
      id: `client-update:${email.id}`,
      family: "client_update" as const,
      matterId: email.matterId,
      title: "Client update",
      detail: `Client update is ${email.status}.`,
      status: email.status,
      tone:
        email.status === "sent"
          ? ("ready" as const)
          : email.status === "failed"
            ? "risk"
            : "neutral",
      updatedAt: email.sentAt ?? email.failedAt ?? email.lastAttemptAt ?? email.queuedAt,
    };
  });
}

function secureShareActions(input: {
  shares: ShareLinkRecord[];
  documents: DocumentRecord[];
  grants: PortalGrant[];
  now: string;
}): ClientPortalActionSummary[] {
  return input.shares.map((share) => {
    const status = shareLinkStatus(share, input.now);
    const shareableDocumentCount = input.documents.filter((document) =>
      input.grants.some((grant) =>
        canShareDocumentThroughPortal({ document, grant, now: input.now }),
      ),
    ).length;
    return {
      id: `secure-share:${share.id}`,
      family: "secure_share",
      matterId: share.matterId,
      title: status === "active" ? "Secure document share active" : "Secure share status",
      detail:
        status === "active"
          ? `${shareableDocumentCount} reviewed document${
              shareableDocumentCount === 1 ? "" : "s"
            } are available through staff-controlled sharing.`
          : `This secure share is ${status}.`,
      status,
      tone: status === "active" ? "ready" : "neutral",
      updatedAt: share.revokedAt ?? share.createdAt,
      details: [
        { label: "Documents", value: String(shareableDocumentCount) },
        {
          label: "Email check",
          value: share.requireEmailVerification ? "required" : "not required",
        },
      ],
    };
  });
}

function externalUploadActions(input: {
  links: ExternalUploadLinkRecord[];
  documents: DocumentRecord[];
  now: string;
}): ClientPortalActionSummary[] {
  return input.links.map((link) => {
    const status = externalUploadLinkStatus(link, input.now);
    const uploadedDocuments = input.documents.filter(
      (document) => document.externalUploadLinkId === link.id,
    );
    const retryDocuments = uploadedDocuments.filter(
      (document) =>
        document.reviewStatus === "retry_requested" || document.reviewDecision === "request_retry",
    );
    const remainingUploads = Math.max(0, link.maxUploads - link.usedUploads);
    const hasRetry = retryDocuments.length > 0;
    return {
      id: `external-upload:${link.id}`,
      family: "external_upload",
      matterId: link.matterId,
      title:
        status === "active"
          ? hasRetry
            ? "Upload retry requested"
            : "Upload requested documents"
          : "External upload status",
      detail: hasRetry
        ? `${retryDocuments.length} uploaded document${
            retryDocuments.length === 1 ? "" : "s"
          } need retry review.`
        : `${remainingUploads} upload${remainingUploads === 1 ? "" : "s"} remain for this request.`,
      status: hasRetry ? "retry_requested" : status,
      tone: status === "active" && (remainingUploads > 0 || hasRetry) ? "risk" : "neutral",
      updatedAt: link.revokedAt ?? link.createdAt,
      details: [
        { label: "Uploaded", value: String(link.usedUploads) },
        {
          label: "Remaining",
          value: String(remainingUploads),
          tone: remainingUploads > 0 ? "risk" : "neutral",
        },
        { label: "Reviewed", value: String(uploadedDocuments.length) },
      ],
    };
  });
}

function guestSessionActions(input: {
  guestLinks: CalendarGuestLinkRecord[];
  events: CalendarEventRecord[];
  now: string;
}): ClientPortalActionSummary[] {
  const eventsById = new Map(input.events.map((event) => [event.id, event]));
  return input.guestLinks.map((link) => {
    const event = eventsById.get(link.eventId);
    const status = guestLinkStatus(link, input.now);
    return {
      id: `guest-session:${link.id}`,
      family: "guest_session",
      matterId: link.matterId,
      title: status === "issued" ? "Meeting access issued" : "Meeting access status",
      detail: event
        ? `A client meeting is ${event.status} for ${event.startsAt}.`
        : `Meeting access is ${status}.`,
      status,
      tone: status === "issued" || status === "checked_in" ? "risk" : "neutral",
      updatedAt: link.checkedInAt ?? link.admittedAt ?? link.deniedAt ?? link.updatedAt,
      details: [
        ...(event ? [{ label: "Event", value: event.status }] : []),
        { label: "Expires", value: link.expiresAt },
      ],
    };
  });
}

function conversationActions(threads: ConversationThreadRecord[]): ClientPortalActionSummary[] {
  const visibleThreads = threads.filter(
    (thread) => thread.status !== "revoked" && !thread.accessRevokedAt,
  );
  const openThreads = visibleThreads.filter((thread) => thread.status === "open");
  if (visibleThreads.length === 0) return [];
  const latestThread = visibleThreads[0]!;
  return [
    {
      id: `client-action:conversation:${latestThread.matterId}`,
      family: "client_action",
      matterId: latestThread.matterId,
      title: openThreads.length > 0 ? "Message thread available" : "Message thread status",
      detail: `${visibleThreads.length} redacted message thread${
        visibleThreads.length === 1 ? "" : "s"
      } are linked to this matter.`,
      status: openThreads.length > 0 ? "open" : "closed",
      tone: openThreads.length > 0 ? "neutral" : "ready",
      updatedAt: latestThread.updatedAt,
      details: [
        { label: "Open threads", value: String(openThreads.length) },
        { label: "Bodies", value: "redacted" },
      ],
    },
  ];
}

function paymentRequestActions(input: {
  requests: HostedPaymentRequestRecord[];
  invoices: Awaited<ReturnType<ApiRouteDependencies["repository"]["listInvoices"]>>;
  contactIds: Set<string>;
  now: string;
}): ClientPortalActionSummary[] {
  const invoicesById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
  return input.requests.flatMap((request) => {
    if (!request.clientContactId || !input.contactIds.has(request.clientContactId)) return [];
    const invoice = invoicesById.get(request.invoiceId);
    if (!invoice?.clientContactId || !input.contactIds.has(invoice.clientContactId)) return [];
    const status = paymentRequestStatus(request, input.now);
    return {
      id: `payment-request:${request.id}`,
      family: "payment_request" as const,
      matterId: request.matterId,
      title:
        status === "sent" || status === "viewed"
          ? "Payment request pending"
          : "Payment request status",
      detail: `Invoice ${invoice?.invoiceNumber ?? request.invoiceId} has a ${formatCad(
        request.amountCents,
        request.currency,
      )} hosted payment request.`,
      status,
      tone:
        status === "sent" || status === "viewed"
          ? "risk"
          : status === "expired"
            ? "neutral"
            : "ready",
      updatedAt: request.updatedAt,
      details: [
        { label: "Invoice", value: invoice?.invoiceNumber ?? request.invoiceId },
        { label: "Amount", value: formatCad(request.amountCents, request.currency) },
        { label: "Delivery", value: request.delivery.status },
        { label: "Reminder", value: request.reminder.status },
      ],
    };
  });
}

function clientVisiblePaymentRequests(input: {
  requests: HostedPaymentRequestRecord[];
  invoice: ClientPortalInvoiceRecord;
  contactIds: Set<string>;
  now: string;
}): ClientPortalPaymentRequestSummary[] {
  return input.requests.flatMap((request) => {
    if (request.invoiceId !== input.invoice.id) return [];
    if (!request.clientContactId || !input.contactIds.has(request.clientContactId)) return [];
    if (
      !input.invoice.clientContactId ||
      request.clientContactId !== input.invoice.clientContactId
    ) {
      return [];
    }
    return {
      id: request.id,
      status: paymentRequestStatus(request, input.now),
      amountCents: request.amountCents,
      currency: request.currency,
      deliveryStatus: request.delivery.status,
      reminderStatus: request.reminder.status,
      paymentPlanStatus: request.paymentPlan.status,
      expiresAt: request.expiresAt,
      updatedAt: request.updatedAt,
    };
  });
}

function billTone(input: {
  invoice: ClientPortalInvoiceRecord;
  paymentRequests: ClientPortalPaymentRequestSummary[];
  now: string;
}): ClientPortalActionTone {
  if (input.invoice.status === "paid" || input.invoice.balanceDueCents <= 0) return "ready";
  const openPaymentRequest = input.paymentRequests.some((request) =>
    ["sent", "viewed"].includes(request.status),
  );
  if (openPaymentRequest || expiredAt(input.invoice.dueAt, input.now)) return "risk";
  return "neutral";
}

function billSummaries(input: {
  invoices: ClientPortalInvoiceRecord[];
  paymentRequests: HostedPaymentRequestRecord[];
  contactIds: Set<string>;
  now: string;
}): ClientPortalBillSummary[] {
  return input.invoices
    .filter((invoice) => clientVisibleInvoice(invoice, input.contactIds))
    .map((invoice) => {
      const paymentRequests = clientVisiblePaymentRequests({
        requests: input.paymentRequests,
        invoice,
        contactIds: input.contactIds,
        now: input.now,
      });
      return {
        id: invoice.id,
        matterId: invoice.matterId,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        totalCents: invoice.totalCents,
        paidCents: invoice.paidCents,
        balanceDueCents: invoice.balanceDueCents,
        currency: "CAD" as const,
        tone: billTone({ invoice, paymentRequests, now: input.now }),
        paymentRequestCount: paymentRequests.length,
        paymentRequests,
      };
    })
    .sort(
      (left, right) =>
        (right.dueAt ?? "").localeCompare(left.dueAt ?? "") ||
        right.invoiceNumber.localeCompare(left.invoiceNumber),
    );
}

function sortActions(actions: ClientPortalActionSummary[]): ClientPortalActionSummary[] {
  return [...actions].sort((left, right) => {
    const leftRisk = left.tone === "risk" ? 1 : 0;
    const rightRisk = right.tone === "risk" ? 1 : 0;
    if (leftRisk !== rightRisk) return rightRisk - leftRisk;
    return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
  });
}

function sanitizedMatter(matter: Matter, grants: PortalGrant[], actionCount: number) {
  return {
    id: matter.id,
    number: matter.number,
    title: matter.title,
    status: matter.status,
    permissions: uniquePermissions(grants),
    actionCount,
  };
}

function matterActionGroup(
  matter: Matter,
  actions: ClientPortalActionSummary[],
): ClientPortalMatterActionGroup {
  return {
    matterId: matter.id,
    matterNumber: matter.number,
    matterTitle: matter.title,
    actionCount: actions.length,
    attentionCount: actions.filter((action) => action.tone === "risk").length,
    actions,
  };
}

function matterBillingGroup(
  matter: Matter,
  bills: ClientPortalBillSummary[],
): ClientPortalMatterBillingGroup {
  return {
    matterId: matter.id,
    matterNumber: matter.number,
    matterTitle: matter.title,
    billCount: bills.length,
    balanceDueCents: bills.reduce((sum, bill) => sum + bill.balanceDueCents, 0),
    attentionCount: bills.filter((bill) => bill.tone === "risk").length,
    bills,
  };
}

function billingWorkspace(groups: ClientPortalMatterBillingGroup[]): ClientPortalBillingWorkspace {
  const bills = groups.flatMap((group) => group.bills);
  return {
    currency: "CAD",
    billCount: bills.length,
    totalBalanceDueCents: bills.reduce((sum, bill) => sum + bill.balanceDueCents, 0),
    openPaymentRequestCount: bills.reduce(
      (sum, bill) =>
        sum +
        bill.paymentRequests.filter((request) => ["sent", "viewed"].includes(request.status))
          .length,
      0,
    ),
    attentionBillCount: bills.filter((bill) => bill.tone === "risk" && bill.balanceDueCents > 0)
      .length,
    matterBills: groups,
  };
}

async function clientContactGrants(
  repository: ApiRouteDependencies["repository"],
  user: User,
  now: string,
): Promise<Array<{ grant: PortalGrant; contact: Contact }>> {
  const grants = await repository.listPortalGrants(user.firmId);
  const pairs = await Promise.all(
    grants
      .filter((grant) => activePortalGrant(grant, now))
      .map(async (grant) => {
        const contact = await repository.getContact(grant.firmId, grant.contactId);
        return contact && contactMatchesUser(contact, user) ? { grant, contact } : undefined;
      }),
  );
  return pairs.filter((pair): pair is { grant: PortalGrant; contact: Contact } => Boolean(pair));
}

async function buildWorkspace(
  repository: ApiRouteDependencies["repository"],
  user: User,
  now: string,
) {
  const grantPairs = await clientContactGrants(repository, user, now);
  const grants = grantPairs.map((pair) => pair.grant);
  const matterIds = Array.from(new Set(grants.map((grant) => grant.matterId)));
  const matterSummaries =
    matterIds.length > 0
      ? await repository.listMattersForUser({ ...user, assignedMatterIds: matterIds })
      : [];

  const actionsByMatterId = new Map<string, ClientPortalActionSummary[]>();
  const billingByMatterId = new Map<string, ClientPortalBillSummary[]>();
  for (const matter of matterSummaries) {
    const matterGrants = grants.filter((grant) => grant.matterId === matter.id);
    const contactIds = new Set(matterGrants.map((grant) => grant.contactId));
    const [
      intakeLinks,
      itemActions,
      receiptTokens,
      emails,
      shareLinks,
      externalUploadLinks,
      documents,
      guestLinks,
      calendarEvents,
      conversationThreads,
      invoices,
      paymentRequests,
    ] = await Promise.all([
      repository.listIntakeFormLinks(user.firmId, { matterId: matter.id }),
      repository.listIntakeFormItemActions(user.firmId, {}),
      repository.listEmailReceiptTokens(user.firmId, { matterId: matter.id }),
      repository.listEmailOutbox(user.firmId, { matterId: matter.id, limit: 100 }),
      repository.listShareLinks(user.firmId, { matterId: matter.id }),
      repository.listExternalUploadLinks(user.firmId, { matterId: matter.id }),
      repository.listMatterDocuments(user.firmId, matter.id),
      repository.listCalendarGuestLinks(user.firmId, { matterId: matter.id }),
      repository.listCalendarEvents(user.firmId, { matterId: matter.id }),
      repository.listConversationThreads(user.firmId, { matterId: matter.id }),
      repository.listInvoices(user.firmId, { matterId: matter.id }),
      repository.listHostedPaymentRequests(user.firmId, { matterId: matter.id }),
    ]);
    const matterActions = sortActions([
      ...(hasPortalPermission(matterGrants, "view_documents")
        ? secureShareActions({ shares: shareLinks, documents, grants: matterGrants, now })
        : []),
      ...(hasPortalPermission(matterGrants, "upload_documents")
        ? externalUploadActions({ links: externalUploadLinks, documents, now })
        : []),
      ...(hasPortalPermission(matterGrants, "message")
        ? [
            ...guestSessionActions({ guestLinks, events: calendarEvents, now }),
            ...conversationActions(conversationThreads),
          ]
        : []),
      ...Array.from(contactIds).flatMap((contactId) =>
        intakeActions({ links: intakeLinks, itemActions, contactId, now }),
      ),
      ...clientUpdateActions({ emails, userEmail: user.email }),
      ...receiptActions({ tokens: receiptTokens, emails, userEmail: user.email, now }),
      ...paymentRequestActions({ requests: paymentRequests, invoices, contactIds, now }),
    ]);
    actionsByMatterId.set(matter.id, matterActions);
    billingByMatterId.set(matter.id, billSummaries({ invoices, paymentRequests, contactIds, now }));
  }

  const actions = sortActions([...actionsByMatterId.values()].flat());
  const matterActions = matterSummaries.map((matter) =>
    matterActionGroup(matter, actionsByMatterId.get(matter.id) ?? []),
  );
  const matterBills = matterSummaries.map((matter) =>
    matterBillingGroup(matter, billingByMatterId.get(matter.id) ?? []),
  );
  return {
    account: sanitizedUser(user),
    access: {
      posture: grants.length > 0 ? "active" : "no_active_grants",
      activeGrantCount: grants.length,
      matterCount: matterIds.length,
      permissions: uniquePermissions(grants),
    },
    matters: matterSummaries.map((matter) =>
      sanitizedMatter(
        matter,
        grants.filter((grant) => grant.matterId === matter.id),
        actionsByMatterId.get(matter.id)?.length ?? 0,
      ),
    ),
    billing: billingWorkspace(matterBills),
    matterActions,
    actions,
  };
}

export function registerClientPortalWorkspaceRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/client-portal/workspace", async (request) => {
    if (request.auth.user.role !== "client_external") {
      throw new ApiHttpError(
        403,
        "CLIENT_PORTAL_ACCOUNT_REQUIRED",
        "Client portal account required",
      );
    }
    return buildWorkspace(repository, request.auth.user, new Date().toISOString());
  });
}
