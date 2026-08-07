import type { CoordinationTask } from "@/features/coordination/api/coordinationQueries";

/** Plain-language status, never relying on colour alone. */
export function describeTask(task: CoordinationTask, respondingAs?: string | null) {
  const mine = task.owner_name && task.owner_name === respondingAs;
  switch (task.status) {
    case "approved":
      return `${task.decided_by_name ?? "A family member"} approved this.`;
    case "rejected":
      return `${task.decided_by_name ?? "A family member"} said no to this.`;
    case "done":
      return `${task.owner_name ?? "A family member"} has done this.`;
    case "not_needed":
      return "Marked as not needed.";
    case "claimed":
      return mine
        ? "You are doing this."
        : `${task.owner_name} is doing this.`;
    default:
      return "Nobody has taken this on yet.";
  }
}
