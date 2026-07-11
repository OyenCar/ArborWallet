# Wallet Config Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the configuration foundation — ChainRegistry, ProviderRegistry, and EnvironmentProfile — as pure, zod-validated data with a typed accessor facade, so all later wallet work consumes chain/provider/env config from one source of truth.

**Architecture:** A `web/src/lib/config/` module holding zod schemas (single source of types via `z.infer`), per-chain definition files grouped by family, a provider catalog, environment profiles, and a `registry.ts` facade exposing `getChain`, `activeChains`, `hasCapability`, and `resolveProvider`. Everything is data + pure functions — no provider SDKs, no network calls, no chain interaction. This is Plan 1 of the §21 migration sequence in `Planning.md`.

**Tech Stack:** TypeScript, zod (validation + inferred types), vitest (unit tests). Next.js 16 app lives in `web/`.

## Global Constraints

- All source under `web/src/lib/config/`; all paths in this plan are relative to repo root; **run every command from `web/`**.
- No business logic may check chain names/IDs as literals — services branch only on `ChainCapability`. This plan builds the config that enforces that; the config module itself is the *only* place chain keys are named.
- `ChainKey` format: `"<chain>-<network>"` (e.g. `arbitrum-sepolia`). EVM chains MUST define `chainId`; Solana/Bitcoin use `caip2` only.
- Environment isolation is a hard invariant: a profile may only activate chains whose `environment` equals the profile's `networkClass`. Violations must throw at load time.
- Arbitrum Sepolia RPC MUST stay `https://sepolia-rollup.arbitrum.io/rpc` (matches existing `web/src/lib/format.ts` and AGENTS.md).
- Active environment selected by `process.env.APP_ENV_PROFILE`, defaulting to `testnet`.
- zod pinned `^3.23.0`; use two-arg `z.record(keySchema, valueSchema)`.
- Config files use **relative imports** internally (tests import relative too — no `@/` alias needed in vitest).

---

## File Structure

```
web/
├── vitest.config.ts                      # NEW — vitest node env, src/**/*.test.ts
├── package.json                          # MODIFY — add zod dep, vitest dev dep, test scripts
└── src/lib/config/
    ├── schema.ts                         # NEW — zod schemas + z.infer type exports (source of truth)
    ├── providers.ts                      # NEW — ProviderRegistry data + accessors
    ├── environments.ts                   # NEW — EnvironmentProfiles + isolation guard
    ├── chains/
    │   ├── ethereum.ts                   # NEW — ethereum-mainnet, ethereum-sepolia
    │   ├── arbitrum.ts                   # NEW — arbitrum-one, arbitrum-sepolia
    │   ├── bnb.ts                        # NEW — bnb-mainnet, bnb-testnet
    │   ├── solana.ts                     # NEW — solana-mainnet, solana-devnet
    │   ├── bitcoin.ts                    # NEW — bitcoin-mainnet, bitcoin-testnet
    │   └── index.ts                      # NEW — aggregate + validate + unique-key map
    └── registry.ts                       # NEW — facade: active profile, getChain, capabilities, resolveProvider
```

Tests live beside sources as `*.test.ts` (`schema.test.ts`, `providers.test.ts`, `chains/index.test.ts`, `environments.test.ts`, `registry.test.ts`).

---

## Task 1: Test tooling + config schemas & types

**Files:**
- Modify: `web/package.json` (add deps + scripts)
- Create: `web/vitest.config.ts`
- Create: `web/src/lib/config/schema.ts`
- Test: `web/src/lib/config/schema.test.ts`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: zod schemas `chainCapabilitySchema`, `tokenDefinitionSchema`, `rpcEndpointSchema`, `providerKeySchema`, `chainProvidersSchema`, `chainDefinitionSchema`, `providerDefinitionSchema`, `environmentProfileSchema`, `chainFamilySchema`, `networkClassSchema`; inferred types `ChainCapability`, `TokenDefinition`, `RpcEndpoint`, `ProviderKey`, `ChainProviders`, `ChainDefinition`, `ProviderDefinition`, `EnvironmentProfile`, `ChainFamily`, `NetworkClass`, `ProviderRole`, and `type ChainKey = string`.

- [ ] **Step 1: Install tooling**

Run (from `web/`):
```bash
npm install zod@^3.23.0
npm install -D vitest@^2.1.0
```
Expected: both added to `package.json`; `node_modules/.bin/vitest` exists.

- [ ] **Step 2: Add test scripts to `web/package.json`**

In the `"scripts"` object, add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```
(Keep existing `dev`/`build`/`start`/`lint`.)

- [ ] **Step 3: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write the failing test — `web/src/lib/config/schema.test.ts`**

```ts
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
```

- [ ] **Step 5: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/config/schema.test.ts`
Expected: FAIL — cannot resolve `./schema` (module not found).

- [ ] **Step 6: Implement `web/src/lib/config/schema.ts`**

```ts
import { z } from "zod";

export const chainFamilySchema = z.enum(["evm", "solana", "bitcoin"]);
export const networkClassSchema = z.enum(["main", "test", "local"]);

export const chainCapabilitySchema = z.object({
  smartWallet: z.boolean(),
  accountAbstraction: z.boolean(),
  paymaster: z.boolean(),
  vault: z.boolean(),
  portfolio: z.boolean(),
  bridge: z.boolean(),
  swap: z.boolean(),
  nft: z.boolean(),
  gasSponsorship: z.boolean(),
});

export const tokenDefinitionSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  decimals: z.number().int().nonnegative(),
  address: z.string().optional(), // undefined = native
  kind: z.enum(["native", "erc20", "spl"]),
});

export const rpcEndpointSchema = z.object({
  url: z.string().url(),
  weight: z.number().int().positive(),
});

export const providerKeySchema = z.enum([
  "magic", "privy", "dynamic",
  "zerodev", "eoa",
  "particle", "evm-rpc", "solana-rpc", "bitcoin-rpc",
  "indexer", "rpc",
]);

export const providerRoleSchema = z.enum(["wallet", "account", "execution", "portfolio"]);

export const chainProvidersSchema = z.object({
  wallet: providerKeySchema,
  account: providerKeySchema,
  execution: z.array(providerKeySchema).min(1),
  portfolio: z.array(providerKeySchema).min(1),
});

export const chainDefinitionSchema = z
  .object({
    key: z.string().min(1),
    name: z.string().min(1),
    family: chainFamilySchema,
    environment: networkClassSchema,
    caip2: z.string().min(1),
    chainId: z.number().int().positive().optional(),
    rpc: z.array(rpcEndpointSchema).min(1),
    explorer: z.object({
      base: z.string().url(),
      tx: z.string().min(1),
      address: z.string().min(1),
    }),
    nativeCurrency: z.object({
      symbol: z.string().min(1),
      name: z.string().min(1),
      decimals: z.number().int().nonnegative(),
    }),
    tokens: z.array(tokenDefinitionSchema),
    providers: chainProvidersSchema,
    capabilities: chainCapabilitySchema,
    faucet: z.object({ url: z.string().url(), note: z.string().optional() }).optional(),
    featureFlags: z.record(z.string(), z.boolean()),
    defaultWalletEligible: z.boolean(),
    vaultCompatible: z.boolean(),
  })
  .refine((d) => d.family !== "evm" || d.chainId !== undefined, {
    message: "EVM chains must define chainId",
    path: ["chainId"],
  });

export const providerDefinitionSchema = z.object({
  key: providerKeySchema,
  role: providerRoleSchema,
  families: z.array(chainFamilySchema),
  environments: z.array(networkClassSchema),
  adapter: z.string().min(1),
  config: z.record(z.string(), z.string()),
  status: z.enum(["active", "degraded", "disabled"]),
});

export const environmentProfileSchema = z.object({
  name: z.enum(["local", "development", "staging", "testnet", "mainnet"]),
  networkClass: networkClassSchema,
  activeChainKeys: z.array(z.string().min(1)).min(1),
  featureFlags: z.record(z.string(), z.boolean()),
  faucetsEnabled: z.boolean(),
  paymasterTier: z.enum(["none", "capped", "full"]),
  bannerStyle: z.enum(["none", "testnet", "local"]),
});

export type ChainFamily = z.infer<typeof chainFamilySchema>;
export type NetworkClass = z.infer<typeof networkClassSchema>;
export type ChainCapability = z.infer<typeof chainCapabilitySchema>;
export type TokenDefinition = z.infer<typeof tokenDefinitionSchema>;
export type RpcEndpoint = z.infer<typeof rpcEndpointSchema>;
export type ProviderKey = z.infer<typeof providerKeySchema>;
export type ProviderRole = z.infer<typeof providerRoleSchema>;
export type ChainProviders = z.infer<typeof chainProvidersSchema>;
export type ChainDefinition = z.infer<typeof chainDefinitionSchema>;
export type ProviderDefinition = z.infer<typeof providerDefinitionSchema>;
export type EnvironmentProfile = z.infer<typeof environmentProfileSchema>;
export type ChainKey = string;
```

- [ ] **Step 7: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/config/schema.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/src/lib/config/schema.ts web/src/lib/config/schema.test.ts
git commit -m "feat(config): add zod config schemas and inferred types"
```

---

## Task 2: ProviderRegistry

**Files:**
- Create: `web/src/lib/config/providers.ts`
- Test: `web/src/lib/config/providers.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `providerDefinitionSchema`, types `ProviderDefinition`, `ProviderKey`, `ProviderRole`.
- Produces: `providerDefinitions: ProviderDefinition[]` (validated at module load), `getProvider(key: ProviderKey): ProviderDefinition` (throws on unknown), `getProvidersByRole(role: ProviderRole): ProviderDefinition[]`.

- [ ] **Step 1: Write the failing test — `web/src/lib/config/providers.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { providerDefinitions, getProvider, getProvidersByRole } from "./providers";
import { providerDefinitionSchema } from "./schema";

describe("providerDefinitions", () => {
  it("every provider passes schema validation", () => {
    for (const p of providerDefinitions) {
      expect(providerDefinitionSchema.safeParse(p).success).toBe(true);
    }
  });
  it("has unique keys", () => {
    const keys = providerDefinitions.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("includes magic as a wallet provider for all families", () => {
    const magic = getProvider("magic");
    expect(magic.role).toBe("wallet");
    expect(magic.families).toEqual(expect.arrayContaining(["evm", "solana", "bitcoin"]));
  });
});

describe("getProvider", () => {
  it("throws on an unknown key", () => {
    // @ts-expect-error deliberately invalid key
    expect(() => getProvider("nope")).toThrow();
  });
});

describe("getProvidersByRole", () => {
  it("returns only execution providers for the execution role", () => {
    const exec = getProvidersByRole("execution");
    expect(exec.length).toBeGreaterThan(0);
    expect(exec.every((p) => p.role === "execution")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/config/providers.test.ts`
Expected: FAIL — cannot resolve `./providers`.

- [ ] **Step 3: Implement `web/src/lib/config/providers.ts`**

```ts
import { ProviderDefinition, ProviderKey, ProviderRole, providerDefinitionSchema } from "./schema";

const raw: ProviderDefinition[] = [
  {
    key: "magic",
    role: "wallet",
    families: ["evm", "solana", "bitcoin"],
    environments: ["main", "test", "local"],
    adapter: "MagicWalletAdapter",
    config: { secretKey: "MAGIC_SECRET_KEY", oidcProviderId: "OIDC_PROVIDER_ID" },
    status: "active",
  },
  {
    key: "zerodev",
    role: "account",
    families: ["evm"],
    environments: ["main", "test"],
    adapter: "ZeroDev7702Adapter",
    config: { projectId: "ZERODEV_PROJECT_ID" },
    status: "active",
  },
  {
    key: "eoa",
    role: "account",
    families: ["evm", "solana", "bitcoin"],
    environments: ["main", "test", "local"],
    adapter: "EoaPassthroughAdapter",
    config: {},
    status: "active",
  },
  {
    key: "particle",
    role: "execution",
    families: ["evm"],
    environments: ["main"],
    adapter: "ParticleExecutionAdapter",
    config: { projectId: "PARTICLE_PROJECT_ID" },
    status: "active",
  },
  {
    key: "evm-rpc",
    role: "execution",
    families: ["evm"],
    environments: ["main", "test", "local"],
    adapter: "EvmRpcExecutionAdapter",
    config: {},
    status: "active",
  },
  {
    key: "solana-rpc",
    role: "execution",
    families: ["solana"],
    environments: ["main", "test", "local"],
    adapter: "SolanaExecutionAdapter",
    config: {},
    status: "active",
  },
  {
    key: "bitcoin-rpc",
    role: "execution",
    families: ["bitcoin"],
    environments: ["main", "test", "local"],
    adapter: "BitcoinExecutionAdapter",
    config: {},
    status: "active",
  },
  {
    key: "indexer",
    role: "portfolio",
    families: ["evm", "solana"],
    environments: ["main", "test"],
    adapter: "IndexerPortfolioAdapter",
    config: { apiKey: "INDEXER_API_KEY" },
    status: "active",
  },
  {
    key: "rpc",
    role: "portfolio",
    families: ["evm", "solana", "bitcoin"],
    environments: ["main", "test", "local"],
    adapter: "RpcPortfolioAdapter",
    config: {},
    status: "active",
  },
];

export const providerDefinitions: ProviderDefinition[] = raw.map((p, i) => {
  const parsed = providerDefinitionSchema.safeParse(p);
  if (!parsed.success) {
    throw new Error(`Invalid ProviderDefinition at index ${i} (${p.key}): ${parsed.error.message}`);
  }
  return parsed.data;
});

const byKey = new Map<ProviderKey, ProviderDefinition>(providerDefinitions.map((p) => [p.key, p]));

export function getProvider(key: ProviderKey): ProviderDefinition {
  const p = byKey.get(key);
  if (!p) throw new Error(`Unknown provider key: ${key}`);
  return p;
}

export function getProvidersByRole(role: ProviderRole): ProviderDefinition[] {
  return providerDefinitions.filter((p) => p.role === role);
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/config/providers.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/config/providers.ts web/src/lib/config/providers.test.ts
git commit -m "feat(config): add ProviderRegistry with role/key accessors"
```

---

## Task 3: ChainRegistry — chain definitions + validated map

**Files:**
- Create: `web/src/lib/config/chains/ethereum.ts`, `arbitrum.ts`, `bnb.ts`, `solana.ts`, `bitcoin.ts`, `index.ts`
- Test: `web/src/lib/config/chains/index.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `ChainDefinition`, `chainDefinitionSchema`, `ChainKey`.
- Produces: per-family arrays (`ethereumChains`, `arbitrumChains`, `bnbChains`, `solanaChains`, `bitcoinChains`); `chainDefinitions: ChainDefinition[]`; `chainMap: Map<ChainKey, ChainDefinition>` (validated + unique-key asserted at load); `getChainDefinition(key: ChainKey): ChainDefinition` (throws on unknown).

- [ ] **Step 1: Write the failing test — `web/src/lib/config/chains/index.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/config/chains/index.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Implement `web/src/lib/config/chains/ethereum.ts`**

```ts
import { ChainDefinition } from "../schema";

const evmCaps = {
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

const evmProviders = {
  wallet: "magic" as const,
  account: "zerodev" as const,
  execution: ["particle", "evm-rpc"] as const,
  portfolio: ["indexer", "rpc"] as const,
};

export const ethereumChains: ChainDefinition[] = [
  {
    key: "ethereum-mainnet",
    name: "Ethereum",
    family: "evm",
    environment: "main",
    caip2: "eip155:1",
    chainId: 1,
    rpc: [{ url: "https://ethereum-rpc.publicnode.com", weight: 1 }],
    explorer: {
      base: "https://etherscan.io",
      tx: "https://etherscan.io/tx/{hash}",
      address: "https://etherscan.io/address/{addr}",
    },
    nativeCurrency: { symbol: "ETH", name: "Ether", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
  {
    key: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    family: "evm",
    environment: "test",
    caip2: "eip155:11155111",
    chainId: 11155111,
    rpc: [{ url: "https://ethereum-sepolia-rpc.publicnode.com", weight: 1 }],
    explorer: {
      base: "https://sepolia.etherscan.io",
      tx: "https://sepolia.etherscan.io/tx/{hash}",
      address: "https://sepolia.etherscan.io/address/{addr}",
    },
    nativeCurrency: { symbol: "ETH", name: "Sepolia Ether", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    faucet: { url: "https://www.alchemy.com/faucets/ethereum-sepolia" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
];
```

- [ ] **Step 4: Implement `web/src/lib/config/chains/arbitrum.ts`**

```ts
import { ChainDefinition } from "../schema";

const evmCaps = {
  smartWallet: true,
  accountAbstraction: true,
  paymaster: true,
  vault: true, // Vault.sol deploys on Arbitrum
  portfolio: true,
  bridge: true,
  swap: false,
  nft: false,
  gasSponsorship: true,
};

const evmProviders = {
  wallet: "magic" as const,
  account: "zerodev" as const,
  execution: ["particle", "evm-rpc"] as const,
  portfolio: ["indexer", "rpc"] as const,
};

export const arbitrumChains: ChainDefinition[] = [
  {
    key: "arbitrum-one",
    name: "Arbitrum One",
    family: "evm",
    environment: "main",
    caip2: "eip155:42161",
    chainId: 42161,
    rpc: [{ url: "https://arb1.arbitrum.io/rpc", weight: 1 }],
    explorer: {
      base: "https://arbiscan.io",
      tx: "https://arbiscan.io/tx/{hash}",
      address: "https://arbiscan.io/address/{addr}",
    },
    nativeCurrency: { symbol: "ETH", name: "Ether", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: true,
  },
  {
    key: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    family: "evm",
    environment: "test",
    caip2: "eip155:421614",
    chainId: 421614,
    rpc: [{ url: "https://sepolia-rollup.arbitrum.io/rpc", weight: 1 }],
    explorer: {
      base: "https://sepolia.arbiscan.io",
      tx: "https://sepolia.arbiscan.io/tx/{hash}",
      address: "https://sepolia.arbiscan.io/address/{addr}",
    },
    nativeCurrency: { symbol: "ETH", name: "Sepolia Ether", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    faucet: { url: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: true,
  },
];
```

- [ ] **Step 5: Implement `web/src/lib/config/chains/bnb.ts`**

```ts
import { ChainDefinition } from "../schema";

const evmCaps = {
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

const evmProviders = {
  wallet: "magic" as const,
  account: "zerodev" as const,
  execution: ["particle", "evm-rpc"] as const,
  portfolio: ["indexer", "rpc"] as const,
};

export const bnbChains: ChainDefinition[] = [
  {
    key: "bnb-mainnet",
    name: "BNB Chain",
    family: "evm",
    environment: "main",
    caip2: "eip155:56",
    chainId: 56,
    rpc: [{ url: "https://bsc-dataseed.binance.org", weight: 1 }],
    explorer: {
      base: "https://bscscan.com",
      tx: "https://bscscan.com/tx/{hash}",
      address: "https://bscscan.com/address/{addr}",
    },
    nativeCurrency: { symbol: "BNB", name: "BNB", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
  {
    key: "bnb-testnet",
    name: "BNB Testnet",
    family: "evm",
    environment: "test",
    caip2: "eip155:97",
    chainId: 97,
    rpc: [{ url: "https://data-seed-prebsc-1-s1.binance.org:8545", weight: 1 }],
    explorer: {
      base: "https://testnet.bscscan.com",
      tx: "https://testnet.bscscan.com/tx/{hash}",
      address: "https://testnet.bscscan.com/address/{addr}",
    },
    nativeCurrency: { symbol: "tBNB", name: "Test BNB", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    faucet: { url: "https://testnet.bnbchain.org/faucet-smart" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
];
```

- [ ] **Step 6: Implement `web/src/lib/config/chains/solana.ts`**

```ts
import { ChainDefinition } from "../schema";

const solCaps = {
  smartWallet: false,
  accountAbstraction: false,
  paymaster: false,
  vault: false,
  portfolio: true,
  bridge: false,
  swap: false,
  nft: false,
  gasSponsorship: false,
};

const solProviders = {
  wallet: "magic" as const,
  account: "eoa" as const,
  execution: ["solana-rpc"] as const,
  portfolio: ["indexer", "rpc"] as const,
};

export const solanaChains: ChainDefinition[] = [
  {
    key: "solana-mainnet",
    name: "Solana",
    family: "solana",
    environment: "main",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    rpc: [{ url: "https://api.mainnet-beta.solana.com", weight: 1 }],
    explorer: {
      base: "https://explorer.solana.com",
      tx: "https://explorer.solana.com/tx/{hash}",
      address: "https://explorer.solana.com/address/{addr}",
    },
    nativeCurrency: { symbol: "SOL", name: "Solana", decimals: 9 },
    tokens: [],
    providers: { ...solProviders, execution: [...solProviders.execution], portfolio: [...solProviders.portfolio] },
    capabilities: { ...solCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
  {
    key: "solana-devnet",
    name: "Solana Devnet",
    family: "solana",
    environment: "test",
    caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    rpc: [{ url: "https://api.devnet.solana.com", weight: 1 }],
    explorer: {
      base: "https://explorer.solana.com",
      tx: "https://explorer.solana.com/tx/{hash}?cluster=devnet",
      address: "https://explorer.solana.com/address/{addr}?cluster=devnet",
    },
    nativeCurrency: { symbol: "SOL", name: "Devnet SOL", decimals: 9 },
    tokens: [],
    providers: { ...solProviders, execution: [...solProviders.execution], portfolio: [...solProviders.portfolio] },
    capabilities: { ...solCaps },
    faucet: { url: "https://faucet.solana.com" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
];
```

- [ ] **Step 7: Implement `web/src/lib/config/chains/bitcoin.ts`**

```ts
import { ChainDefinition } from "../schema";

const btcCaps = {
  smartWallet: false,
  accountAbstraction: false,
  paymaster: false,
  vault: false,
  portfolio: true,
  bridge: false, // receive + balance only at launch (Planning.md §22.7)
  swap: false,
  nft: false,
  gasSponsorship: false,
};

const btcProviders = {
  wallet: "magic" as const,
  account: "eoa" as const,
  execution: ["bitcoin-rpc"] as const,
  portfolio: ["rpc"] as const,
};

export const bitcoinChains: ChainDefinition[] = [
  {
    key: "bitcoin-mainnet",
    name: "Bitcoin",
    family: "bitcoin",
    environment: "main",
    caip2: "bip122:000000000019d6689c085ae165831e93",
    rpc: [{ url: "https://blockstream.info/api", weight: 1 }],
    explorer: {
      base: "https://blockstream.info",
      tx: "https://blockstream.info/tx/{hash}",
      address: "https://blockstream.info/address/{addr}",
    },
    nativeCurrency: { symbol: "BTC", name: "Bitcoin", decimals: 8 },
    tokens: [],
    providers: { ...btcProviders, execution: [...btcProviders.execution], portfolio: [...btcProviders.portfolio] },
    capabilities: { ...btcCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
  {
    key: "bitcoin-testnet",
    name: "Bitcoin Testnet",
    family: "bitcoin",
    environment: "test",
    caip2: "bip122:000000000933ea01ad0ee984209779ba",
    rpc: [{ url: "https://blockstream.info/testnet/api", weight: 1 }],
    explorer: {
      base: "https://blockstream.info/testnet",
      tx: "https://blockstream.info/testnet/tx/{hash}",
      address: "https://blockstream.info/testnet/address/{addr}",
    },
    nativeCurrency: { symbol: "tBTC", name: "Test Bitcoin", decimals: 8 },
    tokens: [],
    providers: { ...btcProviders, execution: [...btcProviders.execution], portfolio: [...btcProviders.portfolio] },
    capabilities: { ...btcCaps },
    faucet: { url: "https://coinfaucet.eu/en/btc-testnet" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
];
```

- [ ] **Step 8: Implement `web/src/lib/config/chains/index.ts`**

```ts
import { ChainDefinition, ChainKey, chainDefinitionSchema } from "../schema";
import { ethereumChains } from "./ethereum";
import { arbitrumChains } from "./arbitrum";
import { bnbChains } from "./bnb";
import { solanaChains } from "./solana";
import { bitcoinChains } from "./bitcoin";

export const chainDefinitions: ChainDefinition[] = [
  ...ethereumChains,
  ...arbitrumChains,
  ...bnbChains,
  ...solanaChains,
  ...bitcoinChains,
];

export const chainMap: Map<ChainKey, ChainDefinition> = (() => {
  const map = new Map<ChainKey, ChainDefinition>();
  for (const c of chainDefinitions) {
    const parsed = chainDefinitionSchema.safeParse(c);
    if (!parsed.success) {
      throw new Error(`Invalid ChainDefinition "${c.key}": ${parsed.error.message}`);
    }
    if (map.has(c.key)) {
      throw new Error(`Duplicate chain key: ${c.key}`);
    }
    map.set(c.key, parsed.data);
  }
  return map;
})();

export function getChainDefinition(key: ChainKey): ChainDefinition {
  const c = chainMap.get(key);
  if (!c) throw new Error(`Unknown chain key: ${key}`);
  return c;
}
```

- [ ] **Step 9: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/config/chains/index.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/config/chains
git commit -m "feat(config): add ChainRegistry with 10 launch chain definitions"
```

---

## Task 4: EnvironmentProfiles + isolation guard

**Files:**
- Create: `web/src/lib/config/environments.ts`
- Test: `web/src/lib/config/environments.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `EnvironmentProfile`, `environmentProfileSchema`, `NetworkClass`; from Task 3 — `chainMap`, `ChainDefinition`.
- Produces: `environmentProfiles: Record<EnvironmentProfile["name"], EnvironmentProfile>` (validated at load); `assertProfileIsolation(profile: EnvironmentProfile): void` (throws if any active chain's `environment` !== `profile.networkClass` or key missing); `resolveProfileChains(profile: EnvironmentProfile): ChainDefinition[]`.

- [ ] **Step 1: Write the failing test — `web/src/lib/config/environments.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/config/environments.test.ts`
Expected: FAIL — cannot resolve `./environments`.

- [ ] **Step 3: Implement `web/src/lib/config/environments.ts`**

```ts
import { ChainDefinition, EnvironmentProfile, environmentProfileSchema } from "./schema";
import { chainMap } from "./chains";

const testnetChainKeys = [
  "ethereum-sepolia",
  "arbitrum-sepolia",
  "bnb-testnet",
  "solana-devnet",
  "bitcoin-testnet",
];

const mainnetChainKeys = [
  "ethereum-mainnet",
  "arbitrum-one",
  "bnb-mainnet",
  "solana-mainnet",
  "bitcoin-mainnet",
];

const rawProfiles: EnvironmentProfile[] = [
  {
    name: "local",
    networkClass: "test",
    activeChainKeys: [...testnetChainKeys],
    featureFlags: {},
    faucetsEnabled: true,
    paymasterTier: "capped",
    bannerStyle: "local",
  },
  {
    name: "development",
    networkClass: "test",
    activeChainKeys: [...testnetChainKeys],
    featureFlags: {},
    faucetsEnabled: true,
    paymasterTier: "capped",
    bannerStyle: "testnet",
  },
  {
    name: "staging",
    networkClass: "test",
    activeChainKeys: [...testnetChainKeys],
    featureFlags: {},
    faucetsEnabled: true,
    paymasterTier: "capped",
    bannerStyle: "testnet",
  },
  {
    name: "testnet",
    networkClass: "test",
    activeChainKeys: [...testnetChainKeys],
    featureFlags: {},
    faucetsEnabled: true,
    paymasterTier: "capped",
    bannerStyle: "testnet",
  },
  {
    name: "mainnet",
    networkClass: "main",
    activeChainKeys: [...mainnetChainKeys],
    featureFlags: {},
    faucetsEnabled: false,
    paymasterTier: "full",
    bannerStyle: "none",
  },
];

export const environmentProfiles: Record<EnvironmentProfile["name"], EnvironmentProfile> =
  rawProfiles.reduce((acc, p) => {
    const parsed = environmentProfileSchema.safeParse(p);
    if (!parsed.success) {
      throw new Error(`Invalid EnvironmentProfile "${p.name}": ${parsed.error.message}`);
    }
    acc[parsed.data.name] = parsed.data;
    return acc;
  }, {} as Record<EnvironmentProfile["name"], EnvironmentProfile>);

export function assertProfileIsolation(profile: EnvironmentProfile): void {
  for (const key of profile.activeChainKeys) {
    const chain = chainMap.get(key);
    if (!chain) {
      throw new Error(`Profile "${profile.name}" references unknown chain: ${key}`);
    }
    if (chain.environment !== profile.networkClass) {
      throw new Error(
        `Environment isolation violated: profile "${profile.name}" (${profile.networkClass}) ` +
          `activates chain "${key}" (${chain.environment})`,
      );
    }
  }
}

export function resolveProfileChains(profile: EnvironmentProfile): ChainDefinition[] {
  assertProfileIsolation(profile);
  return profile.activeChainKeys.map((k) => chainMap.get(k)!);
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/config/environments.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/config/environments.ts web/src/lib/config/environments.test.ts
git commit -m "feat(config): add EnvironmentProfiles with environment isolation guard"
```

---

## Task 5: Registry facade — active profile, capabilities, provider resolution

**Files:**
- Create: `web/src/lib/config/registry.ts`
- Test: `web/src/lib/config/registry.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `ChainDefinition`, `ChainKey`, `ChainCapability`, `ProviderRole`, `ProviderDefinition`, `EnvironmentProfile`; from Task 2 — `getProvider`; from Task 3 — `getChainDefinition`, `chainMap`; from Task 4 — `environmentProfiles`, `assertProfileIsolation`, `resolveProfileChains`.
- Produces: `getActiveProfile(): EnvironmentProfile`; `activeChains(): ChainDefinition[]`; `getChain(key: ChainKey): ChainDefinition`; `getChainCapability(key: ChainKey): ChainCapability`; `hasCapability(key: ChainKey, cap: keyof ChainCapability): boolean`; `resolveProvider(key: ChainKey, role: ProviderRole): ProviderDefinition`; `validateRegistry(): void`.

Note on `resolveProvider`: `account` and `wallet` are single provider keys on the chain; `execution` and `portfolio` are ordered arrays — resolve to the **first provider whose `status === "active"` and whose `environments` include the active profile's `networkClass`**; throw if none qualifies.

- [ ] **Step 1: Write the failing test — `web/src/lib/config/registry.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
  process.env.APP_ENV_PROFILE = original;
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
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/config/registry.test.ts`
Expected: FAIL — cannot resolve `./registry`.

- [ ] **Step 3: Implement `web/src/lib/config/registry.ts`**

```ts
import {
  ChainCapability,
  ChainDefinition,
  ChainKey,
  EnvironmentProfile,
  ProviderDefinition,
  ProviderKey,
  ProviderRole,
} from "./schema";
import { getProvider } from "./providers";
import { chainMap, getChainDefinition } from "./chains";
import { environmentProfiles, assertProfileIsolation } from "./environments";

const DEFAULT_PROFILE: EnvironmentProfile["name"] = "testnet";

export function getActiveProfile(): EnvironmentProfile {
  const name = (process.env.APP_ENV_PROFILE ?? DEFAULT_PROFILE) as EnvironmentProfile["name"];
  const profile = environmentProfiles[name];
  if (!profile) {
    throw new Error(`Unknown environment profile: ${name}`);
  }
  return profile;
}

export function getChain(key: ChainKey): ChainDefinition {
  return getChainDefinition(key);
}

export function activeChains(): ChainDefinition[] {
  const profile = getActiveProfile();
  assertProfileIsolation(profile);
  return profile.activeChainKeys.map((k) => chainMap.get(k)!);
}

export function getChainCapability(key: ChainKey): ChainCapability {
  return getChain(key).capabilities;
}

export function hasCapability(key: ChainKey, cap: keyof ChainCapability): boolean {
  return getChain(key).capabilities[cap];
}

function pickProvider(candidates: ProviderKey[], networkClass: EnvironmentProfile["networkClass"]): ProviderDefinition {
  for (const key of candidates) {
    const p = getProvider(key);
    if (p.status === "active" && p.environments.includes(networkClass)) {
      return p;
    }
  }
  throw new Error(
    `No active provider among [${candidates.join(", ")}] for network class "${networkClass}"`,
  );
}

export function resolveProvider(key: ChainKey, role: ProviderRole): ProviderDefinition {
  const chain = getChain(key);
  const networkClass = getActiveProfile().networkClass;
  switch (role) {
    case "wallet":
      return pickProvider([chain.providers.wallet], networkClass);
    case "account":
      return pickProvider([chain.providers.account], networkClass);
    case "execution":
      return pickProvider(chain.providers.execution, networkClass);
    case "portfolio":
      return pickProvider(chain.providers.portfolio, networkClass);
  }
}

export function validateRegistry(): void {
  // chainMap + providerDefinitions + environmentProfiles self-validate on import.
  // Re-assert isolation for every profile so a bad config fails loudly at boot.
  for (const profile of Object.values(environmentProfiles)) {
    assertProfileIsolation(profile);
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/config/registry.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Run the full config suite + typecheck**

Run:
```bash
cd web && npx vitest run src/lib/config
cd web && npx tsc --noEmit
```
Expected: all config tests PASS; `tsc` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/config/registry.ts web/src/lib/config/registry.test.ts
git commit -m "feat(config): add registry facade with capability and provider resolution"
```

---

## Roadmap — subsequent plans

Per `Planning.md` §21, this config layer is Plan 1. **All 6 subsequent plans
are now written** (2026-07-11), each its own document, in dependency order.
Plan 1 (this document) is also implemented and merged; Plans 2–7 are written
but not yet implemented/merged.

- **[Plan 2 — Core Ports & Magic Wallet Adapter](2026-07-11-core-ports-magic-adapter.md).** `WalletPort`/`AccountPort`/`ExecutionPort`/`PortfolioPort` interfaces + `IdentityAttestation`; `MagicWalletAdapter` wraps existing `/api/wallet/*` routes (behavior preserved exactly); `RpcPortfolioAdapter` for native balances via the Plan 1 registry. `AccountPort`/`ExecutionPort` ship with stub adapters (real ones land in Plan 6). *(Depends on Plan 1.)*
- **[Plan 3 — MongoDB Atlas Data Layer](2026-07-11-mongodb-data-layer.md).** All 14 schema'd §18 collections as environment-scoped repositories; `BaseRepository` is the enforcement mechanism behind §4.2's isolation guarantee. Indexes + majority write concern for the six §22.5 collections. `fund_requests`/`invoices`/`transactions` explicitly deferred (no §18 schema block). *(Depends on Plan 1.)*
- **[Plan 4 — Multi-Family Wallet Provisioning](2026-07-11-wallet-provisioning.md).** `UserService` (find-or-create, auto-username), `WalletService` (idempotent, family-based provisioning + activation per §9.2), `DefaultWalletService` (§14). Magic TEE BTC/SOL support verified 2026-07-11 (§22.4). *(Depends on Plans 2, 3.)*
- **[Plan 5 — Identity-Based Vault Membership](2026-07-11-vault-membership.md).** `WalletResolver`, `MembershipReconciler` (drift detection, asymmetric trust, audit trail per §11.2/§11.3), `VaultMembershipService`. `Vault.sol` doesn't exist in this repo yet (`contracts/` is empty) — built against a `VaultChainClient` interface + in-memory fake; real contract wiring is a named, blocked follow-up. *(Depends on Plans 3, 4.)*
- **[Plan 6 — 7702 Smart Accounts & Transfer Orchestration](2026-07-11-smart-accounts-transfers.md).** `ZeroDev7702Adapter` (real, mocked-SDK tests), `EvmRpcExecutionAdapter` (real, same-chain), `ParticleExecutionAdapter` (stub — Particle UA confirmed mainnet-only 2026-07-11 per §22.3), `TransactionOrchestrator` (idempotent, resumable saga engine), `TransferService` (§15.2 recipient/chain resolution). Aggregation (§16) deferred to a named Plan 8, pending Plan 7's portfolio data and a resolved cross-chain execution story. *(Depends on Plans 2, 3, 4.)*
- **[Plan 7 — Paymaster, Portfolio Indexer & Environment UI](2026-07-11-paymaster-portfolio-env-ui.md).** `PortfolioNormalizer` + `PortfolioService` (indexer-first/RPC-fallback per §13.4, full §13.3 aggregation including by-token), `PaymasterPolicy` (§17), environment badge + non-production banner (§19) wired into the existing layout/Nav without disturbing existing behavior. `IndexerPortfolioAdapter` and asset pricing explicitly deferred (no vendor chosen). *(Depends on Plans 1, 2, 3.)*

**Not yet planned:** Plan 8 (cross-chain aggregation, §16) — deferred by Plan 6's own self-review pending Plan 7's portfolio data and a resolved Particle/bridge story; real `KernelFactory` (live ZeroDev SDK wiring) and real `ParticleExecutionAdapter`/`VaultChainClient`/`IndexerPortfolioAdapter` implementations, all blocked on external credentials or a not-yet-deployed contract, each named explicitly in its owning plan's Self-Review rather than silently absent.

---

## Self-Review

**Spec coverage (against Planning.md sections this plan targets):**
- §3.4 module layout → Task 1–5 build `web/src/lib/config/` as specified. ✅
- §4 EnvironmentProfile (5 profiles, isolation) → Task 4. ✅
- §5 ChainRegistry (definition shape, ChainKey, launch chains, capabilities) → Task 1 (shape) + Task 3 (entries). ✅
- §5.3 ChainCapability object → Task 1 `chainCapabilitySchema`; §5.5 runtime overrides = deferred (registry_overrides is a Plan 3 concern; noted, not in scope). ✅ (scoped out intentionally)
- §6 ChainFamily (family field driving shared adapters) → `family` in schema + per-family provider defaults in Task 3. ✅
- §7 ProviderRegistry (keys only, role, families, environments) → Task 2. ✅
- Environment isolation invariant (§4.2 registry level) → Task 4 `assertProfileIsolation` + Task 5 `validateRegistry`. ✅
- Arbitrum Sepolia RPC preserved → Task 3 asserted in test. ✅
- Provider resolution honoring `environments` (Particle main-only, §22.3 testnet fallback) → Task 5 `pickProvider`. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete file contents; every test step shows real assertions. ✅

**Type consistency:** `ChainDefinition`, `ChainKey`, `ChainCapability`, `ProviderDefinition`, `ProviderRole`, `EnvironmentProfile` defined once in Task 1 (`schema.ts`) and imported unchanged by Tasks 2–5. Accessor names consistent across produced/consumed blocks: `getProvider`/`getProvidersByRole` (Task 2), `getChainDefinition`/`chainMap`/`chainDefinitions` (Task 3), `environmentProfiles`/`assertProfileIsolation`/`resolveProfileChains` (Task 4), facade names (Task 5). `resolveProvider` array-vs-single handling matches the `chainProvidersSchema` shape (wallet/account single, execution/portfolio arrays). ✅

**Scope:** Single subsystem (config data + facade), no provider SDKs, no network, no DB. Independently testable and shippable. ✅
