import { describe, it, expect } from "vitest";
import { WalletsRepository } from "./wallets-repository";

const baseWallet = {
  userId: "user-1",
  family: "evm" as const,
  address: "0xABC",
  provider: "magic" as const,
  providerRef: "0xABC",
  walletType: "eoa" as const,
  delegations: [],
  status: "active" as const,
  createdAt: new Date().toISOString(),
};

describe("WalletsRepository", () => {
  it("findByUserAndFamily finds the right wallet", async () => {
    const repo = new WalletsRepository();
    await repo.insertOne(baseWallet);
    await repo.insertOne({ ...baseWallet, family: "solana", address: "SoLAddr" });

    const evmWallet = await repo.findByUserAndFamily("user-1", "evm");
    expect(evmWallet?.address).toBe("0xABC");
  });

  it("findAllForUser returns every family for that user", async () => {
    const repo = new WalletsRepository();
    await repo.insertOne(baseWallet);
    await repo.insertOne({ ...baseWallet, family: "solana", address: "SoLAddr" });
    await repo.insertOne({ ...baseWallet, userId: "user-2", address: "0xOTHER" });

    const wallets = await repo.findAllForUser("user-1");
    expect(wallets).toHaveLength(2);
  });
});
