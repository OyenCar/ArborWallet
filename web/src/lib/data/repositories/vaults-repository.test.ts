import { describe, it, expect } from "vitest";
import { VaultsRepository } from "./vaults-repository";

describe("VaultsRepository", () => {
  it("findByChainKey returns vaults on that chain only", async () => {
    const repo = new VaultsRepository();
    await repo.insertOne({
      label: "Corp Vault",
      contractAddress: "0xVAULT1",
      chainKey: "arbitrum-sepolia",
      ownerUserId: "owner-1",
      createdAt: new Date().toISOString(),
    });
    await repo.insertOne({
      label: "Other",
      contractAddress: "0xVAULT2",
      chainKey: "arbitrum-one",
      ownerUserId: "owner-1",
      createdAt: new Date().toISOString(),
    });

    const found = await repo.findByChainKey("arbitrum-sepolia");
    expect(found).toHaveLength(1);
    expect(found[0].label).toBe("Corp Vault");
  });
});
