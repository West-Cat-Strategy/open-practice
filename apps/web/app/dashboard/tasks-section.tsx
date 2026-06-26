import { useMemo, useState } from "react";
import type { MatterSummary, PracticeOverview, TaskDeadlineWorkbenchResponse } from "../types";

type TaskRow = TaskDeadlineWorkbenchResponse["tasks"][number];
type TaskSuggestion = TaskDeadlineWorkbenchResponse["suggestedFollowUps"][number];
type TaskPriority = TaskRow["priority"];
type TaskStatus = TaskRow["status"];
type TaskBucket = TaskRow["bucket"];
type TaskSourceType = NonNullable<TaskRow["sourceType"]>;

export interface TaskCreatePayload {
  matterId: string;
  title: string;
  description?: string;
  assignedToUserId?: string;
  priority: TaskPriority;
  dueAt?: string;
  sourceType?: TaskSourceType;
  sourceId?: string;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string | null;
  assignedToUserId?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  sourceType?: TaskSourceType | null;
  sourceId?: string | null;
}

interface TaskFormState {
  matterId: string;
  title: string;
  description: string;
  assignedToUserId: string;
  priority: TaskPriority;
  dueDate: string;
  sourceType: TaskSourceType | "";
  sourceId: string;
}

export interface TasksSectionProps {
  activeMatterId: string;
  busyKey: string;
  compactDate: (value?: string) => string;
  currentUserId: string;
  includeArchived: boolean;
  matters: MatterSummary[];
  onArchiveTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onCreateTask: (payload: TaskCreatePayload) => void;
  onIncludeArchivedChange: (includeArchived: boolean) => void;
  onReopenTask: (taskId: string) => void;
  onRequestTaskDeadlineReview: (task: TaskRow) => void;
  onSelectMatter: (matterId: string) => void;
  onUpdateTask: (taskId: string, payload: TaskUpdatePayload) => void;
  schedulingReviewBusyKey: string;
  status: string;
  taskWorkbench: TaskDeadlineWorkbenchResponse;
  tasks: TaskRow[];
  users: PracticeOverview["users"];
}

const priorities: TaskPriority[] = ["high", "medium", "low"];
const statuses: Array<TaskStatus | "all"> = ["all", "open", "completed", "archived"];
const buckets: Array<TaskBucket | "all"> = [
  "all",
  "overdue",
  "today",
  "upcoming",
  "unscheduled",
  "completed",
];

function toTitleCase(value: string): string {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function dateInputValue(value?: string): string {
  return value?.slice(0, 10) ?? "";
}

function dateInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T17:00:00.000Z`).toISOString();
}

function emptyForm(matterId: string): TaskFormState {
  return {
    matterId,
    title: "",
    description: "",
    assignedToUserId: "",
    priority: "medium",
    dueDate: "",
    sourceType: "",
    sourceId: "",
  };
}

function formFromTask(task: TaskRow): TaskFormState {
  return {
    matterId: task.matterId,
    title: task.title,
    description: task.description ?? "",
    assignedToUserId: task.assignedToUserId ?? "",
    priority: task.priority,
    dueDate: dateInputValue(task.dueAt),
    sourceType: task.sourceType ?? "",
    sourceId: task.sourceId ?? "",
  };
}

function formFromSuggestion(suggestion: TaskSuggestion): TaskFormState {
  return {
    matterId: suggestion.matterId,
    title: suggestion.title,
    description: suggestion.reason,
    assignedToUserId: "",
    priority: suggestion.priority,
    dueDate: dateInputValue(suggestion.dueAt),
    sourceType: suggestion.source.type,
    sourceId: suggestion.source.id,
  };
}

function createPayloadFromForm(form: TaskFormState): TaskCreatePayload {
  const description = form.description.trim();
  const dueAt = dateInputToIso(form.dueDate);
  return {
    matterId: form.matterId,
    title: form.title.trim(),
    ...(description ? { description } : {}),
    ...(form.assignedToUserId ? { assignedToUserId: form.assignedToUserId } : {}),
    priority: form.priority,
    ...(dueAt ? { dueAt } : {}),
    ...(form.sourceType && form.sourceId
      ? { sourceType: form.sourceType, sourceId: form.sourceId }
      : {}),
  };
}

function updatePayloadFromForm(form: TaskFormState): TaskUpdatePayload {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    assignedToUserId: form.assignedToUserId || null,
    priority: form.priority,
    dueAt: dateInputToIso(form.dueDate) ?? null,
  };
}

function assigneeLabel(task: TaskRow, usersById: Map<string, string>): string {
  if (!task.assignedToUserId) return "Unassigned";
  return usersById.get(task.assignedToUserId) ?? task.assignedToUserId;
}

function taskMatterLabel(task: TaskRow, mattersById: Map<string, MatterSummary>): string {
  return matterLabel(task.matterId, mattersById);
}

function matterLabel(matterId: string, mattersById: Map<string, MatterSummary>): string {
  const matter = mattersById.get(matterId);
  return matter ? `${matter.number} · ${matter.title}` : matterId;
}

function visibleStaffUsers(users: PracticeOverview["users"]): PracticeOverview["users"] {
  return users.filter((user) => user.role !== "client_external");
}

export function TasksSection({
  activeMatterId,
  busyKey,
  compactDate,
  currentUserId,
  includeArchived,
  matters,
  onArchiveTask,
  onCompleteTask,
  onCreateTask,
  onIncludeArchivedChange,
  onReopenTask,
  onRequestTaskDeadlineReview,
  onSelectMatter,
  onUpdateTask,
  schedulingReviewBusyKey,
  status,
  taskWorkbench,
  tasks,
  users,
}: TasksSectionProps) {
  const defaultMatterId = activeMatterId || matters[0]?.id || "";
  const staffUsers = useMemo(() => visibleStaffUsers(users), [users]);
  const usersById = useMemo(
    () => new Map(staffUsers.map((user) => [user.id, user.displayName])),
    [staffUsers],
  );
  const mattersById = useMemo(
    () => new Map(matters.map((matter) => [matter.id, matter])),
    [matters],
  );
  const [matterFilter, setMatterFilter] = useState<"active" | "all" | string>(
    activeMatterId ? "active" : "all",
  );
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("open");
  const [bucketFilter, setBucketFilter] = useState<TaskBucket | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [form, setForm] = useState<TaskFormState>(() => emptyForm(defaultMatterId));
  const taskReviewItemsById = useMemo(
    () => new Map(taskWorkbench.taskReview.items.map((item) => [item.id, item])),
    [taskWorkbench.taskReview.items],
  );

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const selectedMatterId = matterFilter === "active" ? activeMatterId : matterFilter;
        if (selectedMatterId !== "all" && selectedMatterId && task.matterId !== selectedMatterId) {
          return false;
        }
        if (assigneeFilter === "me" && task.assignedToUserId !== currentUserId) return false;
        if (
          assigneeFilter !== "all" &&
          assigneeFilter !== "me" &&
          task.assignedToUserId !== assigneeFilter
        ) {
          return false;
        }
        if (statusFilter !== "all" && task.status !== statusFilter) return false;
        if (bucketFilter !== "all" && task.bucket !== bucketFilter) return false;
        if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
        return includeArchived || task.status !== "archived";
      }),
    [
      activeMatterId,
      assigneeFilter,
      bucketFilter,
      currentUserId,
      includeArchived,
      matterFilter,
      priorityFilter,
      statusFilter,
      tasks,
    ],
  );
  const editingTask = tasks.find((task) => task.id === editingTaskId);
  const formTitle = editingTask ? "Edit task" : "Create task";
  const createDisabled = busyKey === "create" || !form.matterId || form.title.trim().length === 0;
  const suggestedFollowUps = taskWorkbench.suggestedFollowUps.slice(0, 6);

  function resetForm(): void {
    setEditingTaskId("");
    setForm(emptyForm(defaultMatterId));
  }

  function submitForm(): void {
    if (editingTask) {
      onUpdateTask(editingTask.id, updatePayloadFromForm(form));
      return;
    }
    onCreateTask(createPayloadFromForm(form));
  }

  function createFromSuggestion(suggestion: TaskSuggestion): void {
    onCreateTask(createPayloadFromForm(formFromSuggestion(suggestion)));
  }

  return (
    <>
      <div className="detail-grid queue-summary-grid">
        <div>
          <span className="field-label">My open tasks</span>
          <strong>
            {taskWorkbench.counters.my.overdue +
              taskWorkbench.counters.my.today +
              taskWorkbench.counters.my.upcoming}
          </strong>
          <small>{taskWorkbench.counters.my.overdue} overdue</small>
        </div>
        <div>
          <span className="field-label">Team open tasks</span>
          <strong>
            {taskWorkbench.counters.team.overdue +
              taskWorkbench.counters.team.today +
              taskWorkbench.counters.team.upcoming}
          </strong>
          <small>{taskWorkbench.counters.team.today} due today</small>
        </div>
        <div>
          <span className="field-label">Review queue</span>
          <strong>{taskWorkbench.taskReview.summary.open}</strong>
          <small>{taskWorkbench.taskReview.summary.schedulingReviewCount} scheduling cues</small>
        </div>
        <div>
          <span className="field-label">Suggested follow-ups</span>
          <strong>{taskWorkbench.suggestedFollowUps.length}</strong>
          <small>Review-first safe signals</small>
        </div>
      </div>

      <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </p>

      <div className="first-matter-form-grid task-filter-grid">
        <label>
          <span className="field-label">Matter</span>
          <select value={matterFilter} onChange={(event) => setMatterFilter(event.target.value)}>
            <option value="all">All matters</option>
            {activeMatterId ? <option value="active">Active matter</option> : null}
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.number} · {matter.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Assignee</span>
          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value="all">All assignees</option>
            <option value="me">Assigned to me</option>
            {staffUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as TaskStatus | "all")}
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {toTitleCase(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Due bucket</span>
          <select
            value={bucketFilter}
            onChange={(event) => setBucketFilter(event.target.value as TaskBucket | "all")}
          >
            {buckets.map((value) => (
              <option key={value} value={value}>
                {toTitleCase(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Priority</span>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as TaskPriority | "all")}
          >
            <option value="all">All priorities</option>
            {priorities.map((value) => (
              <option key={value} value={value}>
                {toTitleCase(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Archived</span>
          <select
            value={includeArchived ? "true" : "false"}
            onChange={(event) => onIncludeArchivedChange(event.target.value === "true")}
          >
            <option value="false">Hide archived</option>
            <option value="true">Show archived</option>
          </select>
        </label>
      </div>

      <div className="section-title">
        <h3>{formTitle}</h3>
        {editingTask ? <span>v{editingTask.version}</span> : <span>Staff only</span>}
      </div>
      <div className="first-matter-form-grid task-editor-grid">
        <label>
          <span className="field-label">Matter</span>
          <select
            disabled={Boolean(editingTask)}
            value={form.matterId}
            onChange={(event) =>
              setForm((current) => ({ ...current, matterId: event.target.value }))
            }
          >
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.number} · {matter.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Title</span>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <label>
          <span className="field-label">Assignee</span>
          <select
            value={form.assignedToUserId}
            onChange={(event) =>
              setForm((current) => ({ ...current, assignedToUserId: event.target.value }))
            }
          >
            <option value="">Unassigned</option>
            {staffUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Priority</span>
          <select
            value={form.priority}
            onChange={(event) =>
              setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))
            }
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {toTitleCase(priority)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Due date</span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, dueDate: event.target.value }))
            }
          />
        </label>
        <label>
          <span className="field-label">Description</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </label>
      </div>
      <div className="connector-recovery-confirmation task-editor-actions">
        <button
          className="secondary-button compact-button"
          disabled={
            createDisabled || (editingTask ? busyKey === `update:${editingTask.id}` : false)
          }
          onClick={submitForm}
          type="button"
        >
          {editingTask
            ? busyKey === `update:${editingTask.id}`
              ? "Saving"
              : "Save"
            : busyKey === "create"
              ? "Creating"
              : "Create"}
        </button>
        <button className="secondary-button compact-button" onClick={resetForm} type="button">
          Reset
        </button>
      </div>

      <div className="section-title">
        <h3>Tasks</h3>
        <span>{visibleTasks.length}</span>
      </div>
      <div className="party-list queue-section-list task-list">
        {visibleTasks.map((task) => {
          const archived = task.status === "archived";
          const schedulingReviewBusyKeyForTask = `task:${task.id}:scheduling-request`;
          const schedulingReviewBusy = schedulingReviewBusyKey === schedulingReviewBusyKeyForTask;
          const openSchedulingReview =
            (taskReviewItemsById.get(task.id)?.scheduling.needsReviewCount ?? 0) > 0;
          const requestReviewDisabled =
            archived || task.status === "completed" || schedulingReviewBusy || openSchedulingReview;
          const requestReviewTitle = archived
            ? "Archived tasks cannot be sent for deadline review."
            : task.status === "completed"
              ? "Completed tasks cannot be sent for deadline review."
              : openSchedulingReview
                ? "An open deadline review request already exists for this task."
                : "Create deadline review request.";
          return (
            <div className="party-row queue-item-row" key={task.id}>
              <span>
                <strong>{task.title}</strong>
                <small>{taskMatterLabel(task, mattersById)}</small>
                <small>
                  {assigneeLabel(task, usersById)} · {toTitleCase(task.status)} ·{" "}
                  {toTitleCase(task.priority)} · {toTitleCase(task.bucket)} ·{" "}
                  {compactDate(task.dueAt)}
                </small>
                {task.description ? <small>{task.description}</small> : null}
                {task.sourceType && task.sourceId ? (
                  <small>
                    {toTitleCase(task.sourceType)} · {task.sourceId}
                  </small>
                ) : null}
              </span>
              <span className="queue-row-actions row-actions">
                <button
                  className="secondary-button compact-button row-button"
                  disabled={archived}
                  onClick={() => {
                    setEditingTaskId(task.id);
                    setForm(formFromTask(task));
                  }}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="secondary-button compact-button row-button"
                  onClick={() => onSelectMatter(task.matterId)}
                  type="button"
                >
                  Matter
                </button>
                <button
                  className="secondary-button compact-button row-button"
                  disabled={requestReviewDisabled}
                  onClick={() => onRequestTaskDeadlineReview(task)}
                  title={requestReviewTitle}
                  type="button"
                >
                  {schedulingReviewBusy
                    ? "Requesting"
                    : openSchedulingReview
                      ? "Review requested"
                      : "Request review"}
                </button>
                {task.status === "completed" ? (
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={archived || busyKey === `reopen:${task.id}`}
                    onClick={() => onReopenTask(task.id)}
                    type="button"
                  >
                    {busyKey === `reopen:${task.id}` ? "Reopening" : "Reopen"}
                  </button>
                ) : (
                  <button
                    className="secondary-button compact-button row-button"
                    disabled={archived || busyKey === `complete:${task.id}`}
                    onClick={() => onCompleteTask(task.id)}
                    type="button"
                  >
                    {busyKey === `complete:${task.id}` ? "Completing" : "Complete"}
                  </button>
                )}
                <button
                  className="secondary-button compact-button row-button"
                  disabled={archived || busyKey === `archive:${task.id}`}
                  onClick={() => onArchiveTask(task.id)}
                  type="button"
                >
                  {busyKey === `archive:${task.id}` ? "Archiving" : "Archive"}
                </button>
              </span>
            </div>
          );
        })}
        {visibleTasks.length === 0 ? (
          <p className="inline-empty">No tasks match the filters.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Suggested follow-ups</h3>
        <span>{suggestedFollowUps.length}</span>
      </div>
      <div className="party-list queue-section-list">
        {suggestedFollowUps.map((suggestion) => (
          <div className="party-row queue-item-row" key={suggestion.id}>
            <span>
              <strong>{suggestion.title}</strong>
              <small>{matterLabel(suggestion.matterId, mattersById)}</small>
              <small>
                {suggestion.source.label} · {toTitleCase(suggestion.priority)} ·{" "}
                {compactDate(suggestion.dueAt)}
              </small>
              <small>{suggestion.reason}</small>
            </span>
            <span className="queue-row-actions row-actions">
              <button
                className="secondary-button compact-button row-button"
                disabled={busyKey === "create"}
                onClick={() => {
                  setEditingTaskId("");
                  setForm(formFromSuggestion(suggestion));
                }}
                type="button"
              >
                Use
              </button>
              <button
                className="secondary-button compact-button row-button"
                disabled={busyKey === "create"}
                onClick={() => createFromSuggestion(suggestion)}
                type="button"
              >
                {busyKey === "create" ? "Creating" : "Create task"}
              </button>
            </span>
          </div>
        ))}
        {suggestedFollowUps.length === 0 ? (
          <p className="inline-empty">No review-first follow-ups are suggested.</p>
        ) : null}
      </div>
    </>
  );
}
