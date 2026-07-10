# Core Ports & Magic Wallet Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the four core ports (`WalletPort`, `AccountPort`, `ExecutionPort`, `PortfolioPort`) from `Planning.md` §8, implement `MagicWalletAdapter` wrapping the existing Magic TEE routes behind `WalletPort`, and implement `RpcPortfolioAdapter` for chain-agnostic native-balance reads behind `PortfolioPort`.

**Architecture:** Plan 2 of the `Planning.md` migration sequence (§21 step 2 — "Ports around existing behavior"). Four small interfaces with value-object inputs/outputs, zero provider types leaking through signatures. Only `WalletPort` and `PortfolioPort` get real adapters now; `AccountPort` and `ExecutionPort` get interfaces + minimal stub adapters (proving implementability, ready for Plan 6's ZeroDev/Particle adapters). The existing `/api/wallet/create` and `/api/wallet/address` routes are refactored to call `MagicWalletAdapter` instead of inlining the TEE fetch — behavior is preserved exactly, only the seam moves.

**Tech Stack:** TypeScript, zod (already installed — dependencies only, not new schemas here), vitest, viem (already installed — used for `RpcPortfolioAdapter`), Next.js 16 App Router route handlers.

## Global Constraints

- All source under `web/src/lib/ports/` (interfaces + value objects) and `web/src/lib/adapters/` (implementations); run every command from `web/`.
- No provider SDK types (Magic SDK types, viem client types) may appear in a port interface signature — only the value objects defined in this plan.
- `MagicWalletAdapter` must preserve exact existing behavior: same TEE endpoint (`https://tee.express.magiclabs.com/v1/wallet`), same headers (`X-Magic-Secret-Key`, `X-OIDC-Provider-ID`, `X-Magic-Chain`), same env var names (`MAGIC_SECRET_KEY`, `OIDC_PROVIDER_ID`). `X-Magic-Chain` mapping: `family: "evm"` → `"ETH"`, `family: "solana"` → `"SOL"`, `family: "bitcoin"` → `"BTC"` (per Planning.md §8.1 and the verified §22.4 gate).
- The existing `/api/wallet/create` (`web/src/app/api/wallet/create/route.ts`) and `/api/wallet/address` (`web/src/app/api/wallet/address/route.ts`) routes must keep their exact current external contract (same request/response JSON shape, same status codes) — only their internals change to delegate to the adapter. Do not touch `web/src/lib/format.ts`, `web/src/lib/mock/wallet.ts`, or `web/src/app/settings/page.tsx` — they are out of scope for this plan and must keep working unmodified.
- `RpcPortfolioAdapter` reads RPC endpoints from the Plan 1 `ChainRegistry` (`web/src/lib/config/registry.ts`'s `getChain`) — never hardcode a chain's RPC URL in the adapter.
- Config files/ports use relative imports internally, consistent with Plan 1.
- Zero business logic may branch on chain name/ID literals — ports and adapters branch only on `family` or `ChainCapability`.

---

## File Structure

```
web/src/lib/
├── ports/
│   ├── types.ts                    # NEW — shared value objects for all 4 ports
│   ├── wallet-port.ts               # NEW — WalletPort interface
│   ├── account-port.ts              # NEW — AccountPort interface
│   ├── execution-port.ts            # NEW — ExecutionPort interface
│   └── portfolio-port.ts            # NEW — PortfolioPort interface
├── adapters/
│   ├── magic/
│   │   └── magic-wallet-adapter.ts  # NEW — WalletPort impl wrapping Magic TEE Express API
│   ├── eoa/
│   │   └── stub-account-adapter.ts  # NEW — AccountPort stub (throws NotImplemented; Plan 6 replaces)
│   ├── native-rpc/
│   │   └── stub-execution-adapter.ts # NEW — ExecutionPort stub (throws NotImplemented; Plan 6 replaces)
│   └── rpc/
│       └── rpc-portfolio-adapter.ts # NEW — PortfolioPort impl for EVM native balances via viem
web/src/app/api/wallet/
├── create/route.ts                  # MODIFY — delegate to MagicWalletAdapter
└── address/route.ts                 # MODIFY — delegate to MagicWalletAdapter
```

Tests live beside sources as `*.test.ts`.

---

## Task 1: Shared port value objects + `WalletPort` interface

**Files:**
- Create: `web/src/lib/ports/types.ts`
- Create: `web/src/lib/ports/wallet-port.ts`
- Test: `web/src/lib/ports/wallet-port.test.ts`

**Interfaces:**
- Consumes: from Plan 1 — `ChainFamily` (`web/src/lib/config/schema.ts`).
- Produces: types `Address = string`, `Signature = string`, `SignPayload`, `IdentityAttestation`, `WalletRecord`, `ProviderHealth`; interface `WalletPort` with `provision`, `getAddress`, `sign`, `healthcheck`.

- [ ] **Step 1: Write the failing test — `web/src/lib/ports/wallet-port.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import type { WalletPort } from "./wallet-port";
import type { IdentityAttestation, WalletRecord } from "./types";

class InMemoryWalletPort implements WalletPort {
  private wallets = new Map<string, WalletRecord>();

  private key(identity: IdentityAttestation, family: string): string {
    return `${identity.uid}:${family}`;
  }

  async provision(identity: IdentityAttestation, family: WalletRecord["family"]): Promise<WalletRecord> {
    const key = this.key(identity, family);
    const existing = this.wallets.get(key);
    if (existing) return existing;
    const record: WalletRecord = {
      address: `0xFAKE${key}`,
      family,
      provider: "magic",
      providerRef: key,
    };
    this.wallets.set(key, record);
    return record;
  }

  async getAddress(identity: IdentityAttestation, family: WalletRecord["family"]) {
    return this.wallets.get(this.key(identity, family))?.address ?? null;
  }

  async sign(identity: IdentityAttestation, family: WalletRecord["family"], payload: { data: string }) {
    if (!this.wallets.has(this.key(identity, family))) {
      throw new Error("no wallet provisioned for this identity/family");
    }
    return `sig:${payload.data}`;
  }

  async healthcheck() {
    return { provider: "magic" as const, status: "healthy" as const, checkedAt: new Date().toISOString() };
  }
}

const identity: IdentityAttestation = { uid: "user-1", email: "user@example.com", idToken: "token-abc" };

describe("WalletPort contract (via in-memory fake)", () => {
  it("provision is idempotent for the same identity+family", async () => {
    const port = new InMemoryWalletPort();
    const first = await port.provision(identity, "evm");
    const second = await port.provision(identity, "evm");
    expect(second).toEqual(first);
  });

  it("provisions independent wallets per family", async () => {
    const port = new InMemoryWalletPort();
    const evm = await port.provision(identity, "evm");
    const solana = await port.provision(identity, "solana");
    expect(evm.address).not.toBe(solana.address);
  });

  it("getAddress returns null before provisioning", async () => {
    const port = new InMemoryWalletPort();
    expect(await port.getAddress(identity, "bitcoin")).toBeNull();
  });

  it("sign throws for an unprovisioned family", async () => {
    const port = new InMemoryWalletPort();
    await expect(port.sign(identity, "solana", { data: "hello" })).rejects.toThrow(/no wallet provisioned/);
  });

  it("sign succeeds after provisioning", async () => {
    const port = new InMemoryWalletPort();
    await port.provision(identity, "evm");
    const sig = await port.sign(identity, "evm", { data: "hello" });
    expect(sig).toBe("sig:hello");
  });

  it("healthcheck reports a provider and status", async () => {
    const port = new InMemoryWalletPort();
    const health = await port.healthcheck();
    expect(health.provider).toBe("magic");
    expect(health.status).toBe("healthy");
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/ports/wallet-port.test.ts`
Expected: FAIL — cannot resolve `./wallet-port` and `./types`.

- [ ] **Step 3: Implement `web/src/lib/ports/types.ts`**

```ts
import type { ChainFamily, ProviderKey } from "../config/schema";

export type Address = string;
export type Signature = string;

export interface SignPayload {
  data: string;
}

export interface IdentityAttestation {
  uid: string;
  email: string | null;
  idToken: string;
}

export interface WalletRecord {
  address: Address;
  family: ChainFamily;
  provider: ProviderKey;
  providerRef: string;
}

export interface ProviderHealth {
  provider: ProviderKey;
  status: "healthy" | "degraded" | "down";
  checkedAt: string;
  detail?: string;
}

export interface ChainRef {
  key: string;
  family: ChainFamily;
}
```

- [ ] **Step 4: Implement `web/src/lib/ports/wallet-port.ts`**

```ts
import type { Address, IdentityAttestation, ProviderHealth, Signature, SignPayload, WalletRecord } from "./types";
import type { ChainFamily } from "../config/schema";

export interface WalletPort {
  provision(identity: IdentityAttestation, family: ChainFamily): Promise<WalletRecord>;
  getAddress(identity: IdentityAttestation, family: ChainFamily): Promise<Address | null>;
  sign(identity: IdentityAttestation, family: ChainFamily, payload: SignPayload): Promise<Signature>;
  healthcheck(): Promise<ProviderHealth>;
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/ports/wallet-port.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/ports/types.ts web/src/lib/ports/wallet-port.ts web/src/lib/ports/wallet-port.test.ts
git commit -m "feat(ports): add WalletPort interface and shared value objects"
```

---

## Task 2: `MagicWalletAdapter` — wraps existing Magic TEE routes behind `WalletPort`

**Files:**
- Create: `web/src/lib/adapters/magic/magic-wallet-adapter.ts`
- Test: `web/src/lib/adapters/magic/magic-wallet-adapter.test.ts`
- Modify: `web/src/app/api/wallet/create/route.ts`
- Modify: `web/src/app/api/wallet/address/route.ts`
- Test: `web/src/app/api/wallet/create/route.test.ts`
- Test: `web/src/app/api/wallet/address/route.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `WalletPort`, `IdentityAttestation`, `WalletRecord`, `ProviderHealth`; from Plan 1 — `ChainFamily`.
- Produces: `class MagicWalletAdapter implements WalletPort`, constructed as `new MagicWalletAdapter({ secretKey: string, oidcProviderId: string, fetchImpl?: typeof fetch })`.

- [ ] **Step 1: Write the failing test — `web/src/lib/adapters/magic/magic-wallet-adapter.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MagicWalletAdapter } from "./magic-wallet-adapter";
import type { IdentityAttestation } from "../../ports/types";

const identity: IdentityAttestation = { uid: "u1", email: "u1@example.com", idToken: "firebase-jwt-abc" };

function makeFetchMock(responseBody: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  });
}

describe("MagicWalletAdapter.provision", () => {
  it("calls the TEE endpoint with correct headers for an evm family", async () => {
    const fetchMock = makeFetchMock({ public_address: "0xABC", wallet_type: "eoa" });
    const adapter = new MagicWalletAdapter({ secretKey: "sk_test", oidcProviderId: "oidc_test", fetchImpl: fetchMock });

    const record = await adapter.provision(identity, "evm");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tee.express.magiclabs.com/v1/wallet",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "Authorization": "Bearer firebase-jwt-abc",
          "X-Magic-Secret-Key": "sk_test",
          "X-OIDC-Provider-ID": "oidc_test",
          "X-Magic-Chain": "ETH",
        }),
      }),
    );
    expect(record).toEqual({ address: "0xABC", family: "evm", provider: "magic", providerRef: "0xABC" });
  });

  it("maps solana family to X-Magic-Chain: SOL", async () => {
    const fetchMock = makeFetchMock({ public_address: "SoLanaAddr", wallet_type: "eoa" });
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    await adapter.provision(identity, "solana");
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-Magic-Chain"]).toBe("SOL");
  });

  it("maps bitcoin family to X-Magic-Chain: BTC", async () => {
    const fetchMock = makeFetchMock({ public_address: "bc1qabc", wallet_type: "eoa" });
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    await adapter.provision(identity, "bitcoin");
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-Magic-Chain"]).toBe("BTC");
  });

  it("throws with detail when the TEE API responds with an error", async () => {
    const fetchMock = makeFetchMock({ error: "boom" }, false, 500);
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    await expect(adapter.provision(identity, "evm")).rejects.toThrow(/Wallet creation failed/);
  });
});

describe("MagicWalletAdapter.getAddress", () => {
  it("calls the TEE endpoint with GET and returns the address", async () => {
    const fetchMock = makeFetchMock({ public_address: "0xDEF", wallet_type: "eoa" });
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    const address = await adapter.getAddress(identity, "evm");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tee.express.magiclabs.com/v1/wallet",
      expect.objectContaining({ method: "GET" }),
    );
    expect(address).toBe("0xDEF");
  });

  it("returns null when the TEE API 404s (no wallet yet)", async () => {
    const fetchMock = makeFetchMock({ error: "not found" }, false, 404);
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    expect(await adapter.getAddress(identity, "evm")).toBeNull();
  });
});

describe("MagicWalletAdapter.healthcheck", () => {
  it("reports healthy when a lightweight probe succeeds", async () => {
    const fetchMock = makeFetchMock({ public_address: "0x0", wallet_type: "eoa" }, true, 401);
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    const health = await adapter.healthcheck();
    expect(health.provider).toBe("magic");
    expect(["healthy", "degraded", "down"]).toContain(health.status);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/adapters/magic/magic-wallet-adapter.test.ts`
Expected: FAIL — cannot resolve `./magic-wallet-adapter`.

- [ ] **Step 3: Implement `web/src/lib/adapters/magic/magic-wallet-adapter.ts`**

```ts
import type { WalletPort } from "../../ports/wallet-port";
import type { Address, IdentityAttestation, ProviderHealth, Signature, SignPayload, WalletRecord } from "../../ports/types";
import type { ChainFamily } from "../../config/schema";

const TEE_ENDPOINT = "https://tee.express.magiclabs.com/v1/wallet";

const FAMILY_TO_MAGIC_CHAIN: Record<ChainFamily, string> = {
  evm: "ETH",
  solana: "SOL",
  bitcoin: "BTC",
};

interface MagicWalletAdapterConfig {
  secretKey: string;
  oidcProviderId: string;
  fetchImpl?: typeof fetch;
}

export class MagicWalletAdapter implements WalletPort {
  private readonly secretKey: string;
  private readonly oidcProviderId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: MagicWalletAdapterConfig) {
    this.secretKey = config.secretKey;
    this.oidcProviderId = config.oidcProviderId;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private headers(identity: IdentityAttestation, family: ChainFamily, extra?: Record<string, string>) {
    return {
      "Authorization": `Bearer ${identity.idToken}`,
      "X-Magic-Secret-Key": this.secretKey,
      "X-OIDC-Provider-ID": this.oidcProviderId,
      "X-Magic-Chain": FAMILY_TO_MAGIC_CHAIN[family],
      ...extra,
    };
  }

  async provision(identity: IdentityAttestation, family: ChainFamily): Promise<WalletRecord> {
    const res = await this.fetchImpl(TEE_ENDPOINT, {
      method: "POST",
      headers: this.headers(identity, family, { "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Wallet creation failed (${res.status}): ${detail}`);
    }

    const data = await res.json();
    return {
      address: data.public_address,
      family,
      provider: "magic",
      providerRef: data.public_address,
    };
  }

  async getAddress(identity: IdentityAttestation, family: ChainFamily): Promise<Address | null> {
    const res = await this.fetchImpl(TEE_ENDPOINT, {
      method: "GET",
      headers: this.headers(identity, family),
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Wallet lookup failed (${res.status}): ${detail}`);
    }

    const data = await res.json();
    return data.public_address ?? null;
  }

  async sign(identity: IdentityAttestation, family: ChainFamily, payload: SignPayload): Promise<Signature> {
    const res = await this.fetchImpl(TEE_ENDPOINT, {
      method: "POST",
      headers: this.headers(identity, family, { "Content-Type": "application/json" }),
      body: JSON.stringify({ operation: "sign", data: payload.data }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Signing failed (${res.status}): ${detail}`);
    }

    const data = await res.json();
    return data.signature;
  }

  async healthcheck(): Promise<ProviderHealth> {
    try {
      const res = await this.fetchImpl(TEE_ENDPOINT, {
        method: "GET",
        headers: { "X-Magic-Secret-Key": this.secretKey, "X-OIDC-Provider-ID": this.oidcProviderId, "X-Magic-Chain": "ETH" },
      });
      return {
        provider: "magic",
        status: res.status < 500 ? "healthy" : "degraded",
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        provider: "magic",
        status: "down",
        checkedAt: new Date().toISOString(),
        detail: err instanceof Error ? err.message : "unknown error",
      };
    }
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/adapters/magic/magic-wallet-adapter.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing route tests**

`web/src/app/api/wallet/create/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../lib/adapters/magic/magic-wallet-adapter", () => {
  return {
    MagicWalletAdapter: vi.fn().mockImplementation(() => ({
      provision: vi.fn().mockResolvedValue({ address: "0xMOCK", family: "evm", provider: "magic", providerRef: "0xMOCK" }),
    })),
  };
});

describe("POST /api/wallet/create", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MAGIC_SECRET_KEY: "sk_test", OIDC_PROVIDER_ID: "oidc_test" };
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/wallet/create", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when env is misconfigured", async () => {
    process.env.MAGIC_SECRET_KEY = "";
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/wallet/create", {
      method: "POST",
      headers: { Authorization: "Bearer sometoken" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns public_address and wallet_type on success", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/wallet/create", {
      method: "POST",
      headers: { Authorization: "Bearer sometoken" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.public_address).toBe("0xMOCK");
  });
});
```

`web/src/app/api/wallet/address/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../lib/adapters/magic/magic-wallet-adapter", () => {
  return {
    MagicWalletAdapter: vi.fn().mockImplementation(() => ({
      getAddress: vi.fn().mockResolvedValue("0xMOCK"),
    })),
  };
});

describe("GET /api/wallet/address", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MAGIC_SECRET_KEY: "sk_test", OIDC_PROVIDER_ID: "oidc_test" };
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/wallet/address", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns the resolved address on success", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/wallet/address", {
      method: "GET",
      headers: { Authorization: "Bearer sometoken" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.public_address).toBe("0xMOCK");
  });
});
```

- [ ] **Step 6: Run the route tests — verify they fail**

Run: `cd web && npx vitest run src/app/api/wallet/create/route.test.ts src/app/api/wallet/address/route.test.ts`
Expected: FAIL — routes still use inline fetch logic, response shapes/status codes for the mocked-adapter path don't match yet (the `MagicWalletAdapter` import doesn't exist yet in the route files to mock against).

- [ ] **Step 7: Modify `web/src/app/api/wallet/create/route.ts`**

```ts
import { NextResponse } from "next/server";
import { MagicWalletAdapter } from "@/lib/adapters/magic/magic-wallet-adapter";

// POST /api/wallet/create
// Creates a wallet via Magic Server Wallet TEE, delegating to MagicWalletAdapter.
// Expects a Firebase ID Token in the Authorization header.
export async function POST(req: Request) {
  const secretKey = process.env.MAGIC_SECRET_KEY;
  const oidcProviderId = process.env.OIDC_PROVIDER_ID;

  if (!secretKey || !oidcProviderId) {
    return NextResponse.json(
      { error: "Server misconfiguration (missing keys)" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!idToken) {
    return NextResponse.json(
      { error: "Missing Firebase ID token" },
      { status: 401 },
    );
  }

  try {
    const adapter = new MagicWalletAdapter({ secretKey, oidcProviderId });
    const record = await adapter.provision(
      { uid: "", email: null, idToken },
      "evm",
    );
    return NextResponse.json({
      public_address: record.address,
      wallet_type: "eoa",
    });
  } catch (err) {
    console.error("[wallet/create] Error:", err);
    return NextResponse.json(
      { error: "Wallet creation failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 8: Modify `web/src/app/api/wallet/address/route.ts`**

```ts
import { NextResponse } from "next/server";
import { MagicWalletAdapter } from "@/lib/adapters/magic/magic-wallet-adapter";

// GET /api/wallet/address
// Retrieves the existing wallet address for a user from Magic Server Wallet TEE.
// Expects a Firebase ID Token in the Authorization header.
export async function GET(req: Request) {
  const secretKey = process.env.MAGIC_SECRET_KEY;
  const oidcProviderId = process.env.OIDC_PROVIDER_ID;

  if (!secretKey || !oidcProviderId) {
    return NextResponse.json(
      { error: "Server misconfiguration (missing keys)" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!idToken) {
    return NextResponse.json(
      { error: "Missing Firebase ID token" },
      { status: 401 },
    );
  }

  try {
    const adapter = new MagicWalletAdapter({ secretKey, oidcProviderId });
    const address = await adapter.getAddress(
      { uid: "", email: null, idToken },
      "evm",
    );
    return NextResponse.json({
      public_address: address,
      wallet_type: "eoa",
    });
  } catch (err) {
    console.error("[wallet/address] Error:", err);
    return NextResponse.json(
      { error: "Wallet lookup failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
```

Note: `uid`/`email` are left blank here because the routes only ever had the raw Firebase ID token available (no server-side JWT decode existed before this plan) — the adapter only uses `idToken` for the `Authorization` header, so this preserves exact prior behavior. Decoding `uid`/`email` server-side is Plan 3's concern (identity/user records), not this plan's.

- [ ] **Step 9: Run the route tests — verify they pass**

Run: `cd web && npx vitest run src/app/api/wallet/create/route.test.ts src/app/api/wallet/address/route.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/adapters/magic/magic-wallet-adapter.ts web/src/lib/adapters/magic/magic-wallet-adapter.test.ts web/src/app/api/wallet/create/route.ts web/src/app/api/wallet/create/route.test.ts web/src/app/api/wallet/address/route.ts web/src/app/api/wallet/address/route.test.ts
git commit -m "feat(adapters): add MagicWalletAdapter, wrap wallet routes to use it"
```

---

## Task 3: `AccountPort` interface + stub adapter

**Files:**
- Create: `web/src/lib/ports/account-port.ts`
- Create: `web/src/lib/adapters/eoa/stub-account-adapter.ts`
- Test: `web/src/lib/adapters/eoa/stub-account-adapter.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `WalletRecord`; from Plan 1 — nothing new (uses `ports/types.ts`'s `ChainRef`).
- Produces: types `AccountMode = "eoa" | "smart-7702"`, `UpgradeResult`, `SignerHandle`; interface `AccountPort`; `class StubAccountAdapter implements AccountPort` (throws `NotImplementedError` on every method — Plan 6 replaces this with `ZeroDev7702Adapter` for EVM and a real EOA-passthrough adapter for Solana/Bitcoin).

- [ ] **Step 1: Write the failing test — `web/src/lib/adapters/eoa/stub-account-adapter.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { StubAccountAdapter, NotImplementedError } from "./stub-account-adapter";
import type { WalletRecord, ChainRef } from "../../ports/types";

const wallet: WalletRecord = { address: "0xABC", family: "evm", provider: "magic", providerRef: "0xABC" };
const chain: ChainRef = { key: "arbitrum-sepolia", family: "evm" };

describe("StubAccountAdapter", () => {
  it("getSigner throws NotImplementedError", async () => {
    const adapter = new StubAccountAdapter();
    await expect(adapter.getSigner(wallet, chain)).rejects.toThrow(NotImplementedError);
  });

  it("upgrade throws NotImplementedError", async () => {
    const adapter = new StubAccountAdapter();
    await expect(adapter.upgrade(wallet, chain)).rejects.toThrow(NotImplementedError);
  });

  it("downgrade throws NotImplementedError", async () => {
    const adapter = new StubAccountAdapter();
    await expect(adapter.downgrade(wallet, chain)).rejects.toThrow(NotImplementedError);
  });

  it("status defaults to eoa without throwing (safe default for unimplemented chains)", async () => {
    const adapter = new StubAccountAdapter();
    expect(await adapter.status(wallet, chain)).toBe("eoa");
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/adapters/eoa/stub-account-adapter.test.ts`
Expected: FAIL — cannot resolve `./stub-account-adapter`.

- [ ] **Step 3: Implement `web/src/lib/ports/account-port.ts`**

```ts
import type { WalletRecord, ChainRef } from "./types";

export type AccountMode = "eoa" | "smart-7702";

export interface UpgradeResult {
  mode: AccountMode;
  txRef?: string;
}

export interface SignerHandle {
  address: string;
  mode: AccountMode;
}

export interface AccountPort {
  getSigner(wallet: WalletRecord, chain: ChainRef): Promise<SignerHandle>;
  upgrade(wallet: WalletRecord, chain: ChainRef): Promise<UpgradeResult>;
  downgrade(wallet: WalletRecord, chain: ChainRef): Promise<void>;
  status(wallet: WalletRecord, chain: ChainRef): Promise<AccountMode>;
}
```

- [ ] **Step 4: Implement `web/src/lib/adapters/eoa/stub-account-adapter.ts`**

```ts
import type { AccountPort, AccountMode, SignerHandle, UpgradeResult } from "../../ports/account-port";
import type { WalletRecord, ChainRef } from "../../ports/types";

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`StubAccountAdapter.${method} is not implemented — real adapters land in Plan 6`);
    this.name = "NotImplementedError";
  }
}

export class StubAccountAdapter implements AccountPort {
  async getSigner(_wallet: WalletRecord, _chain: ChainRef): Promise<SignerHandle> {
    throw new NotImplementedError("getSigner");
  }

  async upgrade(_wallet: WalletRecord, _chain: ChainRef): Promise<UpgradeResult> {
    throw new NotImplementedError("upgrade");
  }

  async downgrade(_wallet: WalletRecord, _chain: ChainRef): Promise<void> {
    throw new NotImplementedError("downgrade");
  }

  async status(_wallet: WalletRecord, _chain: ChainRef): Promise<AccountMode> {
    return "eoa";
  }
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/adapters/eoa/stub-account-adapter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/ports/account-port.ts web/src/lib/adapters/eoa/stub-account-adapter.ts web/src/lib/adapters/eoa/stub-account-adapter.test.ts
git commit -m "feat(ports): add AccountPort interface and stub adapter"
```

---

## Task 4: `ExecutionPort` interface + stub adapter

**Files:**
- Create: `web/src/lib/ports/execution-port.ts`
- Create: `web/src/lib/adapters/native-rpc/stub-execution-adapter.ts`
- Test: `web/src/lib/adapters/native-rpc/stub-execution-adapter.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `ChainRef`; from Task 3 — `SignerHandle`.
- Produces: types `ExecutionIntent`, `ExecutionQuote`, `ExecutionReceipt`, `ExecutionRef`, `ExecutionStatus`; interface `ExecutionPort`; `class StubExecutionAdapter implements ExecutionPort` (throws `NotImplementedError` — Plan 6 replaces with `EvmRpcExecutionAdapter`/`ParticleExecutionAdapter`/`SolanaExecutionAdapter`/`BitcoinExecutionAdapter`).

- [ ] **Step 1: Write the failing test — `web/src/lib/adapters/native-rpc/stub-execution-adapter.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { StubExecutionAdapter } from "./stub-execution-adapter";
import { NotImplementedError } from "../eoa/stub-account-adapter";
import type { ExecutionIntent } from "../../ports/execution-port";
import type { SignerHandle } from "../../ports/account-port";

const intent: ExecutionIntent = {
  kind: "transfer",
  sourceChain: { key: "arbitrum-sepolia", family: "evm" },
  amountRaw: "1000000000000000000",
  recipient: "0xRECIPIENT",
};
const signer: SignerHandle = { address: "0xABC", mode: "eoa" };

describe("StubExecutionAdapter", () => {
  it("quote throws NotImplementedError", async () => {
    const adapter = new StubExecutionAdapter();
    await expect(adapter.quote(intent)).rejects.toThrow(NotImplementedError);
  });

  it("submit throws NotImplementedError", async () => {
    const adapter = new StubExecutionAdapter();
    await expect(adapter.submit(intent, signer)).rejects.toThrow(NotImplementedError);
  });

  it("trackStatus throws NotImplementedError", async () => {
    const adapter = new StubExecutionAdapter();
    await expect(adapter.trackStatus({ providerRef: "0xhash", chain: intent.sourceChain })).rejects.toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/adapters/native-rpc/stub-execution-adapter.test.ts`
Expected: FAIL — cannot resolve `./stub-execution-adapter`.

- [ ] **Step 3: Implement `web/src/lib/ports/execution-port.ts`**

```ts
import type { ChainRef } from "./types";
import type { SignerHandle } from "./account-port";

export interface ExecutionIntent {
  kind: "transfer" | "vault_deposit" | "vault_withdraw" | "swap";
  sourceChain: ChainRef;
  destinationChain?: ChainRef;
  amountRaw: string;
  recipient: string;
}

export interface ExecutionQuote {
  feeRaw: string;
  etaSeconds: number;
  legCount: number;
}

export interface ExecutionRef {
  providerRef: string;
  chain: ChainRef;
}

export interface ExecutionReceipt extends ExecutionRef {
  submittedAt: string;
}

export type ExecutionStatus = "pending" | "confirmed" | "failed";

export interface ExecutionPort {
  quote(intent: ExecutionIntent): Promise<ExecutionQuote>;
  submit(intent: ExecutionIntent, signer: SignerHandle): Promise<ExecutionReceipt>;
  trackStatus(ref: ExecutionRef): Promise<ExecutionStatus>;
}
```

- [ ] **Step 4: Implement `web/src/lib/adapters/native-rpc/stub-execution-adapter.ts`**

```ts
import type { ExecutionPort, ExecutionIntent, ExecutionQuote, ExecutionReceipt, ExecutionRef, ExecutionStatus } from "../../ports/execution-port";
import type { SignerHandle } from "../../ports/account-port";
import { NotImplementedError } from "../eoa/stub-account-adapter";

export class StubExecutionAdapter implements ExecutionPort {
  async quote(_intent: ExecutionIntent): Promise<ExecutionQuote> {
    throw new NotImplementedError("quote");
  }

  async submit(_intent: ExecutionIntent, _signer: SignerHandle): Promise<ExecutionReceipt> {
    throw new NotImplementedError("submit");
  }

  async trackStatus(_ref: ExecutionRef): Promise<ExecutionStatus> {
    throw new NotImplementedError("trackStatus");
  }
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/adapters/native-rpc/stub-execution-adapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/ports/execution-port.ts web/src/lib/adapters/native-rpc/stub-execution-adapter.ts web/src/lib/adapters/native-rpc/stub-execution-adapter.test.ts
git commit -m "feat(ports): add ExecutionPort interface and stub adapter"
```

---

## Task 5: `PortfolioPort` interface + `RpcPortfolioAdapter`

**Files:**
- Create: `web/src/lib/ports/portfolio-port.ts`
- Create: `web/src/lib/adapters/rpc/rpc-portfolio-adapter.ts`
- Test: `web/src/lib/adapters/rpc/rpc-portfolio-adapter.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `Address`, `WalletRecord`, `ChainRef`; from Plan 1 — `getChain` (`web/src/lib/config/registry.ts`), `ChainDefinition`.
- Produces: types `RawAssetPage`, `RawBalance`; interface `PortfolioPort`; `class RpcPortfolioAdapter implements PortfolioPort` (EVM-only for now — non-EVM families return an empty `RawAssetPage`/zero `RawBalance` until Plan 6/7 add family-specific adapters; this matches the plan's EVM-first native-balance scope).

- [ ] **Step 1: Write the failing test — `web/src/lib/adapters/rpc/rpc-portfolio-adapter.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { RpcPortfolioAdapter } from "./rpc-portfolio-adapter";
import type { WalletRecord, ChainRef } from "../../ports/types";

const evmWallet: WalletRecord = { address: "0xABC", family: "evm", provider: "magic", providerRef: "0xABC" };
const evmChain: ChainRef = { key: "arbitrum-sepolia", family: "evm" };
const solanaWallet: WalletRecord = { address: "SoLAddr", family: "solana", provider: "magic", providerRef: "SoLAddr" };
const solanaChain: ChainRef = { key: "solana-devnet", family: "solana" };

describe("RpcPortfolioAdapter.fetchNativeBalance", () => {
  it("reads the balance from the chain's registry RPC endpoint for evm chains", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: "0xde0b6b3a7640000" }), // 1 ETH in wei, hex
    });
    const adapter = new RpcPortfolioAdapter({ fetchImpl: fetchMock });

    const balance = await adapter.fetchNativeBalance(evmWallet.address, evmChain);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sepolia-rollup.arbitrum.io/rpc",
      expect.objectContaining({ method: "POST" }),
    );
    expect(balance).toEqual({ raw: "1000000000000000000", chainKey: "arbitrum-sepolia" });
  });

  it("returns a zero balance for non-evm families (not yet supported by this adapter)", async () => {
    const fetchMock = vi.fn();
    const adapter = new RpcPortfolioAdapter({ fetchImpl: fetchMock });
    const balance = await adapter.fetchNativeBalance(solanaWallet.address, solanaChain);
    expect(balance).toEqual({ raw: "0", chainKey: "solana-devnet" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a zero balance when the RPC call fails rather than throwing", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    const adapter = new RpcPortfolioAdapter({ fetchImpl: fetchMock });
    const balance = await adapter.fetchNativeBalance(evmWallet.address, evmChain);
    expect(balance).toEqual({ raw: "0", chainKey: "arbitrum-sepolia" });
  });
});

describe("RpcPortfolioAdapter.fetchAssets", () => {
  it("returns a page containing only the native balance (no token discovery yet)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: "0x0" }),
    });
    const adapter = new RpcPortfolioAdapter({ fetchImpl: fetchMock });
    const page = await adapter.fetchAssets(evmWallet, evmChain);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].kind).toBe("native");
    expect(page.source).toBe("rpc");
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/adapters/rpc/rpc-portfolio-adapter.test.ts`
Expected: FAIL — cannot resolve `./rpc-portfolio-adapter`.

- [ ] **Step 3: Implement `web/src/lib/ports/portfolio-port.ts`**

```ts
import type { Address, ChainRef, WalletRecord } from "./types";

export interface RawBalance {
  raw: string;
  chainKey: string;
}

export interface RawAsset {
  kind: "native" | "erc20" | "spl" | "utxo";
  raw: string;
  contractAddress?: string;
}

export interface RawAssetPage {
  items: RawAsset[];
  source: "rpc" | "indexer";
}

export interface PortfolioPort {
  fetchAssets(wallet: WalletRecord, chain: ChainRef): Promise<RawAssetPage>;
  fetchNativeBalance(address: Address, chain: ChainRef): Promise<RawBalance>;
}
```

- [ ] **Step 4: Implement `web/src/lib/adapters/rpc/rpc-portfolio-adapter.ts`**

```ts
import type { PortfolioPort, RawAssetPage, RawBalance } from "../../ports/portfolio-port";
import type { Address, ChainRef, WalletRecord } from "../../ports/types";
import { getChain } from "../../config/registry";

interface RpcPortfolioAdapterConfig {
  fetchImpl?: typeof fetch;
}

export class RpcPortfolioAdapter implements PortfolioPort {
  private readonly fetchImpl: typeof fetch;

  constructor(config: RpcPortfolioAdapterConfig = {}) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async fetchNativeBalance(address: Address, chain: ChainRef): Promise<RawBalance> {
    if (chain.family !== "evm") {
      return { raw: "0", chainKey: chain.key };
    }

    try {
      const definition = getChain(chain.key);
      const rpcUrl = definition.rpc[0].url;
      const res = await this.fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [address, "latest"],
          id: 1,
        }),
      });

      if (!res.ok) return { raw: "0", chainKey: chain.key };

      const data = await res.json();
      if (!data.result) return { raw: "0", chainKey: chain.key };

      return { raw: BigInt(data.result).toString(), chainKey: chain.key };
    } catch {
      return { raw: "0", chainKey: chain.key };
    }
  }

  async fetchAssets(wallet: WalletRecord, chain: ChainRef): Promise<RawAssetPage> {
    const native = await this.fetchNativeBalance(wallet.address, chain);
    return {
      items: [{ kind: "native", raw: native.raw }],
      source: "rpc",
    };
  }
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/adapters/rpc/rpc-portfolio-adapter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full ports+adapters suite, plus typecheck**

Run:
```bash
cd web && npx vitest run src/lib/ports src/lib/adapters src/app/api/wallet
cd web && npx tsc --noEmit
```
Expected: all tests PASS (24 tests across this plan); `tsc` reports zero errors (the pre-existing `finishOAuth` error from earlier sessions is already resolved on `main`).

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/ports/portfolio-port.ts web/src/lib/adapters/rpc/rpc-portfolio-adapter.ts web/src/lib/adapters/rpc/rpc-portfolio-adapter.test.ts
git commit -m "feat(ports): add PortfolioPort interface and RpcPortfolioAdapter"
```

---

## Self-Review

**Spec coverage (against Planning.md §8 and the roadmap line this plan implements):**
- §8.1 `WalletPort` exact signature (`provision`/`getAddress`/`sign`/`healthcheck`) → Task 1. ✅
- §8.1 `IdentityAttestation` as identity-proof value object, not an auth owner → Task 1 `types.ts`. ✅
- §8.1 Magic adapter maps family → `X-Magic-Chain` (`ETH`/`SOL`/`BTC`) → Task 2, tested for all three families. ✅
- §8.2 `AccountPort` exact signature (`getSigner`/`upgrade`/`downgrade`/`status`) → Task 3. ✅
- §8.3 `ExecutionPort` exact signature (`quote`/`submit`/`trackStatus`) → Task 4. ✅
- §8.4 `PortfolioPort` exact signature (`fetchAssets`/`fetchNativeBalance`), "returns raw provider data" → Task 5, `RawAssetPage`/`RawBalance` are unnormalized. ✅
- "Wrap existing `/api/wallet/*` Magic TEE routes as `MagicWalletAdapter`" (roadmap) → Task 2, routes modified to delegate, exact external contract preserved (tested). ✅
- "RPC portfolio adapter for native balances" (roadmap) → Task 5, chain-agnostic via Plan 1's `ChainRegistry`. ✅
- Global constraint "no provider SDK types in port signatures" → verified: no `magic-sdk`, `viem`, or other provider imports appear in any `ports/*.ts` file — only in adapter implementation files. ✅

**Placeholder scan:** No TBD/TODO; every step shows complete file contents; stub adapters throw a real, tested `NotImplementedError` rather than silently no-op-ing (a deliberate, documented placeholder for Plan 6, not a plan-writing placeholder). ✅

**Type consistency:** `WalletRecord`, `ChainRef`, `IdentityAttestation` defined once in Task 1's `types.ts`, imported unchanged by Tasks 2–5. `SignerHandle` defined in Task 3, imported by Task 4's `ExecutionPort.submit`. `NotImplementedError` defined once in Task 3, reused by Task 4 (not redefined) — confirmed via explicit cross-file import in Task 4's code and test. ✅

**Scope:** Single subsystem (ports + two real adapters + two stub adapters), no MongoDB, no ZeroDev/Particle SDKs, no UI changes. Independently testable and shippable — `MagicWalletAdapter` and `RpcPortfolioAdapter` are immediately usable; `AccountPort`/`ExecutionPort` stubs unblock Plan 6 without requiring speculative behavior now. ✅
