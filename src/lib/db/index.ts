// The app imports the database from here: "server-only" keeps it out of client components.
// The command-line scripts (scripts/*.ts) import ./mongo directly, because plain Node cannot resolve "server-only".
import "server-only";
export * from "./mongo";
