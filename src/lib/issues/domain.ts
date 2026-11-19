import { z } from "zod";

export const ISSUE_STATUSES = [
  "open",
  "in-progress",
  "fixed-per-log",
  "fixed",
  "still-bug",
  "decision",
  "wontfix",
  "unknown",
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** "Won't fix" must say why (the business rule or the reason the work will not proceed). */
export const MIN_WONTFIX_REASON = 20;

export const commentSchema = z.string().trim().min(1).max(4000);
export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export const issueUpdateSchema = z
  .object({
    status: issueStatusSchema.optional(),
    comment: commentSchema,
  })
  .superRefine((value, context) => {
    if (value.status === "wontfix" && value.comment.length < MIN_WONTFIX_REASON) {
      context.addIssue({ code: "custom", path: ["comment"], message: "wontfix-reason" });
    }
  });

export const developerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
});

export function canManageIssue(
  actor: { id: string; role: "admin" | "developer" },
  assigneeId: string | null,
) {
  return actor.role === "admin" || actor.id === assigneeId;
}

export function parseIssueUpdate(input: { status?: unknown; comment?: unknown }) {
  return issueUpdateSchema.safeParse({
    status: input.status === "" ? undefined : input.status,
    comment: input.comment,
  });
}

/**
 * What a re-import does with an issue whose status in the catalogue (data/items.json, written by the code check)
 * may have moved since the last import. The portal status belongs to the people: it is only replaced when
 * nobody has changed it since the last import.
 *  - "none"   the catalogue status did not change
 *  - "adopt"  the issue predates sourceStatus: remember the catalogue status, change nothing
 *  - "apply"  untouched by people: take the new catalogue status (with a system comment)
 *  - "keep"   a person changed the status: keep it, remember the catalogue status (with a system comment)
 */
export type SourceSync = "none" | "adopt" | "apply" | "keep";

export function planSourceSync(
  existing: { status: string; sourceStatus?: string | null },
  source: string,
): SourceSync {
  if (existing.sourceStatus == null) return "adopt";
  if (existing.sourceStatus === source) return "none";
  return existing.status === existing.sourceStatus ? "apply" : "keep";
}

/** The administrator's answer to a developer's status request. A rejection must say why. */
export const decisionSchema = z
  .object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(4000) })
  .superRefine((value, context) => {
    if (value.decision === "reject" && value.note.length === 0) {
      context.addIssue({ code: "custom", path: ["note"], message: "reject-reason" });
    }
  });

/** A bulk assignment never touches more than this many issues at once. */
export const MAX_BULK_ASSIGN = 200;

export function parseBulkAssign(input: { ids: unknown[]; assigneeId: unknown }) {
  const ids = [...new Set(input.ids.map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_BULK_ASSIGN) return null;
  return { ids, assigneeId: String(input.assigneeId ?? "") };
}

/**
 * The very first administrator: when no administrator exists yet, the GitHub account whose primary email is
 * BOOTSTRAP_ADMIN_EMAIL becomes one on its first sign-in. Nobody else is ever created this way.
 */
export function isBootstrapAdmin(input: { email: string; bootstrapEmail?: string | null; adminCount: number }) {
  const wanted = input.bootstrapEmail?.trim().toLowerCase();
  return Boolean(wanted) && input.adminCount === 0 && input.email.trim().toLowerCase() === wanted;
}

/** What a GitHub sign-in of this email leads to. "request" = unknown account: an access request is recorded for an administrator. */
export type AccessOutcome = "allow" | "request" | "waiting" | "declined" | "disabled";

export function accessOutcome(existing: { active: boolean; access?: string | null } | null): AccessOutcome {
  if (!existing) return "request";
  if (existing.active) return "allow";
  if (existing.access === "pending") return "waiting";
  if (existing.access === "declined") return "declined";
  return "disabled";
}

/** The list shows what needs work first: still-a-bug on top, finished and closed work at the bottom. */
export const STATUS_ORDER: readonly IssueStatus[] = ["still-bug", "open", "in-progress", "decision", "fixed-per-log", "unknown", "fixed", "wontfix"];
export const SEVERITY_ORDER = ["high", "medium", "low", "unrated"] as const;

export const PAGE_SIZES = [20, 40, 100] as const;
export const DEFAULT_PAGE_SIZE = 40;

export function parsePageSize(value: unknown) {
  const size = Number(value);
  return (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE;
}

/** The list's own query keys (filters, page and page size); anything else (one-off messages and the like) is dropped. */
export const LIST_QUERY_KEYS = ["q", "status", "side", "module", "review", "size", "page"] as const;

/** Keeps only the list's filters from a query string, so a redirect or a back link can return to the same list. */
export function listQuery(raw: string) {
  const source = new URLSearchParams(raw.slice(0, 1000));
  const out = new URLSearchParams();
  for (const key of LIST_QUERY_KEYS) {
    const value = source.get(key);
    if (value) out.set(key, value.slice(0, 100));
  }
  return out.toString();
}

/** Finished work: it leaves the main list into the archive once nobody has touched it for ARCHIVE_AFTER_DAYS. */
export const CLOSED_STATUSES: readonly IssueStatus[] = ["fixed", "wontfix"];
export const ARCHIVE_AFTER_DAYS = 2;

/** Archived: closed and either archived by hand (archivedAt) or untouched for two days. */
export function isArchived(issue: { status: string; updatedAt: Date; archivedAt?: Date | null }, now: Date = new Date()) {
  return (CLOSED_STATUSES as readonly string[]).includes(issue.status) && (Boolean(issue.archivedAt) || issue.updatedAt <= archiveCutoff(now));
}

/** Closed issues last updated at or before this moment are archived. Reopening or commenting moves updatedAt, so they come back. */
export function archiveCutoff(now: Date = new Date()) {
  return new Date(now.getTime() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);
}
