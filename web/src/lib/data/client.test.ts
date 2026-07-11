import { describe, it, expect } from "vitest";
import { getDb } from "./client";

describe("getDb", () => {
  it("returns a connected database handle", async () => {
    const db = await getDb();
    expect(db.databaseName).toBeTruthy();
  });

  it("returns the same instance across calls (memoized)", async () => {
    const first = await getDb();
    const second = await getDb();
    expect(first).toBe(second);
  });

  it("the returned handle can read and write a collection", async () => {
    const db = await getDb();
    const col = db.collection("client_test_probe");
    await col.insertOne({ ping: "pong" });
    const found = await col.findOne({ ping: "pong" });
    expect(found?.ping).toBe("pong");
  });
});
