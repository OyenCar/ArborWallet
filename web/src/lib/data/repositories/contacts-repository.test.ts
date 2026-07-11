import { describe, it, expect } from "vitest";
import { ContactsRepository } from "./contacts-repository";

describe("ContactsRepository", () => {
  it("findAllForUser returns only that user's contacts", async () => {
    const repo = new ContactsRepository();
    await repo.insertOne({ userId: "user-1", alias: "Maya", target: { kind: "username", value: "@maya" }, createdAt: new Date().toISOString() });
    await repo.insertOne({ userId: "user-2", alias: "Bob", target: { kind: "username", value: "@bob" }, createdAt: new Date().toISOString() });

    const found = await repo.findAllForUser("user-1");
    expect(found).toHaveLength(1);
    expect(found[0].alias).toBe("Maya");
  });
});
