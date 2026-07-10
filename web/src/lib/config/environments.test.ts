import { describe, it, expect } from "vitest";
import {
  environmentProfiles,
  assertProfileIsolation,
  resolveProfileChains,
} from "./environments";

describe("environmentProfiles", () => {
  it("defines all five profiles", () => {
    expect(Object.keys(environmentProfiles).sort()).toEqual(
      ["development", "local", "mainnet", "staging", "testnet"].sort(),
    );
  });
  it("mainnet activates five main-class chains", () => {
    const chains = resolveProfileChains(environmentProfiles.mainnet);
    expect(chains).toHaveLength(5);
    expect(chains.every((c) => c.environment === "main")).toBe(true);
  });
  it("testnet activates five test-class chains", () => {
    const chains = resolveProfileChains(environmentProfiles.testnet);
    expect(chains).toHaveLength(5);
    expect(chains.every((c) => c.environment === "test")).toBe(true);
  });
});

describe("assertProfileIsolation", () => {
  it("passes for every built-in profile", () => {
    for (const p of Object.values(environmentProfiles)) {
      expect(() => assertProfileIsolation(p)).not.toThrow();
    }
  });
  it("throws when a main profile activates a test chain", () => {
    const bad = { ...environmentProfiles.mainnet, activeChainKeys: ["ethereum-sepolia"] };
    expect(() => assertProfileIsolation(bad)).toThrow(/isolation/i);
  });
  it("throws when a profile references an unknown chain key", () => {
    const bad = { ...environmentProfiles.testnet, activeChainKeys: ["nope-testnet"] };
    expect(() => assertProfileIsolation(bad)).toThrow(/unknown chain/i);
  });
});
