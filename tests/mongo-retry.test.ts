// A failed MongoDB connect must not be cached: the next call has to try again (the cause of the intermittent outage).
import assert from "node:assert/strict";
import { test } from "node:test";

test("a failed connect is retried by the next call", async () => {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:1"; // nothing listens there
  process.env.MONGODB_CONNECT_TIMEOUT_MS = "300";
  const { getMongoClient } = await import("../src/lib/db/mongo");
  await assert.rejects(getMongoClient());
  const g = globalThis as { mongoReady?: Promise<unknown> };
  assert.equal(g.mongoReady, undefined, "the rejected promise must be dropped");
  const second = getMongoClient();
  assert.notEqual(g.mongoReady, undefined, "the second call starts a new attempt");
  await assert.rejects(second);
});
