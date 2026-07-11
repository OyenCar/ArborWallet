import { describe, it, expect } from "vitest";
import { RegistryOverridesRepository } from "./registry-overrides-repository";

describe("RegistryOverridesRepository", () => {
  it("findActiveByScope excludes expired overrides", async () => {
    const repo = new RegistryOverridesRepository();
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 1_000_000).toISOString();

    await repo.insertOne({ scope: "chain", key: "arbitrum-sepolia", patch: { featureFlags: { x: true } }, reason: "test", actor: "ops", createdAt: new Date().toISOString(), expiresAt: past });
    await repo.insertOne({ scope: "chain", key: "arbitrum-sepolia", patch: { featureFlags: { y: true } }, reason: "test", actor: "ops", createdAt: new Date().toISOString(), expiresAt: future });
    await repo.insertOne({ scope: "chain", key: "arbitrum-sepolia", patch: { featureFlags: { z: true } }, reason: "test", actor: "ops", createdAt: new Date().toISOString() });

    const active = await repo.findActiveByScope("chain", "arbitrum-sepolia");
    expect(active).toHaveLength(2);
  });
});
