import { describe, it, expect } from "vitest";
import { ActivityRepository } from "./activity-repository";

describe("ActivityRepository", () => {
  it("recordForUser inserts an entry findable via findRecentForUser", async () => {
    const repo = new ActivityRepository();
    await repo.recordForUser("user-1", "transfer_settled", { intentId: "intent-1" }, "Sent 10 USDC to @maya");

    const recent = await repo.findRecentForUser("user-1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].kind).toBe("transfer_settled");
    expect(recent[0].summary).toBe("Sent 10 USDC to @maya");
  });

  it("findRecentForUser respects the limit and excludes other users", async () => {
    const repo = new ActivityRepository();
    await repo.recordForUser("user-1", "a", {}, "first");
    await repo.recordForUser("user-1", "b", {}, "second");
    await repo.recordForUser("user-2", "c", {}, "other user");

    const recent = await repo.findRecentForUser("user-1", 1);
    expect(recent).toHaveLength(1);
  });
});
