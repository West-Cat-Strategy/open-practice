import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  CalendarGuestLinkRecord,
  CalendarMeetingSessionRecord,
  CalendarSchedulingRequestRecord,
} from "@open-practice/domain";
import { firms, users } from "./core.js";
import { contacts } from "./contacts.js";
import { emailOutbox, jobLifecycleRecords } from "./jobs-email.js";
import { matters } from "./matters.js";
import { tasks } from "./tasks.js";

export const calendarCredentials = pgTable(
  "calendar_credentials",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    username: text("username").notNull(),
    label: text("label").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    username: uniqueIndex("calendar_credentials_username_idx").on(table.username),
    userActive: index("calendar_credentials_user_active_idx").on(
      table.firmId,
      table.userId,
      table.revokedAt,
    ),
  }),
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    scope: text("scope").notNull().default("matter"),
    matterId: text("matter_id").references(() => matters.id),
    clientContactId: text("client_contact_id").references(() => contacts.id),
    uid: text("uid").notNull(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    description: text("description"),
    location: text("location"),
    status: text("status").notNull().default("confirmed"),
    sequence: integer("sequence").notNull().default(0),
    meetingLinkMode: text("meeting_link_mode").notNull().default("blank"),
    meetingLinkUrl: text("meeting_link_url"),
    meetingRoomId: text("meeting_room_id"),
    meetingProviderKey: text("meeting_provider_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    firmMatterUid: uniqueIndex("calendar_events_firm_matter_uid_idx")
      .on(table.firmId, table.matterId, table.uid)
      .where(sql`${table.deletedAt} is null and ${table.matterId} is not null`),
    firmScopeUid: uniqueIndex("calendar_events_firm_scope_uid_idx")
      .on(table.firmId, table.scope, table.uid)
      .where(
        sql`${table.deletedAt} is null and ${table.matterId} is null and ${table.clientContactId} is null`,
      ),
    firmClientUid: uniqueIndex("calendar_events_firm_client_uid_idx")
      .on(table.firmId, table.clientContactId, table.uid)
      .where(sql`${table.deletedAt} is null and ${table.clientContactId} is not null`),
    matterStart: index("calendar_events_matter_start_idx").on(
      table.firmId,
      table.matterId,
      table.startsAt,
    ),
    scopeStart: index("calendar_events_scope_start_idx").on(
      table.firmId,
      table.scope,
      table.startsAt,
    ),
    clientStart: index("calendar_events_client_start_idx").on(
      table.firmId,
      table.clientContactId,
      table.startsAt,
    ),
    scopeValue: check(
      "calendar_events_scope_value",
      sql`${table.scope} in ('matter', 'firm', 'client')`,
    ),
    scopeTarget: check(
      "calendar_events_scope_target",
      sql`(${table.scope} = 'matter' and ${table.matterId} is not null and ${table.clientContactId} is null) or (${table.scope} = 'firm' and ${table.matterId} is null and ${table.clientContactId} is null) or (${table.scope} = 'client' and ${table.matterId} is null and ${table.clientContactId} is not null)`,
    ),
    meetingLinkModeValue: check(
      "calendar_events_meeting_link_mode_value",
      sql`${table.meetingLinkMode} in ('blank', 'external_url', 'hosted_webrtc')`,
    ),
  }),
);

export const calendarEventAttendees = pgTable(
  "calendar_event_attendees",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    eventId: text("event_id")
      .notNull()
      .references(() => calendarEvents.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("required"),
    responseStatus: text("response_status").notNull().default("needs_action"),
    invitationStatus: text("invitation_status").notNull().default("not_sent"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    invitationEmailId: text("invitation_email_id").references(() => emailOutbox.id),
    invitationJobId: text("invitation_job_id").references(() => jobLifecycleRecords.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    firmEventEmail: uniqueIndex("calendar_event_attendees_firm_event_email_idx")
      .on(table.firmId, table.eventId, table.email)
      .where(sql`${table.deletedAt} is null`),
    eventActive: index("calendar_event_attendees_event_active_idx").on(
      table.firmId,
      table.matterId,
      table.eventId,
      table.deletedAt,
    ),
    roleValue: check(
      "calendar_event_attendees_role_value",
      sql`${table.role} in ('required', 'optional')`,
    ),
    responseStatusValue: check(
      "calendar_event_attendees_response_status_value",
      sql`${table.responseStatus} in ('needs_action', 'accepted', 'tentative', 'declined')`,
    ),
    invitationStatusValue: check(
      "calendar_event_attendees_invitation_status_value",
      sql`${table.invitationStatus} in ('not_sent', 'queued', 'skipped')`,
    ),
  }),
);

export const calendarEventReminders = pgTable(
  "calendar_event_reminders",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    scope: text("scope").notNull().default("matter"),
    matterId: text("matter_id").references(() => matters.id),
    clientContactId: text("client_contact_id").references(() => contacts.id),
    eventId: text("event_id")
      .notNull()
      .references(() => calendarEvents.id),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    channel: text("channel").notNull().default("dashboard"),
    status: text("status").notNull().default("pending"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    eventActive: index("calendar_event_reminders_event_active_idx").on(
      table.firmId,
      table.matterId,
      table.eventId,
      table.deletedAt,
    ),
    statusDue: index("calendar_event_reminders_status_due_idx").on(
      table.firmId,
      table.status,
      table.remindAt,
    ),
    scopeDue: index("calendar_event_reminders_scope_due_idx").on(
      table.firmId,
      table.scope,
      table.remindAt,
    ),
    clientDue: index("calendar_event_reminders_client_due_idx").on(
      table.firmId,
      table.clientContactId,
      table.remindAt,
    ),
    scopeValue: check(
      "calendar_event_reminders_scope_value",
      sql`${table.scope} in ('matter', 'firm', 'client')`,
    ),
    scopeTarget: check(
      "calendar_event_reminders_scope_target",
      sql`(${table.scope} = 'matter' and ${table.matterId} is not null and ${table.clientContactId} is null) or (${table.scope} = 'firm' and ${table.matterId} is null and ${table.clientContactId} is null) or (${table.scope} = 'client' and ${table.matterId} is null and ${table.clientContactId} is not null)`,
    ),
    channelValue: check(
      "calendar_event_reminders_channel_value",
      sql`${table.channel} in ('dashboard')`,
    ),
    statusValue: check(
      "calendar_event_reminders_status_value",
      sql`${table.status} in ('pending', 'acknowledged', 'dismissed', 'cancelled')`,
    ),
  }),
);

export const calendarSchedulingRequests = pgTable(
  "calendar_scheduling_requests",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("needs_review"),
    title: text("title").notNull(),
    taskId: text("task_id").references(() => tasks.id),
    calendarEventId: text("calendar_event_id").references(() => calendarEvents.id),
    calendarReminderId: text("calendar_reminder_id").references(() => calendarEventReminders.id),
    ownerUserId: text("owner_user_id").references(() => users.id),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    sourceLabel: text("source_label").notNull(),
    requestedDueAt: timestamp("requested_due_at", { withTimezone: true }),
    requestedStartsAt: timestamp("requested_starts_at", { withTimezone: true }),
    requestedEndsAt: timestamp("requested_ends_at", { withTimezone: true }),
    reminderPosture: text("reminder_posture").notNull().default("none"),
    privacy: text("privacy").notNull().default("staff_only"),
    timeCaptureCue: jsonb("time_capture_cue")
      .$type<CalendarSchedulingRequestRecord["timeCaptureCue"]>()
      .notNull()
      .default({ posture: "none", existingTimeEntryCount: 0, billable: false }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewAgingDecision:
      text("review_aging_decision").$type<CalendarSchedulingRequestRecord["reviewAgingDecision"]>(),
    reviewAgingDecidedAt: timestamp("review_aging_decided_at", { withTimezone: true }),
    reviewAgingDecidedByUserId: text("review_aging_decided_by_user_id").references(() => users.id),
    reviewAgingCueStatus:
      text("review_aging_cue_status").$type<
        CalendarSchedulingRequestRecord["reviewAgingCueStatus"]
      >(),
    reviewAgingAgeHours: integer("review_aging_age_hours"),
  },
  (table) => ({
    matterStatus: index("calendar_scheduling_requests_matter_status_idx").on(
      table.firmId,
      table.matterId,
      table.status,
    ),
    ownerStatus: index("calendar_scheduling_requests_owner_status_idx").on(
      table.firmId,
      table.ownerUserId,
      table.status,
    ),
    kindValue: check(
      "calendar_scheduling_requests_kind_value",
      sql`${table.kind} in ('deadline_review', 'event_scheduling', 'reminder_review')`,
    ),
    statusValue: check(
      "calendar_scheduling_requests_status_value",
      sql`${table.status} in ('needs_review', 'reviewed', 'scheduled', 'dismissed')`,
    ),
    reviewAgingDecisionValue: check(
      "calendar_scheduling_requests_review_aging_decision_value",
      sql`${table.reviewAgingDecision} is null or ${table.reviewAgingDecision} in ('acknowledged', 'follow_up_required', 'defer_review')`,
    ),
    reviewAgingCueStatusValue: check(
      "calendar_scheduling_requests_review_aging_cue_status_value",
      sql`${table.reviewAgingCueStatus} is null or ${table.reviewAgingCueStatus} in ('aging', 'stale')`,
    ),
    reviewAgingAgeNonnegative: check(
      "calendar_scheduling_requests_review_aging_age_nonnegative",
      sql`${table.reviewAgingAgeHours} is null or ${table.reviewAgingAgeHours} >= 0`,
    ),
    reviewAgingDecisionComplete: check(
      "calendar_scheduling_requests_review_aging_decision_complete",
      sql`(${table.reviewAgingDecision} is null and ${table.reviewAgingDecidedAt} is null and ${table.reviewAgingDecidedByUserId} is null and ${table.reviewAgingCueStatus} is null and ${table.reviewAgingAgeHours} is null) or (${table.reviewAgingDecision} is not null and ${table.reviewAgingDecidedAt} is not null and ${table.reviewAgingDecidedByUserId} is not null and ${table.reviewAgingCueStatus} is not null and ${table.reviewAgingAgeHours} is not null)`,
    ),
    sourceTypeValue: check(
      "calendar_scheduling_requests_source_type_value",
      sql`${table.sourceType} in ('task_deadline', 'calendar_event', 'calendar_reminder', 'manual')`,
    ),
    reminderPostureValue: check(
      "calendar_scheduling_requests_reminder_posture_value",
      sql`${table.reminderPosture} in ('none', 'dashboard_pending', 'delivery_opt_in_available')`,
    ),
    privacyValue: check(
      "calendar_scheduling_requests_privacy_value",
      sql`${table.privacy} in ('staff_only', 'matter_team')`,
    ),
    titlePresent: check(
      "calendar_scheduling_requests_title_present",
      sql`length(trim(${table.title})) > 0`,
    ),
    sourceLabelPresent: check(
      "calendar_scheduling_requests_source_label_present",
      sql`length(trim(${table.sourceLabel})) > 0`,
    ),
  }),
);

export const calendarMeetingSessions = pgTable(
  "calendar_meeting_sessions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    eventId: text("event_id")
      .notNull()
      .references(() => calendarEvents.id),
    status: text("status").notNull().default("lobby_closed"),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata")
      .$type<CalendarMeetingSessionRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    firmMatterEvent: index("calendar_meeting_sessions_firm_matter_event_idx").on(
      table.firmId,
      table.matterId,
      table.eventId,
      table.status,
    ),
    statusValue: check(
      "calendar_meeting_sessions_status_value",
      sql`${table.status} in ('lobby_closed', 'lobby_open', 'locked', 'ended')`,
    ),
  }),
);

export const calendarGuestLinks = pgTable(
  "calendar_guest_links",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    eventId: text("event_id")
      .notNull()
      .references(() => calendarEvents.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => calendarMeetingSessions.id),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("issued"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    admittedAt: timestamp("admitted_at", { withTimezone: true }),
    deniedAt: timestamp("denied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
    metadata: jsonb("metadata").$type<CalendarGuestLinkRecord["metadata"]>().notNull().default({}),
  },
  (table) => ({
    tokenHash: uniqueIndex("calendar_guest_links_token_hash_idx").on(table.tokenHash),
    sessionStatus: index("calendar_guest_links_session_status_idx").on(
      table.firmId,
      table.matterId,
      table.eventId,
      table.sessionId,
      table.status,
    ),
    expiry: index("calendar_guest_links_expiry_idx").on(table.firmId, table.expiresAt),
    statusValue: check(
      "calendar_guest_links_status_value",
      sql`${table.status} in ('issued', 'waiting', 'admitted', 'denied', 'revoked')`,
    ),
  }),
);
