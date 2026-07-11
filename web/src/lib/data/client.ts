import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;
let testConnectionString: string | null = null;

// Test-only hook: mongodb-memory-server assigns a random port per run, so
// the connection string cannot be a static env var in tests.
export function __setTestConnectionString(uri: string): void {
  testConnectionString = uri;
  client = null;
  db = null;
}

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = testConnectionString ?? process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
}

export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
