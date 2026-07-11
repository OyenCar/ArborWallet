import { MongoMemoryServer } from "mongodb-memory-server";
import { beforeAll, afterAll, afterEach } from "vitest";
import { getDb, closeConnection, __setTestConnectionString } from "./src/lib/data/client";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  __setTestConnectionString(mongod.getUri());
});

afterEach(async () => {
  const db = await getDb();
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await closeConnection();
  await mongod.stop();
});
