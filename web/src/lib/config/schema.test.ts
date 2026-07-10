import { describe, it, expect } from "vitest";
import { chainCapabilitySchema, chainDefinitionSchema } from "./schema";

const fullCaps = {
  smartWallet: true,
  accountAbstraction: true,
  paymaster: true,
  vault: false,
  portfolio: true,
  bridge: true,
  swap: false,
  nft: false,
  gasSponsorship: true,
};

const evmBase = {
  key: "example-test",
  name: "Example",
  family: "evm",
  environment: "test",
  caip2: "eip155:1",
  rpc: [{ url: "https://rpc.example.io", weight: 1 }],
  explorer: {
    base: "https://explorer.example.io",
    tx: "https://explorer.example.io/tx/{hash}",
    address: "https://explorer.example.io/address/{addr}",
  },
  nativeCurrency: { symbol: "ETH", name: "Ether", decimals: 18 },
  tokens: [],
  providers: { wallet: "magic", account: "zerodev", execution: ["evm-rpc"], portfolio: ["rpc"] },
  capabilities: fullCaps,
  featureFlags: {},
  defaultWalletEligible: true,
  vaultCompatible: false,
};

describe("chainCapabilitySchema", () => {
  it("rejects an incomplete capability object", () => {
    expect(chainCapabilitySchema.safeParse({ smartWallet: true }).success).toBe(false);
  });
  it("accepts a full capability object", () => {
    expect(chainCapabilitySchema.safeParse(fullCaps).success).toBe(true);
  });
});

describe("chainDefinitionSchema", () => {
  it("accepts a valid evm definition with chainId", () => {
    expect(chainDefinitionSchema.safeParse({ ...evmBase, chainId: 1 }).success).toBe(true);
  });
  it("rejects an evm definition missing chainId", () => {
    expect(chainDefinitionSchema.safeParse(evmBase).success).toBe(false);
  });
  it("accepts a bitcoin definition without chainId", () => {
    const btc = {
      ...evmBase,
      key: "bitcoin-test",
      family: "bitcoin",
      caip2: "bip122:000000000933ea01ad0ee984209779ba",
      nativeCurrency: { symbol: "BTC", name: "Bitcoin", decimals: 8 },
      providers: { wallet: "magic", account: "eoa", execution: ["bitcoin-rpc"], portfolio: ["rpc"] },
    };
    expect(chainDefinitionSchema.safeParse(btc).success).toBe(true);
  });
});
