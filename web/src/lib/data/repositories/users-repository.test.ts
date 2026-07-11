import { describe, it, expect } from "vitest";
import { UsersRepository } from "./users-repository";

const baseUser = {
  firebaseUid: "fb-1",
  username: "alice",
  email: "alice@example.com",
  preferences: { defaultChain: { test: "ethereum-sepolia" as const, main: "ethereum-mainnet" as const }, displayCurrency: "USD" },
  status: "active" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("UsersRepository", () => {
  it("findByFirebaseUid finds an inserted user", async () => {
    const repo = new UsersRepository();
    await repo.insertOne(baseUser);
    const found = await repo.findByFirebaseUid("fb-1");
    expect(found?.username).toBe("alice");
  });

  it("findByUsername finds an inserted user", async () => {
    const repo = new UsersRepository();
    await repo.insertOne(baseUser);
    const found = await repo.findByUsername("alice");
    expect(found?.firebaseUid).toBe("fb-1");
  });

  it("findByFirebaseUid returns null for an unknown uid", async () => {
    const repo = new UsersRepository();
    expect(await repo.findByFirebaseUid("nope")).toBeNull();
  });
});
