import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_BULK_ASSIGN, accessOutcome, canManageIssue, decisionSchema, isBootstrapAdmin, parseBulkAssign, parseIssueUpdate, planSourceSync } from "../src/lib/issues/domain";

describe("canManageIssue", () => {
  it("lets an admin manage every issue", () => {
    assert.equal(canManageIssue({ id: "a", role: "admin" }, null), true);
    assert.equal(canManageIssue({ id: "a", role: "admin" }, "b"), true);
  });
  it("lets a developer manage only the issues assigned to them", () => {
    assert.equal(canManageIssue({ id: "d", role: "developer" }, "d"), true);
    assert.equal(canManageIssue({ id: "d", role: "developer" }, "e"), false);
    assert.equal(canManageIssue({ id: "d", role: "developer" }, null), false);
  });
});

describe("parseIssueUpdate", () => {
  it("needs a comment", () => {
    assert.equal(parseIssueUpdate({ status: "fixed", comment: "   " }).success, false);
  });
  it("keeps the status when none is chosen", () => {
    const parsed = parseIssueUpdate({ status: "", comment: "Looked at it" });
    assert.equal(parsed.success, true);
    assert.equal(parsed.success && parsed.data.status, undefined);
  });
  it("rejects an unknown status", () => {
    assert.equal(parseIssueUpdate({ status: "done", comment: "x" }).success, false);
  });
  it("asks for a real reason on Won't fix", () => {
    assert.equal(parseIssueUpdate({ status: "wontfix", comment: "no" }).success, false);
    const long = parseIssueUpdate({ status: "wontfix", comment: "The business confirmed the old rule stays." });
    assert.equal(long.success, true);
  });
  it("does not ask for a long comment on other statuses", () => {
    assert.equal(parseIssueUpdate({ status: "fixed", comment: "Fixed in 5849b720" }).success, true);
  });
});

describe("planSourceSync", () => {
  it("adopts the catalogue status of an issue imported before sourceStatus existed", () => {
    assert.equal(planSourceSync({ status: "open" }, "fixed"), "adopt");
    assert.equal(planSourceSync({ status: "open", sourceStatus: null }, "fixed"), "adopt");
  });
  it("does nothing when the catalogue status did not move", () => {
    assert.equal(planSourceSync({ status: "fixed", sourceStatus: "fixed" }, "fixed"), "none");
    assert.equal(planSourceSync({ status: "wontfix", sourceStatus: "open" }, "open"), "none");
  });
  it("applies a catalogue move to an issue nobody changed", () => {
    assert.equal(planSourceSync({ status: "open", sourceStatus: "open" }, "fixed"), "apply");
  });
  it("keeps the status a person set and only notes the catalogue move", () => {
    assert.equal(planSourceSync({ status: "wontfix", sourceStatus: "open" }, "fixed"), "keep");
  });
});

describe("parseBulkAssign", () => {
  it("needs at least one id and drops blanks and duplicates", () => {
    assert.equal(parseBulkAssign({ ids: [], assigneeId: "x" }), null);
    assert.deepEqual(parseBulkAssign({ ids: ["a", " a ", "", "b"], assigneeId: "x" }), { ids: ["a", "b"], assigneeId: "x" });
  });
  it("refuses more than the limit", () => {
    const ids = Array.from({ length: MAX_BULK_ASSIGN + 1 }, (_, index) => `i${index}`);
    assert.equal(parseBulkAssign({ ids, assigneeId: "x" }), null);
    assert.notEqual(parseBulkAssign({ ids: ids.slice(0, MAX_BULK_ASSIGN), assigneeId: "" }), null);
  });
});

describe("decisionSchema", () => {
  it("lets an approval go without a note", () => {
    assert.equal(decisionSchema.safeParse({ decision: "approve", note: "" }).success, true);
  });
  it("makes a rejection say why", () => {
    assert.equal(decisionSchema.safeParse({ decision: "reject", note: "  " }).success, false);
    assert.equal(decisionSchema.safeParse({ decision: "reject", note: "Still fails on the dev stack" }).success, true);
  });
  it("refuses anything but approve or reject", () => {
    assert.equal(decisionSchema.safeParse({ decision: "maybe", note: "x" }).success, false);
  });
});

describe("isBootstrapAdmin", () => {
  it("makes the configured account the first administrator", () => {
    assert.equal(isBootstrapAdmin({ email: "Me@Example.com", bootstrapEmail: "me@example.com", adminCount: 0 }), true);
  });
  it("never creates anyone else", () => {
    assert.equal(isBootstrapAdmin({ email: "other@example.com", bootstrapEmail: "me@example.com", adminCount: 0 }), false);
  });
  it("stops once an administrator exists", () => {
    assert.equal(isBootstrapAdmin({ email: "me@example.com", bootstrapEmail: "me@example.com", adminCount: 1 }), false);
  });
  it("does nothing when no bootstrap email is configured", () => {
    assert.equal(isBootstrapAdmin({ email: "me@example.com", bootstrapEmail: undefined, adminCount: 0 }), false);
    assert.equal(isBootstrapAdmin({ email: "me@example.com", bootstrapEmail: "  ", adminCount: 0 }), false);
  });
});

describe("accessOutcome", () => {
  it("lets an active account in", () => {
    assert.equal(accessOutcome({ active: true }), "allow");
    assert.equal(accessOutcome({ active: true, access: "approved" }), "allow");
  });
  it("records a request for an unknown account", () => {
    assert.equal(accessOutcome(null), "request");
  });
  it("makes a pending request wait", () => {
    assert.equal(accessOutcome({ active: false, access: "pending" }), "waiting");
  });
  it("keeps a declined account out", () => {
    assert.equal(accessOutcome({ active: false, access: "declined" }), "declined");
  });
  it("tells a deactivated account it is switched off", () => {
    assert.equal(accessOutcome({ active: false }), "disabled");
    assert.equal(accessOutcome({ active: false, access: "approved" }), "disabled");
  });
});
