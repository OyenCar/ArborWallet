import { describe, it, expect, afterEach } from "vitest";
import {
  getActiveProfile,
  activeChains,
  getChain,
  getChainCapability,
  hasCapability,
  resolveProvider,
  validateRegistry,
} from "./registry";

const original = process.env.APP_ENV_PROFILE;
afterEach(() => {
  // Node coerces `process.env.X = undefined` to the string "undefined" rather
  // than clearing the key, so an originally-unset var must be deleted, not
  // reassigned, to be restored correctly.
  if (original === undefined) {
    delete process.env.APP_ENV_PROFILE;
  } else {
    process.env.APP_ENV_PROFILE = original;
  }
});

describe("getActiveProfile", () => {
  it("defaults to testnet when APP_ENV_PROFILE is unset", () => {
    delete process.env.APP_ENV_PROFILE;
    expect(getActiveProfile().name).toBe("testnet");
  });
  it("honors APP_ENV_PROFILE", () => {
    process.env.APP_ENV_PROFILE = "mainnet";
    expect(getActiveProfile().name).toBe("mainnet");
  });
  it("throws on an unknown profile name", () => {
    process.env.APP_ENV_PROFILE = "moon";
    expect(() => getActiveProfile()).toThrow(/unknown environment profile/i);
  });
});

describe("activeChains", () => {
  it("returns only the active profile's chains", () => {
    process.env.APP_ENV_PROFILE = "testnet";
    const keys = activeChains().map((c) => c.key);
    expect(keys).toContain("arbitrum-sepolia");
    expect(keys).not.toContain("arbitrum-one");
  });
});

describe("capability queries", () => {
  it("reports vault capability for arbitrum-sepolia", () => {
    expect(hasCapability("arbitrum-sepolia", "vault")).toBe(true);
    expect(getChainCapability("arbitrum-sepolia").smartWallet).toBe(true);
  });
  it("reports no smart wallet for bitcoin", () => {
    expect(hasCapability("bitcoin-mainnet", "smartWallet")).toBe(false);
  });
});

describe("resolveProvider", () => {
  it("resolves the wallet provider for an evm chain", () => {
    expect(resolveProvider("arbitrum-sepolia", "wallet").key).toBe("magic");
  });
  it("skips particle on testnet execution and falls back to evm-rpc", () => {
    process.env.APP_ENV_PROFILE = "testnet";
    // particle.environments = ["main"], so on a test profile it is skipped
    expect(resolveProvider("arbitrum-sepolia", "execution").key).toBe("evm-rpc");
  });
  it("resolves particle first for execution on mainnet", () => {
    process.env.APP_ENV_PROFILE = "mainnet";
    expect(resolveProvider("arbitrum-one", "execution").key).toBe("particle");
  });
});

describe("validateRegistry", () => {
  it("does not throw for built-in config", () => {
    expect(() => validateRegistry()).not.toThrow();
  });
});

describe("getChain", () => {
  it("throws on unknown key", () => {
    expect(() => getChain("nope-mainnet")).toThrow();
  });
});
