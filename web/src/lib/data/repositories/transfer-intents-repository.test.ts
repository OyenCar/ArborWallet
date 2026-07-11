import { describe, it, expect } from "vitest";
import { TransferIntentsRepository } from "./transfer-intents-repository";

const baseIntent = {
  userId: "user-1",
  kind: "transfer" as const,
  recipient: { kind: "username" as const, value: "@maya", resolvedAddress: "0xMAYA", chainKey: "arbitrum-sepolia" as const },
  asset: { assetKey: "arbitrum-sepolia:native", amountRaw: "1000000000000000000" },
  sourceChainKey: "arbitrum-sepolia" as const,
  quote: { fees: "0", eta: 30, legPlan: ["leg-1"] },
  status: "draft" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("TransferIntentsRepository", () => {
  it("findByIdempotencyKey finds the matching intent", async () => {
    const repo = new TransferIntentsRepository();
    await repo.insertOne({ ...baseIntent, idempotencyKey: "idem-1" });
    const found = await repo.findByIdempotencyKey("idem-1");
    expect(found?.userId).toBe("user-1");
  });

  it("findRecentForUser respects the limit", async () => {
    const repo = new TransferIntentsRepository();
    await repo.insertOne({ ...baseIntent, idempotencyKey: "idem-1" });
    await repo.insertOne({ ...baseIntent, idempotencyKey: "idem-2" });
    const found = await repo.findRecentForUser("user-1", 1);
    expect(found).toHaveLength(1);
  });
});
