import { describe, expect, it } from "vitest";
import {
  CalendarEventScopeConflictError,
  CalendarEventUidConflictError,
} from "../src/repository/contracts.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

describe("repository calendar and tasks", () => {
  it("lists matter-scoped calendar events with optional start filters", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.listCalendarEvents("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toMatchObject([
      { id: "calendar-event-001", matterId: "matter-001" },
      {
        id: "calendar-event-002",
        matterId: "matter-001",
        attendees: [{ id: "calendar-attendee-001", email: "ada.morgan@example.test" }],
      },
    ]);

    await expect(
      repository.listCalendarEvents("firm-west-legal", {
        matterId: "matter-001",
        startsAfter: "2026-05-06T00:00:00.000Z",
      }),
    ).resolves.toMatchObject([{ id: "calendar-event-002", matterId: "matter-001" }]);

    await expect(
      repository.listCalendarEvents("firm-west-legal", { matterId: "matter-002" }),
    ).resolves.toMatchObject([{ id: "calendar-event-003", matterId: "matter-002" }]);
  });

  it("lists and completes matter-scoped task deadlines in memory", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.listTaskDeadlines("firm-west-legal", { matterIds: ["matter-001"] }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "task-deadline-001",
        matterId: "matter-001",
      }),
      expect.objectContaining({
        id: "task-deadline-002",
        matterId: "matter-001",
      }),
    ]);

    const created = await repository.createTaskDeadline({
      id: "task-deadline-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      assignedToUserId: "user-licensee",
      title: "Synthetic task deadline",
      dueAt: "2026-05-03T17:00:00.000Z",
    });
    expect(created).toMatchObject({ id: "task-deadline-test" });

    await expect(
      repository.completeTaskDeadline({
        firmId: "firm-west-legal",
        taskId: "task-deadline-test",
        completedAt: "2026-05-02T17:30:00.000Z",
      }),
    ).resolves.toMatchObject({
      id: "task-deadline-test",
      completedAt: "2026-05-02T17:30:00.000Z",
    });
    await expect(
      repository.getTaskDeadline("firm-west-legal", "task-deadline-test"),
    ).resolves.toMatchObject({ completedAt: "2026-05-02T17:30:00.000Z" });
  });

  it("creates, updates, soft-deletes, and replaces calendar event attendees", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const attendee = await repository.upsertCalendarEventAttendee({
      id: "calendar-attendee-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      eventId: "calendar-event-001",
      name: "Synthetic Attendee",
      email: "synthetic.attendee@example.test",
      role: "required",
      responseStatus: "needs_action",
      invitationStatus: "not_sent",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
    });

    await expect(
      repository.listCalendarEventAttendees("firm-west-legal", "matter-001", "calendar-event-001"),
    ).resolves.toMatchObject([{ id: attendee.id, invitationStatus: "not_sent" }]);

    await expect(
      repository.upsertCalendarEventAttendee({
        ...attendee,
        responseStatus: "accepted",
        invitationStatus: "queued",
        invitationEmailId: "email-test",
        invitationJobId: "job-test",
        invitedAt: "2026-04-25T12:05:00.000Z",
        updatedAt: "2026-04-25T12:05:00.000Z",
      }),
    ).resolves.toMatchObject({
      responseStatus: "accepted",
      invitationStatus: "queued",
      invitationEmailId: "email-test",
    });

    await expect(
      repository.deleteCalendarEventAttendee({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: "calendar-event-001",
        attendeeId: attendee.id,
        deletedAt: "2026-04-25T12:10:00.000Z",
        updatedByUserId: "user-licensee",
      }),
    ).resolves.toMatchObject({ deletedAt: "2026-04-25T12:10:00.000Z" });

    await expect(
      repository.replaceCalendarEventAttendees({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: "calendar-event-001",
        replacedAt: "2026-04-25T12:15:00.000Z",
        updatedByUserId: "user-licensee",
        attendees: [
          {
            ...attendee,
            id: "calendar-attendee-replaced",
            email: "replacement@example.test",
            invitationStatus: "not_sent",
            invitationEmailId: undefined,
            invitationJobId: undefined,
            invitedAt: undefined,
            deletedAt: undefined,
            createdAt: "2026-04-25T12:15:00.000Z",
            updatedAt: "2026-04-25T12:15:00.000Z",
          },
        ],
      }),
    ).resolves.toMatchObject([{ id: "calendar-attendee-replaced" }]);

    await expect(
      repository.listCalendarEventAttendees("firm-west-legal", "matter-002", "calendar-event-001"),
    ).resolves.toEqual([]);
  });

  it("creates, updates, and soft-deletes matter-scoped calendar events", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const event = await repository.upsertCalendarEvent({
      id: "calendar-event-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      uid: "calendar-event-test@example.test",
      title: "Synthetic CalDAV event",
      startsAt: "2026-05-12T16:00:00.000Z",
      endsAt: "2026-05-12T17:00:00.000Z",
      description: "Created by repository test.",
      location: "Office",
      status: "confirmed",
      sequence: 0,
      meetingLinkMode: "external_url",
      meetingLinkUrl: "https://meet.example.test/external-room",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
    });

    await expect(
      repository.getCalendarEvent("firm-west-legal", "matter-001", event.id),
    ).resolves.toMatchObject({
      uid: "calendar-event-test@example.test",
      sequence: 0,
      meetingLinkMode: "external_url",
      meetingLinkUrl: "https://meet.example.test/external-room",
    });
    await expect(
      repository.getCalendarEventByUid("firm-west-legal", "matter-001", event.uid),
    ).resolves.toMatchObject({ id: event.id });

    await repository.upsertCalendarEvent({
      ...event,
      title: "Updated synthetic CalDAV event",
      sequence: 1,
      meetingLinkMode: "hosted_webrtc",
      meetingLinkUrl: "https://meet.example.test/rooms/calendar-room-test",
      meetingRoomId: "calendar-room-test",
      meetingProviderKey: "open-practice-webrtc",
      updatedAt: "2026-04-25T12:10:00.000Z",
    });
    await expect(
      repository.getCalendarEvent("firm-west-legal", "matter-001", event.id),
    ).resolves.toMatchObject({
      title: "Updated synthetic CalDAV event",
      sequence: 1,
      meetingLinkMode: "hosted_webrtc",
      meetingRoomId: "calendar-room-test",
      meetingProviderKey: "open-practice-webrtc",
    });

    await expect(
      repository.deleteCalendarEvent({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: event.id,
        deletedAt: "2026-04-25T12:15:00.000Z",
        updatedByUserId: "user-licensee",
      }),
    ).resolves.toMatchObject({ deletedAt: "2026-04-25T12:15:00.000Z", sequence: 2 });
    await expect(
      repository.listCalendarEvents("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ id: event.id })]));

    await expect(
      repository.upsertCalendarEvent({
        ...event,
        id: "calendar-event-test-recreated",
        sequence: 0,
        createdAt: "2026-04-25T12:20:00.000Z",
        updatedAt: "2026-04-25T12:20:00.000Z",
      }),
    ).resolves.toMatchObject({
      id: "calendar-event-test-recreated",
      uid: "calendar-event-test@example.test",
    });
  });

  it("creates, updates, and soft-deletes manual calendar reminders", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const reminder = await repository.upsertCalendarEventReminder({
      id: "calendar-reminder-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      eventId: "calendar-event-001",
      remindAt: "2026-05-05T15:30:00.000Z",
      channel: "dashboard",
      status: "pending",
      note: "Synthetic note for repository proof.",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
    });

    await expect(
      repository.listCalendarEventReminders("firm-west-legal", "matter-001", "calendar-event-001"),
    ).resolves.toMatchObject([{ id: reminder.id, status: "pending", channel: "dashboard" }]);
    await expect(
      repository.getCalendarEvent("firm-west-legal", "matter-001", "calendar-event-001"),
    ).resolves.toMatchObject({
      reminders: [{ id: reminder.id, remindAt: "2026-05-05T15:30:00.000Z" }],
    });

    await expect(
      repository.upsertCalendarEventReminder({
        ...reminder,
        status: "acknowledged",
        updatedAt: "2026-04-25T12:10:00.000Z",
      }),
    ).resolves.toMatchObject({ status: "acknowledged" });

    await expect(
      repository.deleteCalendarEventReminder({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: "calendar-event-001",
        reminderId: reminder.id,
        deletedAt: "2026-04-25T12:15:00.000Z",
        updatedByUserId: "user-licensee",
      }),
    ).resolves.toMatchObject({ deletedAt: "2026-04-25T12:15:00.000Z" });
    await expect(
      repository.listCalendarEventReminders("firm-west-legal", "matter-001", "calendar-event-001"),
    ).resolves.toEqual([]);
  });

  it("rejects calendar event writes that would cross firm or matter scope", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.upsertCalendarEvent({
        id: "calendar-event-001",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        uid: "cross-scope@example.test",
        title: "Cross-scope attempt",
        startsAt: "2026-05-12T16:00:00.000Z",
        endsAt: "2026-05-12T17:00:00.000Z",
        status: "confirmed",
        sequence: 0,
        createdAt: now,
        updatedAt: now,
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      }),
    ).rejects.toBeInstanceOf(CalendarEventScopeConflictError);

    await expect(
      repository.getCalendarEvent("firm-west-legal", "matter-001", "calendar-event-001"),
    ).resolves.toMatchObject({
      matterId: "matter-001",
      title: "Residential tenancy filing deadline",
    });
  });

  it("enforces active-only calendar UID uniqueness per matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.upsertCalendarEvent({
        id: "calendar-event-uid-conflict",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        uid: "calendar-event-001@open-practice.local",
        title: "Duplicate UID attempt",
        startsAt: "2026-05-12T16:00:00.000Z",
        endsAt: "2026-05-12T17:00:00.000Z",
        status: "confirmed",
        sequence: 0,
        createdAt: now,
        updatedAt: now,
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      }),
    ).rejects.toBeInstanceOf(CalendarEventUidConflictError);
  });

  it("stores and revokes calendar app-password credentials", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await expect(
      repository.createCalendarCredential({
        id: "calendar-credential-test",
        firmId: "firm-west-legal",
        userId: "user-licensee",
        username: "firm-west-legal.user-licensee.calendar-credential-test",
        label: "Mina iPhone",
        passwordHash: "pbkdf2:sha256:1:salt:hash",
        createdAt: now,
        createdByUserId: "user-licensee",
      }),
    ).resolves.toMatchObject({ label: "Mina iPhone" });

    await expect(
      repository.getCalendarCredentialByUsername(
        "firm-west-legal.user-licensee.calendar-credential-test",
      ),
    ).resolves.toMatchObject({ id: "calendar-credential-test" });

    await repository.touchCalendarCredential(
      "calendar-credential-test",
      "2026-04-25T12:20:00.000Z",
    );
    await expect(
      repository.listCalendarCredentials("firm-west-legal", "user-licensee"),
    ).resolves.toMatchObject([{ lastUsedAt: "2026-04-25T12:20:00.000Z" }]);

    await expect(
      repository.revokeCalendarCredential({
        firmId: "firm-west-legal",
        userId: "user-licensee",
        credentialId: "calendar-credential-test",
        revokedAt: "2026-04-25T12:30:00.000Z",
      }),
    ).resolves.toMatchObject({ revokedAt: "2026-04-25T12:30:00.000Z" });
    await expect(
      repository.getCalendarCredentialByUsername(
        "firm-west-legal.user-licensee.calendar-credential-test",
      ),
    ).resolves.toBeUndefined();
  });
});
