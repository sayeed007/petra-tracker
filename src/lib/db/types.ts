import type { ObjectId } from "mongodb";
import type { IssueStatus } from "@/lib/issues/domain";

export type Role = "admin" | "developer";

export type UserDocument = {
  _id: ObjectId;
  email: string;
  name: string;
  role: Role;
  active: boolean;
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
  assigneeId: ObjectId | null;
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type CommentDocument = {
  _id: ObjectId;
  issueId: ObjectId;
  authorId: ObjectId | null;
  body: string;
  statusFrom: IssueStatus | null;
  statusTo: IssueStatus | null;
  createdAt: Date;
};
