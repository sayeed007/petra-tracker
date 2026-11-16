import type { ObjectId } from "mongodb";
import type { IssueStatus } from "@/lib/issues/domain";

export type Role = "admin" | "developer";

export type UserDocument = {
  _id: ObjectId;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  /** How the account came to be: absent/"approved" = added or approved by an administrator, "pending" = asked for access, "declined". */
  access?: "pending" | "approved" | "declined";
  requestedAt?: Date;
  createdAt: Date;
};

export type IssueDocument = {
  _id: ObjectId;
  externalId: string;
  title: string;
  module: string;
  side: string;
  severity: string;
  status: IssueStatus;
  /** The status the catalogue (data/items.json) had at the last import; the people's status is `status`. */
  sourceStatus?: IssueStatus | null;
  assigneeId: ObjectId | null;
  /** A developer's proposed status waiting for an administrator; the official `status` stays as it is until it is approved. */
  pendingRequest?: { commentId: ObjectId; status: IssueStatus; by: ObjectId; at: Date } | null;
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type CommentDocument = {
  _id: ObjectId;
  issueId: ObjectId;
  /** Null for a system note (import, assignment). */
  authorId: ObjectId | null;
  /** "system" notes are written by the app (import, assignment), "user" notes by a person. Absent on old rows = user. */
  kind?: "user" | "system" | "request";
  /** For kind "request": the status the developer asks for, and what the administrator decided. */
  requestedStatus?: IssueStatus | null;
  decision?: "pending" | "approved" | "rejected" | "superseded" | null;
  decidedBy?: ObjectId | null;
  decidedAt?: Date | null;
  decisionNote?: string | null;
  body: string;
  statusFrom: IssueStatus | null;
  statusTo: IssueStatus | null;
  createdAt: Date;
};
