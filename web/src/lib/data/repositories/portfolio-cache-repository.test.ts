import { describe, it, expect } from "vitest";
import { PortfolioCacheRepository } from "./portfolio-cache-repository";

describe("PortfolioCacheRepository", () => {
  it("upsertForWalletAndChain creates a new entry when none exists", async () => {
    const repo = new PortfolioCacheRepository();
    await repo.upsertForWalletAndChain("wallet-1", "arbitrum-sepolia", {
      userId: "user-1",
      assets: [],
      syncedAt: new Date().toISOString(),
      syncStatus: "fresh",
      source: "rpc",
    });

    const found = await repo.findByWalletAndChain("wallet-1", "arbitrum-sepolia");
    expect(found?.syncStatus).toBe("fresh");
  });

  it("upsertForWalletAndChain replaces the existing entry rather than duplicating", async () => {
    const repo = new PortfolioCacheRepository();
    await repo.upsertForWalletAndChain("wallet-1", "arbitrum-sepolia", {
      userId: "user-1",
      assets: [],
      syncedAt: new Date().toISOString(),
      syncStatus: "fresh",
      source: "rpc",
    });
    await repo.upsertForWalletAndChain("wallet-1", "arbitrum-sepolia", {
      userId: "user-1",
      assets: [],
      syncedAt: new Date().toISOString(),
      syncStatus: "stale",
      source: "rpc",
    });

    const all = await repo.find({ walletId: "wallet-1" });
    expect(all).toHaveLength(1);
    expect(all[0].syncStatus).toBe("stale");
  });
});
