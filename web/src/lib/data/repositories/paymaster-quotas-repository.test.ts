import { describe, it, expect } from "vitest";
import { PaymasterQuotasRepository } from "./paymaster-quotas-repository";

describe("PaymasterQuotasRepository", () => {
  it("findByUserAndWindow finds the matching quota window", async () => {
    const repo = new PaymasterQuotasRepository();
    const windowStart = "2026-07-01T00:00:00.000Z";
    await repo.insertOne({ userId: "user-1", windowStart, sponsoredOps: 3, gasSpendWei: "1000", tier: "capped" });
    const found = await repo.findByUserAndWindow("user-1", windowStart);
    expect(found?.sponsoredOps).toBe(3);
  });
});
