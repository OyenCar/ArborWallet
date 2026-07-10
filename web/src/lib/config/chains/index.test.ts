import { describe, it, expect } from "vitest";
import { chainDefinitions, chainMap, getChainDefinition } from "./index";
import { chainDefinitionSchema } from "../schema";

describe("chainDefinitions", () => {
  it("every chain passes schema validation", () => {
    for (const c of chainDefinitions) {
      const r = chainDefinitionSchema.safeParse(c);
      expect(r.success, `${c.key}: ${r.success ? "" : r.error?.message}`).toBe(true);
    }
  });
  it("has unique keys", () => {
    const keys = chainDefinitions.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("registers all ten launch chains", () => {
    expect(chainMap.size).toBe(10);
  });
});

describe("arbitrum-sepolia", () => {
  it("keeps the canonical RPC url and is vault-compatible", () => {
    const arb = getChainDefinition("arbitrum-sepolia");
    expect(arb.rpc[0].url).toBe("https://sepolia-rollup.arbitrum.io/rpc");
    expect(arb.chainId).toBe(421614);
    expect(arb.vaultCompatible).toBe(true);
    expect(arb.capabilities.vault).toBe(true);
  });
});

describe("non-evm chains", () => {
  it("bitcoin has no chainId and no smart wallet", () => {
    const btc = getChainDefinition("bitcoin-mainnet");
    expect(btc.chainId).toBeUndefined();
    expect(btc.capabilities.smartWallet).toBe(false);
    expect(btc.capabilities.bridge).toBe(false);
  });
  it("solana uses the eoa account provider", () => {
    const sol = getChainDefinition("solana-devnet");
    expect(sol.providers.account).toBe("eoa");
    expect(sol.capabilities.accountAbstraction).toBe(false);
  });
});

describe("getChainDefinition", () => {
  it("throws on an unknown key", () => {
    expect(() => getChainDefinition("dogecoin-mainnet")).toThrow();
  });
});
