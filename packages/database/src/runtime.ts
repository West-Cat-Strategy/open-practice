import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type OpenPracticeDatabase = PostgresJsDatabase<typeof schema>;

export interface DatabaseRuntime {
  db: OpenPracticeDatabase;
  close: () => Promise<void>;
}

export function createDatabaseRuntime(databaseUrl: string): DatabaseRuntime {
  const client = postgres(databaseUrl, { prepare: false });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}
