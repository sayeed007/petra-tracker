import { attachDatabasePool } from "@vercel/functions";
import { MongoClient } from "mongodb";
import type { CommentDocument, IssueDocument, UserDocument } from "./types";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClient?: MongoClient;
  mongoReady?: Promise<MongoClient>;
  mongoIndexReady?: Promise<void>;
};

function clientReady() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");

  if (!globalForMongo.mongoReady) {
    const client = new MongoClient(uri, {
      appName: "petra-issue-tracker",
      maxIdleTimeMS: 5_000,
      maxPoolSize: 10,
    });
    globalForMongo.mongoClient = client;
    globalForMongo.mongoReady = client.connect();
    if (process.env.VERCEL) attachDatabasePool(client);
  }
  return globalForMongo.mongoReady;
}

export async function getMongoClient() {
  return clientReady();
}

export async function getDb() {
  const client = await clientReady();
  const database = client.db(process.env.MONGODB_DB || "petra_tracker");
  if (!globalForMongo.mongoIndexReady) {
    globalForMongo.mongoIndexReady = Promise.all([
      database.collection<UserDocument>("users").createIndex({ email: 1 }, { unique: true }),
      database.collection<IssueDocument>("issues").createIndex({ externalId: 1 }, { unique: true }),
      database.collection<IssueDocument>("issues").createIndex({ status: 1, module: 1 }),
      database.collection<IssueDocument>("issues").createIndex({ assigneeId: 1, status: 1 }),
      database.collection<CommentDocument>("comments").createIndex({ issueId: 1, createdAt: 1 }),
    ]).then(() => undefined);
  }
  await globalForMongo.mongoIndexReady;
  return database;
}

export async function closeDb() {
  await globalForMongo.mongoClient?.close();
  delete globalForMongo.mongoClient;
  delete globalForMongo.mongoReady;
  delete globalForMongo.mongoIndexReady;
}
