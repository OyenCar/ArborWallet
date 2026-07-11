import { describe, it, expect } from "vitest";
import { VaultMembershipsRepository } from "./vault-memberships-repository";

const baseMembership = {
  vaultId: "vault-1",
  partitionOnChainId: 0,
  role: "member" as const,
  limits: { limitWei: "1000", spentWeiCached: "0", cachedAt: new Date().toISOString() },
  onChain: { projectedAddress: "0xABC", syncState: "pending" as const },
  status: "active" as const,
  createdAt: new Date().toISOString(),
};

describe("VaultMembershipsRepository", () => {
  it("findByVaultAndUser finds the right membership", async () => {
    const repo = new VaultMembershipsRepository();
    await repo.insertOne({ ...baseMembership, userId: "user-1" });
    await repo.insertOne({ ...baseMembership, userId: "user-2" });

    const found = await repo.findByVaultAndUser("vault-1", "user-1");
    expect(found?.userId).toBe("user-1");
  });

  it("findActiveByVault excludes revoked memberships", async () => {
    const repo = new VaultMembershipsRepository();
    await repo.insertOne({ ...baseMembership, userId: "user-1", status: "active" });
    await repo.insertOne({ ...baseMembership, userId: "user-2", status: "revoked" });

    const found = await repo.findActiveByVault("vault-1");
    expect(found).toHaveLength(1);
    expect(found[0].userId).toBe("user-1");
  });

  it("findByDriftState returns only memberships whose onChain.syncState is drift", async () => {
    const repo = new VaultMembershipsRepository();
    await repo.insertOne({ ...baseMembership, userId: "user-1", onChain: { ...baseMembership.onChain, syncState: "synced" } });
    await repo.insertOne({ ...baseMembership, userId: "user-2", onChain: { ...baseMembership.onChain, syncState: "drift" } });

    const found = await repo.findByDriftState();
    expect(found).toHaveLength(1);
    expect(found[0].userId).toBe("user-2");
  });
});
