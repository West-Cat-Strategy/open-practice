import { describe, expect, it } from "vitest";
import type {
  CalendarSchedulingRequestRecord,
  MatterParty,
  TaskChecklistItemRecord,
  TaskCommentRecord,
  TaskDeadlineRecord,
  TaskDependencyRecord,
  TaskTemplateItemRecord,
  TaskTemplateRecord,
} from "./models.js";
import type { AppointmentBookingRequestRecord } from "./appointment-booking.js";
import {
  buildCalendarAgingFollowUpTaskDraft,
  buildLegalClinicCadenceFollowUpTaskDraft,
  buildContactTimelineTaskCues,
  buildTaskStructuredDetail,
  buildTaskDeadlineWorkbench,
  classifyTaskDeadline,
} from "./tasks.js";
import { buildLegalClinicCadenceSignals } from "./legal-clinics.js";
import { sampleLegalClinicMatterProfiles, sampleLegalClinicPrograms } from "./sample-data.js";

const now = new Date("2026-05-02T16:00:00.000Z");

function task(
  input: Partial<TaskDeadlineRecord> & Pick<TaskDeadlineRecord, "id">,
): TaskDeadlineRecord {
  return {
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: input.id,
    status: input.completedAt ? "completed" : "open",
    priority: "medium",
    createdAt: "2026-04-30T12:00:00.000Z",
    updatedAt: input.completedAt ?? "2026-04-30T12:00:00.000Z",
    version: input.completedAt ? 2 : 1,
    ...input,
  };
}

function calendarSchedulingRequest(
  input: Partial<CalendarSchedulingRequestRecord> & Pick<CalendarSchedulingRequestRecord, "id">,
): CalendarSchedulingRequestRecord {
  const { id, ...overrides } = input;
  return {
    id,
    firmId: "firm-west-legal",
    matterId: "matter-001",
    kind: "event_scheduling",
    status: "needs_review",
    title: "Private scheduling title",
    sourceType: "manual",
    sourceLabel: "Private scheduling source label",
    requestedStartsAt: "2026-06-04T17:00:00.000Z",
    requestedEndsAt: "2026-06-04T17:30:00.000Z",
    reminderPosture: "none",
    privacy: "staff_only",
    timeCaptureCue: {
      posture: "none",
      existingTimeEntryCount: 0,
      billable: false,
    },
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
    createdByUserId: "user-licensee",
    updatedByUserId: "user-licensee",
    reviewAgingDecision: "follow_up_required",
    reviewAgingDecidedAt: "2026-06-04T15:00:00.000Z",
    reviewAgingDecidedByUserId: "user-licensee",
    reviewAgingCueStatus: "stale",
    reviewAgingAgeHours: 72,
    ...overrides,
  };
}

function appointmentBookingRequest(
  input: Partial<AppointmentBookingRequestRecord> & Pick<AppointmentBookingRequestRecord, "id">,
): AppointmentBookingRequestRecord {
  const { id, ...overrides } = input;
  return {
    id,
    firmId: "firm-west-legal",
    profileId: "booking-profile-001",
    source: "website",
    status: "tentative_hold",
    calendarEventId: `calendar-event-${id}`,
    matterId: "matter-001",
    requesterName: "Private synthetic requester",
    requesterEmail: "requester@example.test",
    requestedStartsAt: "2026-06-04T18:00:00.000Z",
    requestedEndsAt: "2026-06-04T18:30:00.000Z",
    submittedAt: "2026-06-01T12:00:00.000Z",
    reviewAgingDecision: "follow_up_required",
    reviewAgingDecidedAt: "2026-06-04T16:00:00.000Z",
    reviewAgingDecidedByUserId: "user-licensee",
    reviewAgingCueStatus: "stale",
    reviewAgingAgeHours: 72,
    metadata: { syntheticNote: "Private synthetic booking metadata" },
    ...overrides,
  };
}

describe("calendar aging follow-up task drafts", () => {
  it("selects the latest eligible source and keeps the task draft redacted", () => {
    const draft = buildCalendarAgingFollowUpTaskDraft({
      matterId: "matter-001",
      appointmentBookingRequests: [
        appointmentBookingRequest({
          id: "booking-request-matterless",
          matterId: undefined,
          reviewAgingDecidedAt: "2026-06-04T17:00:00.000Z",
        }),
        appointmentBookingRequest({
          id: "booking-request-latest",
          requesterName: "Private latest requester",
          reviewAgingDecidedAt: "2026-06-04T16:00:00.000Z",
        }),
      ],
      calendarSchedulingRequests: [
        calendarSchedulingRequest({
          id: "calendar-scheduling-request-older",
          title: "Private older scheduling title",
          sourceLabel: "Private older source label",
          reviewAgingDecidedAt: "2026-06-04T15:00:00.000Z",
        }),
      ],
      existingTasks: [],
    });

    expect(draft).toMatchObject({
      title: "Review calendar aging follow-up",
      priority: "high",
      sourceType: "calendar_scheduling",
      sourceId: "booking-request-latest",
      source: {
        kind: "appointment_booking_request",
        id: "booking-request-latest",
        matterId: "matter-001",
        decidedAt: "2026-06-04T16:00:00.000Z",
        decidedByUserId: "user-licensee",
        cueStatus: "stale",
        ageHours: 72,
      },
      auditMetadata: {
        calendarAgingSourceKind: "appointment_booking_request",
        calendarAgingSourceId: "booking-request-latest",
        reviewAgingDecision: "follow_up_required",
        automaticFinalConfirmation: false,
        autoExpires: false,
        providerSync: false,
        reminderQueued: false,
        publicRoomCreated: false,
        nativeMediaCreated: false,
        chatCreated: false,
        recordingCreated: false,
        matterCreated: false,
      },
    });
    expect(draft?.description).toContain("Review the calendar aging source record in Calendar");
    expect(draft?.description).toContain("do not add client names");
    const serialized = JSON.stringify(draft);
    expect(serialized).not.toContain("Private latest requester");
    expect(serialized).not.toContain("requester@example.test");
    expect(serialized).not.toContain("Private older scheduling title");
    expect(serialized).not.toContain("Private older source label");
    expect(serialized).not.toContain("2026-06-04T18:00:00.000Z");
    expect(serialized).not.toContain("Private synthetic booking metadata");
  });

  it("excludes duplicate task sources, non-follow-up decisions, closed sources, and other matters", () => {
    const draft = buildCalendarAgingFollowUpTaskDraft({
      matterId: "matter-001",
      appointmentBookingRequests: [
        appointmentBookingRequest({
          id: "booking-request-duplicate",
          reviewAgingDecidedAt: "2026-06-04T18:00:00.000Z",
        }),
        appointmentBookingRequest({
          id: "booking-request-dismissed",
          status: "dismissed",
          reviewAgingDecidedAt: "2026-06-04T17:00:00.000Z",
        }),
      ],
      calendarSchedulingRequests: [
        calendarSchedulingRequest({
          id: "calendar-scheduling-request-deferred",
          reviewAgingDecision: "defer_review",
          reviewAgingDecidedAt: "2026-06-04T16:30:00.000Z",
        }),
        calendarSchedulingRequest({
          id: "calendar-scheduling-request-reviewed",
          status: "reviewed",
          reviewAgingDecidedAt: "2026-06-04T16:15:00.000Z",
        }),
        calendarSchedulingRequest({
          id: "calendar-scheduling-request-other-matter",
          matterId: "matter-002",
          reviewAgingDecidedAt: "2026-06-04T16:10:00.000Z",
        }),
        calendarSchedulingRequest({
          id: "calendar-scheduling-request-eligible",
          reviewAgingDecidedAt: "2026-06-04T16:00:00.000Z",
        }),
      ],
      existingTasks: [
        task({
          id: "task-existing",
          sourceType: "calendar_scheduling",
          sourceId: "booking-request-duplicate",
        }),
      ],
    });

    expect(draft?.source).toMatchObject({
      kind: "calendar_scheduling_request",
      id: "calendar-scheduling-request-eligible",
      matterId: "matter-001",
    });
  });

  it("returns no draft when aging metadata is incomplete", () => {
    expect(
      buildCalendarAgingFollowUpTaskDraft({
        matterId: "matter-001",
        appointmentBookingRequests: [
          appointmentBookingRequest({
            id: "booking-request-missing-decider",
            reviewAgingDecidedByUserId: undefined,
          }),
        ],
        calendarSchedulingRequests: [
          calendarSchedulingRequest({
            id: "calendar-scheduling-request-missing-age",
            reviewAgingAgeHours: undefined,
          }),
        ],
        existingTasks: [],
      }),
    ).toBeUndefined();
  });
});

describe("legal clinic cadence follow-up task drafts", () => {
  it("selects the most urgent eligible cadence signal and keeps fixed redacted task copy", () => {
    const cadenceSignals = buildLegalClinicCadenceSignals({
      programs: sampleLegalClinicPrograms,
      profiles: [
        {
          ...sampleLegalClinicMatterProfiles[0]!,
          id: "legal-clinic-profile-later",
          eligibilityStatus: "likely_eligible",
          referralStatus: "not_referred",
          nextReviewDate: "2026-05-08T17:00:00.000Z",
          notes: "Private later clinic note",
          referralSource: "Private later referral source",
          metadata: { privateClinicMetadata: "Private later metadata" },
        },
        {
          ...sampleLegalClinicMatterProfiles[0]!,
          id: "legal-clinic-profile-urgent",
          eligibilityStatus: "likely_eligible",
          referralStatus: "not_referred",
          nextReviewDate: "2026-05-01T17:00:00.000Z",
          notes: "Private urgent clinic note",
          referralSource: "Private urgent referral source",
          metadata: { privateClinicMetadata: "Private urgent metadata" },
        },
      ],
      now: now.toISOString(),
    });

    const draft = buildLegalClinicCadenceFollowUpTaskDraft({
      matterId: "matter-001",
      legalClinicCadenceSignals: cadenceSignals,
      existingTasks: [],
    });

    expect(draft).toMatchObject({
      title: "Review legal clinic cadence",
      priority: "high",
      dueAt: "2026-05-01T17:00:00.000Z",
      sourceType: "operational_view",
      sourceId: "legal_clinic_cadence:legal-clinic-profile-urgent:next_review_due",
      source: {
        profileId: "legal-clinic-profile-urgent",
        matterId: "matter-001",
        programId: "clinic-program-tenancy-stability",
        signal: "next_review_due",
      },
      auditMetadata: {
        legalClinicCadenceSignal: "next_review_due",
        legalClinicProfileId: "legal-clinic-profile-urgent",
        legalClinicProgramId: "clinic-program-tenancy-stability",
        legalClinicCadenceSourceId:
          "legal_clinic_cadence:legal-clinic-profile-urgent:next_review_due",
        legalClinicCadenceDueAt: "2026-05-01T17:00:00.000Z",
        explicitStaffCommand: true,
        automaticTaskCreation: false,
        providerSync: false,
        clientVisibleWorkflow: false,
        cadenceMutated: false,
      },
    });
    expect(draft?.description).toContain("Review the legal clinic cadence signal");
    expect(draft?.description).toContain("do not add client names");
    const serialized = JSON.stringify(draft);
    expect(serialized).not.toContain("Private urgent clinic note");
    expect(serialized).not.toContain("Private urgent referral source");
    expect(serialized).not.toContain("Private urgent metadata");
    expect(serialized).not.toContain("Synthetic screening");
  });

  it("excludes duplicate task sources, closed clinic posture signals, and other matters", () => {
    const cadenceSignals = buildLegalClinicCadenceSignals({
      programs: sampleLegalClinicPrograms,
      profiles: [
        {
          ...sampleLegalClinicMatterProfiles[0]!,
          id: "legal-clinic-profile-duplicate",
          eligibilityStatus: "likely_eligible",
          referralStatus: "not_referred",
          nextReviewDate: "2026-05-01T17:00:00.000Z",
        },
        {
          ...sampleLegalClinicMatterProfiles[0]!,
          id: "legal-clinic-profile-closed",
          eligibilityStatus: "ineligible",
          referralStatus: "not_referred",
          nextReviewDate: "2026-04-01T17:00:00.000Z",
        },
        {
          ...sampleLegalClinicMatterProfiles[1]!,
          id: "legal-clinic-profile-other-matter",
          matterId: "matter-002",
          eligibilityStatus: "needs_review",
          nextReviewDate: "2026-04-01T17:00:00.000Z",
        },
      ],
      now: now.toISOString(),
    });

    expect(
      buildLegalClinicCadenceFollowUpTaskDraft({
        matterId: "matter-001",
        legalClinicCadenceSignals: cadenceSignals,
        existingTasks: [
          task({
            id: "task-existing-legal-clinic-cadence",
            status: "archived",
            sourceType: "operational_view",
            sourceId: "legal_clinic_cadence:legal-clinic-profile-duplicate:next_review_due",
          }),
        ],
      }),
    ).toBeUndefined();
  });
});

describe("task deadline workbench", () => {
  it("classifies open deadlines into overdue, today, upcoming, unscheduled, and completed buckets", () => {
    expect(
      classifyTaskDeadline(task({ id: "overdue", dueAt: "2026-05-01T23:59:00.000Z" }), now),
    ).toBe("overdue");
    expect(
      classifyTaskDeadline(task({ id: "today", dueAt: "2026-05-02T23:59:00.000Z" }), now),
    ).toBe("today");
    expect(
      classifyTaskDeadline(task({ id: "upcoming", dueAt: "2026-05-03T00:00:00.000Z" }), now),
    ).toBe("upcoming");
    expect(classifyTaskDeadline(task({ id: "unscheduled" }), now)).toBe("unscheduled");
    expect(
      classifyTaskDeadline(
        task({
          id: "completed",
          dueAt: "2026-05-01T23:59:00.000Z",
          completedAt: "2026-05-02T15:00:00.000Z",
        }),
        now,
      ),
    ).toBe("completed");
  });

  it("builds my, team, matter, and client-contact counters without counting adverse parties", () => {
    const tasks = [
      task({
        id: "task-overdue-mine",
        assignedToUserId: "user-licensee",
        dueAt: "2026-05-01T19:00:00.000Z",
      }),
      task({
        id: "task-today-team",
        assignedToUserId: "user-staff",
        dueAt: "2026-05-02T21:00:00.000Z",
      }),
      task({
        id: "task-upcoming-other-matter",
        matterId: "matter-002",
        assignedToUserId: "user-admin",
        dueAt: "2026-05-05T17:00:00.000Z",
      }),
      task({
        id: "task-complete",
        assignedToUserId: "user-licensee",
        dueAt: "2026-05-01T19:00:00.000Z",
        completedAt: "2026-05-02T14:00:00.000Z",
      }),
    ];
    const matterParties: MatterParty[] = [
      {
        id: "party-client",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        contactId: "contact-client",
        role: "client",
        adverse: false,
        confidential: true,
      },
      {
        id: "party-adverse",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        contactId: "contact-adverse",
        role: "opposing_party",
        adverse: true,
        confidential: false,
      },
      {
        id: "party-notary",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        contactId: "contact-notary",
        role: "notary_client",
        adverse: false,
        confidential: true,
      },
    ];

    const workbench = buildTaskDeadlineWorkbench({
      tasks,
      matterParties,
      userId: "user-licensee",
      now,
    });

    expect(workbench.counters.my).toEqual({ overdue: 1, today: 0, upcoming: 0 });
    expect(workbench.counters.team).toEqual({ overdue: 1, today: 1, upcoming: 1 });
    expect(workbench.counters.matterQueues).toEqual([
      expect.objectContaining({
        matterId: "matter-001",
        overdue: 1,
        today: 1,
        open: 2,
        completed: 1,
      }),
      expect.objectContaining({ matterId: "matter-002", upcoming: 1, open: 1, completed: 0 }),
    ]);
    expect(workbench.counters.contactQueues).toEqual([
      expect.objectContaining({
        contactId: "contact-client",
        overdue: 1,
        today: 1,
        open: 2,
        completed: 1,
      }),
      expect.objectContaining({ contactId: "contact-notary", upcoming: 1, open: 1, completed: 0 }),
    ]);
    expect(workbench.counters.contactQueues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ contactId: "contact-adverse" })]),
    );
    expect(workbench.focusQueues).toEqual({
      myOverdueTaskIds: ["task-overdue-mine"],
      teamTodayTaskIds: ["task-today-team"],
      upcomingTaskIds: ["task-upcoming-other-matter"],
      unassignedTaskIds: [],
    });
  });

  it("builds review-list items with derived priority, assignment, privacy, and scheduling context", () => {
    const tasks = [
      task({
        id: "task-overdue-mine",
        assignedToUserId: "user-licensee",
        title: "Review tenant evidence package",
        dueAt: "2026-05-01T19:00:00.000Z",
      }),
      task({
        id: "task-today-unassigned",
        title: "Confirm filing checklist",
        dueAt: "2026-05-02T21:00:00.000Z",
      }),
      task({
        id: "task-upcoming-team",
        matterId: "matter-002",
        assignedToUserId: "user-staff",
        title: "Prepare corporate records request",
        dueAt: "2026-05-05T17:00:00.000Z",
      }),
    ];
    const schedulingRequests: CalendarSchedulingRequestRecord[] = [
      {
        id: "calendar-scheduling-request-review",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        kind: "deadline_review",
        status: "needs_review",
        title: "Review filing deadline posture",
        taskId: "task-overdue-mine",
        ownerUserId: "user-licensee",
        sourceType: "task_deadline",
        sourceId: "task-overdue-mine",
        sourceLabel: "Review tenant evidence package",
        requestedDueAt: "2026-05-01T19:00:00.000Z",
        reminderPosture: "dashboard_pending",
        privacy: "staff_only",
        timeCaptureCue: {
          posture: "draft_available",
          suggestedMinutes: 30,
          existingTimeEntryCount: 1,
          billable: true,
        },
        createdAt: "2026-04-30T12:00:00.000Z",
        updatedAt: "2026-04-30T12:00:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      },
      {
        id: "calendar-scheduling-request-reviewed",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        kind: "event_scheduling",
        status: "reviewed",
        title: "Reviewed filing checklist time",
        taskId: "task-today-unassigned",
        ownerUserId: "user-staff",
        sourceType: "task_deadline",
        sourceId: "task-today-unassigned",
        sourceLabel: "Confirm filing checklist",
        requestedDueAt: "2026-05-02T21:00:00.000Z",
        reminderPosture: "none",
        privacy: "matter_team",
        timeCaptureCue: {
          posture: "none",
          existingTimeEntryCount: 0,
          billable: false,
        },
        createdAt: "2026-04-30T12:05:00.000Z",
        updatedAt: "2026-04-30T12:05:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
        reviewedAt: "2026-04-30T13:00:00.000Z",
        reviewedByUserId: "user-staff",
      },
      {
        id: "calendar-scheduling-request-cross-matter",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        kind: "deadline_review",
        status: "needs_review",
        title: "Cross matter request must not attach",
        taskId: "task-overdue-mine",
        sourceType: "task_deadline",
        sourceId: "task-overdue-mine",
        sourceLabel: "Cross matter private source",
        requestedDueAt: "2026-05-01T19:00:00.000Z",
        reminderPosture: "dashboard_pending",
        privacy: "staff_only",
        timeCaptureCue: {
          posture: "draft_available",
          existingTimeEntryCount: 2,
          billable: true,
        },
        createdAt: "2026-04-30T12:10:00.000Z",
        updatedAt: "2026-04-30T12:10:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      },
    ];

    const workbench = buildTaskDeadlineWorkbench({
      tasks,
      matterParties: [],
      matters: [
        { id: "matter-001", number: "2026-0001", title: "Residential tenancy review" },
        { id: "matter-002", number: "2026-0002", title: "Corporate records request" },
      ],
      schedulingRequests,
      userId: "user-licensee",
      now,
    });

    expect(workbench.taskReview.summary).toMatchObject({
      total: 3,
      open: 3,
      highPriority: 1,
      mediumPriority: 1,
      lowPriority: 1,
      overdue: 1,
      dueToday: 1,
      unassigned: 1,
      myOpen: 1,
      schedulingReviewCount: 1,
    });
    expect(workbench.taskReview.items[0]).toMatchObject({
      id: "task-overdue-mine",
      matterNumber: "2026-0001",
      matterTitle: "Residential tenancy review",
      priority: "high",
      tone: "risk",
      assignment: {
        status: "assigned",
        userId: "user-licensee",
        scope: "current_user",
        label: "My task",
      },
      privacy: {
        matterScoped: true,
        clientVisible: false,
        visibility: "staff_only",
      },
      scheduling: {
        requestCount: 1,
        needsReviewCount: 1,
        reviewedCount: 0,
        nextReviewAt: "2026-05-01T19:00:00.000Z",
        sourceTypes: ["task_deadline"],
        reminderPostures: ["dashboard_pending"],
        timeCapturePostures: ["draft_available"],
      },
      reviewBoundary: {
        courtRuleAutomation: false,
        providerSync: false,
        automaticDeadlineMutation: false,
        automaticReminderChanges: false,
        queueDelivery: false,
        automaticTimeEntryCreation: false,
      },
    });
    expect(workbench.taskReview.items[1]).toMatchObject({
      id: "task-today-unassigned",
      priority: "medium",
      assignment: {
        status: "unassigned",
        scope: "unassigned",
        label: "Unassigned",
      },
      scheduling: {
        requestCount: 1,
        needsReviewCount: 0,
        reviewedCount: 1,
      },
    });
    expect(JSON.stringify(workbench.taskReview)).not.toContain("Cross matter private source");
  });

  it("surfaces review-first suggested follow-ups without auto-created task mutations", () => {
    const workbench = buildTaskDeadlineWorkbench({
      tasks: [],
      matterParties: [],
      matters: [{ id: "matter-001", number: "2026-0001", title: "Residential tenancy review" }],
      schedulingRequests: [
        {
          id: "calendar-scheduling-request-follow-up",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          kind: "event_scheduling",
          status: "needs_review",
          title: "Schedule synthetic inspection call",
          sourceType: "calendar_event",
          sourceId: "calendar-event-follow-up",
          sourceLabel: "Inspection scheduling request",
          requestedDueAt: "2026-05-03T17:00:00.000Z",
          reminderPosture: "dashboard_pending",
          privacy: "staff_only",
          timeCaptureCue: {
            posture: "none",
            existingTimeEntryCount: 0,
            billable: false,
          },
          createdAt: "2026-05-02T12:00:00.000Z",
          updatedAt: "2026-05-02T12:00:00.000Z",
          createdByUserId: "user-licensee",
          updatedByUserId: "user-licensee",
        },
      ],
      userId: "user-licensee",
      now,
    });

    expect(workbench.tasks).toEqual([]);
    expect(workbench.suggestedFollowUps).toEqual([
      expect.objectContaining({
        id: "calendar-scheduling:calendar-scheduling-request-follow-up",
        matterId: "matter-001",
        title: "Schedule synthetic inspection call",
        reason: "2026-0001 scheduling cue is waiting for staff task review.",
        priority: "high",
        dueAt: "2026-05-03T17:00:00.000Z",
        source: {
          type: "calendar_scheduling",
          id: "calendar-scheduling-request-follow-up",
          label: "Inspection scheduling request",
        },
        reviewBoundary: {
          automaticTaskCreation: false,
          automaticDeadlineMutation: false,
          automaticReminderChanges: false,
          queueDelivery: false,
        },
      }),
    ]);
  });

  it("surfaces legal-clinic cadence follow-ups as operational-view task sources", () => {
    const cadenceSignals = buildLegalClinicCadenceSignals({
      programs: sampleLegalClinicPrograms,
      profiles: [
        {
          ...sampleLegalClinicMatterProfiles[0]!,
          id: "legal-clinic-profile-cadence",
          eligibilityStatus: "needs_review",
          referralStatus: "referral_needed",
          referralDate: "2026-04-20T12:00:00.000Z",
          nextReviewDate: "2026-05-01T17:00:00.000Z",
          notes: "raw-client-private",
        },
      ],
      now: now.toISOString(),
    });
    const existing = task({
      id: "task-existing-legal-clinic-cadence",
      sourceType: "operational_view",
      sourceId: "legal_clinic_cadence:legal-clinic-profile-cadence:next_review_due",
    });

    const workbench = buildTaskDeadlineWorkbench({
      tasks: [existing],
      matterParties: [],
      matters: [{ id: "matter-001", number: "2026-0001", title: "Residential tenancy review" }],
      legalClinicCadenceSignals: cadenceSignals,
      userId: "user-licensee",
      now,
    });

    expect(workbench.suggestedFollowUps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "legal-clinic-cadence:legal-clinic-profile-cadence:eligibility_review",
          matterId: "matter-001",
          title: "Review legal clinic eligibility",
          priority: "high",
          dueAt: "2026-05-01T17:00:00.000Z",
          source: {
            type: "operational_view",
            id: "legal_clinic_cadence:legal-clinic-profile-cadence:eligibility_review",
            label: "Legal clinic cadence",
          },
        }),
        expect.objectContaining({
          id: "legal-clinic-cadence:legal-clinic-profile-cadence:referral_follow_up",
          source: {
            type: "operational_view",
            id: "legal_clinic_cadence:legal-clinic-profile-cadence:referral_follow_up",
            label: "Legal clinic cadence",
          },
        }),
      ]),
    );
    expect(workbench.suggestedFollowUps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: {
            type: "operational_view",
            id: "legal_clinic_cadence:legal-clinic-profile-cadence:next_review_due",
            label: "Legal clinic cadence",
          },
        }),
      ]),
    );
    expect(JSON.stringify(workbench.suggestedFollowUps)).not.toContain("raw-client-private");
  });

  it("builds redacted contact timeline task cues without private task or scheduling content", () => {
    const entries = buildContactTimelineTaskCues({
      contactId: "contact-client",
      firmId: "firm-west-legal",
      userId: "user-licensee",
      visibleMatterIds: ["matter-001"],
      now,
      tasks: [
        task({
          id: "task-visible-open",
          title: "Private task title must stay out",
          description: "Private task description must stay out",
          assignedToUserId: "user-licensee",
          dueAt: "2026-05-01T19:00:00.000Z",
        }),
        task({
          id: "task-hidden-matter",
          matterId: "matter-002",
          title: "Hidden matter task must stay out",
          dueAt: "2026-05-01T20:00:00.000Z",
        }),
        task({
          id: "task-completed",
          title: "Completed task must stay out",
          dueAt: "2026-05-01T21:00:00.000Z",
          completedAt: "2026-05-02T15:00:00.000Z",
        }),
      ],
      schedulingRequests: [
        {
          id: "calendar-scheduling-request-follow-up",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          kind: "event_scheduling",
          status: "needs_review",
          title: "Private scheduling title must stay out",
          sourceType: "calendar_event",
          sourceId: "calendar-event-private",
          sourceLabel: "Private source label must stay out",
          requestedDueAt: "2026-05-03T17:00:00.000Z",
          reminderPosture: "dashboard_pending",
          privacy: "staff_only",
          timeCaptureCue: {
            posture: "none",
            existingTimeEntryCount: 0,
            billable: false,
          },
          createdAt: "2026-05-02T12:00:00.000Z",
          updatedAt: "2026-05-02T12:00:00.000Z",
          createdByUserId: "user-licensee",
          updatedByUserId: "user-licensee",
        },
        {
          id: "calendar-scheduling-request-existing-task",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          kind: "deadline_review",
          status: "needs_review",
          title: "Existing task request must not duplicate",
          taskId: "task-visible-open",
          sourceType: "task_deadline",
          sourceId: "task-visible-open",
          sourceLabel: "Private existing task source must stay out",
          requestedDueAt: "2026-05-01T19:00:00.000Z",
          reminderPosture: "dashboard_pending",
          privacy: "staff_only",
          timeCaptureCue: {
            posture: "none",
            existingTimeEntryCount: 0,
            billable: false,
          },
          createdAt: "2026-05-02T13:00:00.000Z",
          updatedAt: "2026-05-02T13:00:00.000Z",
          createdByUserId: "user-licensee",
          updatedByUserId: "user-licensee",
        },
      ],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        id: "follow-up-cue:contact-client:calendar-scheduling-request-follow-up",
        title: "Follow-up review cue",
        kind: "task",
        metadata: expect.objectContaining({
          cueType: "follow_up_review",
          contactId: "contact-client",
          matterId: "matter-001",
          schedulingRequestId: "calendar-scheduling-request-follow-up",
          priority: "high",
          reviewBoundary: {
            automaticTaskCreation: false,
            automaticDeadlineMutation: false,
            automaticReminderChanges: false,
            queueDelivery: false,
          },
        }),
      }),
      expect.objectContaining({
        id: "task-cue:contact-client:task-visible-open",
        title: "Task deadline cue",
        kind: "task",
        metadata: expect.objectContaining({
          cueType: "open_task",
          contactId: "contact-client",
          taskId: "task-visible-open",
          bucket: "overdue",
          assignmentScope: "current_user",
        }),
      }),
    ]);
    expect(JSON.stringify(entries)).not.toContain("Private task title");
    expect(JSON.stringify(entries)).not.toContain("Private task description");
    expect(JSON.stringify(entries)).not.toContain("Private scheduling title");
    expect(JSON.stringify(entries)).not.toContain("Private source label");
    expect(JSON.stringify(entries)).not.toContain("Private existing task source");
    expect(JSON.stringify(entries)).not.toContain("Hidden matter task");
    expect(JSON.stringify(entries)).not.toContain("task-completed");
    expect(JSON.stringify(entries)).not.toContain("calendar-scheduling-request-existing-task");
  });
});

describe("structured task detail", () => {
  it("summarizes checklist progress, blockers, comments, and safe structure boundaries", () => {
    const structuredTask = task({
      id: "task-structured",
      title: "Structured synthetic task",
      dueAt: "2026-05-10T17:00:00.000Z",
    });
    const checklistItems: TaskChecklistItemRecord[] = [
      {
        id: "checklist-open",
        firmId: structuredTask.firmId,
        matterId: structuredTask.matterId,
        taskId: structuredTask.id,
        title: "Open synthetic checklist item",
        status: "open",
        sortOrder: 2,
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T10:00:00.000Z",
        version: 1,
      },
      {
        id: "checklist-completed",
        firmId: structuredTask.firmId,
        matterId: structuredTask.matterId,
        taskId: structuredTask.id,
        title: "Completed synthetic checklist item",
        status: "completed",
        sortOrder: 1,
        completedAt: "2026-05-02T10:00:00.000Z",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-02T10:00:00.000Z",
        version: 2,
      },
      {
        id: "checklist-archived",
        firmId: structuredTask.firmId,
        matterId: structuredTask.matterId,
        taskId: structuredTask.id,
        title: "Archived synthetic checklist item",
        status: "blocked",
        sortOrder: 0,
        archivedAt: "2026-05-02T11:00:00.000Z",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-02T11:00:00.000Z",
        version: 2,
      },
    ];
    const comments: TaskCommentRecord[] = [
      {
        id: "comment-active",
        firmId: structuredTask.firmId,
        matterId: structuredTask.matterId,
        taskId: structuredTask.id,
        body: "Synthetic staff-only detail.",
        createdAt: "2026-05-02T12:00:00.000Z",
        createdByUserId: "user-licensee",
      },
      {
        id: "comment-archived",
        firmId: structuredTask.firmId,
        matterId: structuredTask.matterId,
        taskId: structuredTask.id,
        body: "Archived staff-only detail.",
        archivedAt: "2026-05-02T13:00:00.000Z",
        createdAt: "2026-05-02T11:00:00.000Z",
        createdByUserId: "user-licensee",
      },
    ];
    const dependencies: TaskDependencyRecord[] = [
      {
        id: "dependency-blocks-open",
        firmId: structuredTask.firmId,
        matterId: structuredTask.matterId,
        taskId: structuredTask.id,
        dependsOnTaskId: "task-blocking-open",
        dependencyType: "blocks",
        createdAt: "2026-05-02T14:00:00.000Z",
      },
      {
        id: "dependency-relates",
        firmId: structuredTask.firmId,
        matterId: structuredTask.matterId,
        taskId: structuredTask.id,
        dependsOnTaskId: "task-related",
        dependencyType: "relates_to",
        createdAt: "2026-05-02T15:00:00.000Z",
      },
    ];
    const templates: TaskTemplateRecord[] = [
      {
        id: "template-active",
        firmId: structuredTask.firmId,
        name: "Active synthetic template",
        defaultPriority: "medium",
        status: "active",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T10:00:00.000Z",
        version: 1,
      },
      {
        id: "template-archived",
        firmId: structuredTask.firmId,
        name: "Archived synthetic template",
        defaultPriority: "low",
        status: "archived",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T10:00:00.000Z",
        version: 1,
      },
    ];
    const templateItems: TaskTemplateItemRecord[] = [
      {
        id: "template-item",
        firmId: structuredTask.firmId,
        templateId: "template-active",
        title: "Synthetic template item",
        sortOrder: 0,
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T10:00:00.000Z",
      },
    ];

    const detail = buildTaskStructuredDetail({
      task: structuredTask,
      checklistItems,
      comments,
      dependencies,
      dependencyTasks: [task({ id: "task-blocking-open" })],
      templates,
      templateItems,
      now,
    });

    expect(detail.checklistItems.map((item) => item.id)).toEqual([
      "checklist-completed",
      "checklist-open",
    ]);
    expect(detail.checklistProgress).toEqual({
      total: 2,
      open: 1,
      completed: 1,
      blocked: 0,
      percentComplete: 50,
    });
    expect(detail.commentSummary).toEqual({
      count: 1,
      latestCreatedAt: "2026-05-02T12:00:00.000Z",
    });
    expect(detail.dependencySummary).toEqual({
      blocks: 1,
      relatesTo: 1,
      blockingTaskIds: ["task-blocking-open"],
      blockedByOpenTaskIds: ["task-blocking-open"],
    });
    expect(detail.templates.map((template) => template.id)).toEqual(["template-active"]);
    expect(detail.templateItems.map((item) => item.id)).toEqual(["template-item"]);
    expect(detail.structureBoundary).toEqual({
      staffOnlyComments: true,
      clientVisible: false,
      automaticDeadlineMutation: false,
      automaticTaskCreation: false,
      providerSync: false,
      emailDelivery: false,
    });
    expect(JSON.stringify(detail)).not.toContain("Archived synthetic checklist item");
    expect(JSON.stringify(detail)).not.toContain("Archived staff-only detail");
  });
});
