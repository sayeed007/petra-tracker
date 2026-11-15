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

export const commentSchema = z.string().trim().min(1).max(4000);
export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export const issueUpdateSchema = z.object({
  status: issueStatusSchema.optional(),
  comment: commentSchema,
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
