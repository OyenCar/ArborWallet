# MongoDB Atlas Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up MongoDB Atlas as the off-chain application datastore per `Planning.md` §18 — a connection module, an environment-scoped base repository (the enforcement mechanism for §4.2's isolation invariant), and thin repositories for all 14 collections `Planning.md` §18 defines with a schema block.

**Architecture:** This is the **Data Layer** (per §3.1's layer diagram), sitting under the Domain Services that Plans 4–7 build. Repositories here are deliberately thin — CRUD + the specific indexed queries §18 calls for — with **zero business logic**. The one piece of real behavior is `BaseRepository`: every read/write it exposes silently scopes to the active environment, which is the concrete mechanism behind §4.2's "repository level" isolation guarantee ("business code cannot forget the filter because it never writes raw queries"). Domain services in later plans depend on these repositories; this plan does not depend on any domain service.

**Tech Stack:** MongoDB Atlas (driver: `mongodb`), `mongodb-memory-server` for hermetic tests (no live Atlas cluster needed to run the suite), vitest, TypeScript. Reuses Plan 1's `EnvironmentProfile`/`getActiveProfile` for environment scoping and Plan 2's `ChainFamily`/`ProviderKey` types where a collection field references them.

## Global Constraints

- All source under `web/src/lib/data/`; run every command from `web/`.
- Every collection except `registry_overrides` and `provider_runtime` (which are environment-agnostic ops config) carries an `environment: NetworkClass` field; every repository built on `BaseRepository` automatically injects `environment: getActiveProfile().networkClass` into every filter and every inserted document. No repository method may accept a caller-supplied `environment` override — that would defeat the isolation guarantee.
- Amounts are stored as integer strings in chain units (never floats), per §18's "amounts are integer strings in chain units."
- `write concern: majority` for `users`, `wallets`, `vaults`, `vault_memberships`, `transfer_intents`, `transfer_legs` (identity/membership/saga collections per §22.5) — all other collections use the MongoDB driver's default write concern.
- Collection and index names, field names, and uniqueness constraints must match §18 verbatim — this plan does not redesign the schema, only implements it.
- Connection: single MongoDB client instance reused across requests (Next.js serverless — a new client per request would exhaust Atlas connection limits). Env var: `MONGODB_URI` (new — add to the env var list in `web/CLAUDE.md`'s Conventions section as part of this plan's final task).
- `fund_requests`, `invoices`, and `transactions` (mentioned in §18 as "carried over from the existing Postgres design... when implementation starts") are explicitly **out of scope for this plan** — §18 does not give them a schema block the way it does the other 14 collections, and no plan in the current roadmap (Plans 2, 4–7) consumes them yet. Building them now would be speculative. Flagged here per the instruction to surface scope decisions rather than silently drop them — they should get their own task (or a Plan 8) when a consuming feature actually needs them.

---

## File Structure

```
web/src/lib/data/
├── client.ts                       # NEW — MongoDB client singleton + getDb()
├── base-repository.ts              # NEW — environment-scoping repository base class
├── repositories/
│   ├── users-repository.ts         # NEW
│   ├── wallets-repository.ts       # NEW
│   ├── vaults-repository.ts        # NEW
│   ├── vault-memberships-repository.ts   # NEW
│   ├── workspaces-repository.ts    # NEW
│   ├── workspace-memberships-repository.ts # NEW
│   ├── contacts-repository.ts      # NEW
│   ├── activity-repository.ts      # NEW
│   ├── portfolio-cache-repository.ts # NEW
│   ├── transfer-intents-repository.ts # NEW
│   ├── transfer-legs-repository.ts # NEW
│   ├── paymaster-quotas-repository.ts # NEW
│   ├── registry-overrides-repository.ts # NEW
│   └── provider-runtime-repository.ts # NEW
└── entities.ts                     # NEW — shared document type definitions
```

Tests live beside sources as `*.test.ts`. A single `web/vitest.setup.ts` (new) boots one shared `mongodb-memory-server` instance for the whole suite (starting a fresh in-memory Mongo per test file would be slow — one instance, database dropped between tests via `afterEach`).

---

## Task 1: Test infrastructure — `mongodb-memory-server` + `MongoClient` singleton

**Files:**
- Modify: `web/package.json` (add `mongodb`, `mongodb-memory-server` deps)
- Modify: `web/vitest.config.ts` (add `setupFiles`)
- Create: `web/vitest.setup.ts`
- Create: `web/src/lib/data/client.ts`
- Test: `web/src/lib/data/client.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `async function getDb(): Promise<Db>` (returns a connected `mongodb` `Db` handle, memoized — same instance across calls in one process), `async function closeConnection(): Promise<void>` (test teardown helper).

- [ ] **Step 1: Install dependencies**

Run (from `web/`):
```bash
npm install mongodb@^6.10.0
npm install -D mongodb-memory-server@^10.1.0
```

- [ ] **Step 2: Create `web/vitest.setup.ts`**

```ts
import { MongoMemoryServer } from "mongodb-memory-server";
import { beforeAll, afterAll, afterEach } from "vitest";
import { getDb, closeConnection, __setTestConnectionString } from "./src/lib/data/client";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  __setTestConnectionString(mongod.getUri());
});

afterEach(async () => {
  const db = await getDb();
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await closeConnection();
  await mongod.stop();
});
```

- [ ] **Step 3: Update `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 20000,
  },
});
```

- [ ] **Step 4: Write the failing test — `web/src/lib/data/client.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { getDb } from "./client";

describe("getDb", () => {
  it("returns a connected database handle", async () => {
    const db = await getDb();
    expect(db.databaseName).toBeTruthy();
  });

  it("returns the same instance across calls (memoized)", async () => {
    const first = await getDb();
    const second = await getDb();
    expect(first).toBe(second);
  });

  it("the returned handle can read and write a collection", async () => {
    const db = await getDb();
    const col = db.collection("client_test_probe");
    await col.insertOne({ ping: "pong" });
    const found = await col.findOne({ ping: "pong" });
    expect(found?.ping).toBe("pong");
  });
});
```

- [ ] **Step 5: Run test — verify it fails**

Run: `cd web && npx vitest run src/lib/data/client.test.ts`
Expected: FAIL — cannot resolve `./client`.

- [ ] **Step 6: Implement `web/src/lib/data/client.ts`**

```ts
import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;
let testConnectionString: string | null = null;

// Test-only hook: mongodb-memory-server assigns a random port per run, so
// the connection string cannot be a static env var in tests.
export function __setTestConnectionString(uri: string): void {
  testConnectionString = uri;
  client = null;
  db = null;
}

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = testConnectionString ?? process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
}

export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
```

- [ ] **Step 7: Run test — verify it passes**

Run: `cd web && npx vitest run src/lib/data/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/vitest.setup.ts web/src/lib/data/client.ts web/src/lib/data/client.test.ts
git commit -m "feat(data): add MongoDB client singleton and mongodb-memory-server test harness"
```

---

## Task 2: `BaseRepository` — environment-scoping enforcement

**Files:**
- Create: `web/src/lib/data/base-repository.ts`
- Test: `web/src/lib/data/base-repository.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `getDb`; from Plan 1 — `getActiveProfile` (`web/src/lib/config/registry.ts`), `NetworkClass` (`web/src/lib/config/schema.ts`).
- Produces: `abstract class BaseRepository<T extends { environment?: string }>` with `protected collectionName: string`, `async insertOne(doc: Omit<T, "environment">): Promise<T & { _id: ObjectId }>`, `async findOne(filter: Partial<T>): Promise<T | null>`, `async find(filter: Partial<T>): Promise<T[]>`, `async updateOne(filter: Partial<T>, update: Partial<T>): Promise<void>`. Every method injects/merges `environment: getActiveProfile().networkClass` — callers can never override it.

- [ ] **Step 1: Write the failing test — `web/src/lib/data/base-repository.test.ts`**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { BaseRepository } from "./base-repository";

interface Widget {
  _id?: string;
  environment?: string;
  name: string;
  count: number;
}

class WidgetRepository extends BaseRepository<Widget> {
  protected collectionName = "widgets_test";
}

const originalEnv = process.env.APP_ENV_PROFILE;
afterEach(() => {
  if (originalEnv === undefined) delete process.env.APP_ENV_PROFILE;
  else process.env.APP_ENV_PROFILE = originalEnv;
});

describe("BaseRepository environment scoping", () => {
  it("insertOne stamps the active profile's environment", async () => {
    process.env.APP_ENV_PROFILE = "testnet";
    const repo = new WidgetRepository();
    const inserted = await repo.insertOne({ name: "gizmo", count: 1 });
    expect(inserted.environment).toBe("test");
  });

  it("findOne only returns documents from the active environment", async () => {
    process.env.APP_ENV_PROFILE = "testnet";
    const repo = new WidgetRepository();
    await repo.insertOne({ name: "gizmo-test", count: 1 });

    process.env.APP_ENV_PROFILE = "mainnet";
    const mainnetRepo = new WidgetRepository();
    await mainnetRepo.insertOne({ name: "gizmo-main", count: 1 });

    const foundOnMain = await mainnetRepo.findOne({ name: "gizmo-test" });
    expect(foundOnMain).toBeNull();

    const foundOnMainOwn = await mainnetRepo.findOne({ name: "gizmo-main" });
    expect(foundOnMainOwn?.name).toBe("gizmo-main");
  });

  it("find is scoped even when the caller passes no filter", async () => {
    process.env.APP_ENV_PROFILE = "testnet";
    const repo = new WidgetRepository();
    await repo.insertOne({ name: "a", count: 1 });
    await repo.insertOne({ name: "b", count: 2 });

    process.env.APP_ENV_PROFILE = "mainnet";
    const mainnetRepo = new WidgetRepository();
    await mainnetRepo.insertOne({ name: "c", count: 3 });

    const testnetResults = await repo.find({});
    expect(testnetResults.map((w) => w.name).sort()).toEqual(["a", "b"]);
  });

  it("updateOne cannot cross environments", async () => {
    process.env.APP_ENV_PROFILE = "testnet";
    const repo = new WidgetRepository();
    await repo.insertOne({ name: "shared-name", count: 1 });

    process.env.APP_ENV_PROFILE = "mainnet";
    const mainnetRepo = new WidgetRepository();
    await mainnetRepo.insertOne({ name: "shared-name", count: 100 });
    await mainnetRepo.updateOne({ name: "shared-name" }, { count: 999 });

    process.env.APP_ENV_PROFILE = "testnet";
    const testnetAfter = await repo.findOne({ name: "shared-name" });
    expect(testnetAfter?.count).toBe(1); // untouched by the mainnet update
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd web && npx vitest run src/lib/data/base-repository.test.ts`
Expected: FAIL — cannot resolve `./base-repository`.

- [ ] **Step 3: Implement `web/src/lib/data/base-repository.ts`**

```ts
import type { Filter, OptionalUnlessRequiredId, UpdateFilter } from "mongodb";
import { getDb } from "./client";
import { getActiveProfile } from "../config/registry";

export abstract class BaseRepository<T extends { environment?: string }> {
  protected abstract collectionName: string;

  private async collection() {
    const db = await getDb();
    return db.collection<T>(this.collectionName);
  }

  private scopedFilter(filter: Partial<T>): Filter<T> {
    return { ...filter, environment: getActiveProfile().networkClass } as Filter<T>;
  }

  async insertOne(doc: Omit<T, "environment">): Promise<T & { _id: unknown }> {
    const col = await this.collection();
    const scoped = { ...doc, environment: getActiveProfile().networkClass } as OptionalUnlessRequiredId<T>;
    const result = await col.insertOne(scoped);
    return { ...(scoped as T), _id: result.insertedId };
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    const col = await this.collection();
    return col.findOne(this.scopedFilter(filter)) as Promise<T | null>;
  }

  async find(filter: Partial<T>): Promise<T[]> {
    const col = await this.collection();
    return col.find(this.scopedFilter(filter)).toArray() as Promise<T[]>;
  }

  async updateOne(filter: Partial<T>, update: Partial<T>): Promise<void> {
    const col = await this.collection();
    await col.updateOne(this.scopedFilter(filter), { $set: update } as UpdateFilter<T>);
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd web && npx vitest run src/lib/data/base-repository.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/data/base-repository.ts web/src/lib/data/base-repository.test.ts
git commit -m "feat(data): add BaseRepository with enforced environment scoping"
```

---

## Task 3: `entities.ts` — shared document type definitions

**Files:**
- Create: `web/src/lib/data/entities.ts`

**Interfaces:**
- Consumes: from Plan 1 — `ChainKey`, `ChainFamily`, `NetworkClass`, `ProviderKey`; from Plan 2 — nothing (entities are data-shape only).
- Produces: all 14 document interfaces from §18: `UserDoc`, `WalletDoc`, `VaultDoc`, `VaultMembershipDoc`, `WorkspaceDoc`, `WorkspaceMembershipDoc`, `ContactDoc`, `PortfolioCacheDoc`, `NormalizedAssetEntry`, `TransferIntentDoc`, `TransferLegDoc`, `PaymasterQuotaDoc`, `RegistryOverrideDoc`, `ProviderRuntimeDoc`.

This task has no runtime behavior (pure type definitions) — it is exercised indirectly by every repository test in Tasks 4–10, which construct real documents against these types and verify persistence round-trips. Per the config layer's Task 1 precedent, a types-only file with zero functions is folded into the next task that gives it a real consumer rather than tested in isolation — here, unlike Plan 1, there are *seven* immediate consumers (Tasks 4–10), so `entities.ts` is its own task for clean review boundaries, and its correctness is verified by the sum of every repository test that follows.

- [ ] **Step 1: Implement `web/src/lib/data/entities.ts`**

```ts
import type { ObjectId } from "mongodb";
import type { ChainFamily, ChainKey, NetworkClass, ProviderKey } from "../config/schema";

export interface UserDoc {
  _id?: ObjectId;
  firebaseUid: string;
  username: string;
  email: string;
  preferences: {
    defaultChain: { test: ChainKey; main: ChainKey };
    displayCurrency: string;
  };
  status: "active" | "suspended" | "deleted";
  createdAt: string;
  updatedAt: string;
  environment?: NetworkClass;
}

export interface WalletDelegation {
  chainKey: ChainKey;
  delegated: boolean;
  implementation: string;
  txRef: string;
  at: string;
}

export interface WalletDoc {
  _id?: ObjectId;
  userId: string;
  family: ChainFamily;
  address: string;
  provider: ProviderKey;
  providerRef: string;
  walletType: "eoa" | "smart";
  delegations: WalletDelegation[];
  status: "declared" | "active" | "archived";
  createdAt: string;
  syncedAt?: string;
  environment?: NetworkClass;
}

export interface VaultDoc {
  _id?: ObjectId;
  label: string;
  contractAddress: string;
  chainKey: ChainKey;
  ownerUserId: string;
  workspaceId?: string;
  createdAt: string;
  environment?: NetworkClass;
}

export interface VaultMembershipDoc {
  _id?: ObjectId;
  vaultId: string;
  userId: string;
  partitionOnChainId: number;
  role: "member" | "owner";
  limits: { limitWei: string; spentWeiCached: string; cachedAt: string };
  onChain: { projectedAddress: string; syncState: "pending" | "synced" | "drift"; lastTxRef?: string };
  status: "active" | "revoked";
  createdAt: string;
  environment?: NetworkClass;
}

export interface WorkspaceDoc {
  _id?: ObjectId;
  name: string;
  ownerUserId: string;
  createdAt: string;
  environment?: NetworkClass;
}

export interface WorkspaceMembershipDoc {
  _id?: ObjectId;
  workspaceId: string;
  userId: string;
  role: string;
  createdAt: string;
  environment?: NetworkClass;
}

export interface ContactDoc {
  _id?: ObjectId;
  userId: string;
  alias: string;
  target: { kind: "username" | "address"; value: string; family?: ChainFamily };
  createdAt: string;
  environment?: NetworkClass;
}

export interface NormalizedAssetEntry {
  assetKey: string;
  chainKey: ChainKey;
  kind: "native" | "erc20" | "spl" | "utxo" | "nft";
  symbol: string;
  name: string;
  decimals: number;
  raw: string;
  display: string;
  usdValue?: number;
  priceStale: boolean;
}

export interface PortfolioCacheDoc {
  _id?: ObjectId;
  walletId: string;
  userId: string;
  chainKey: ChainKey;
  assets: NormalizedAssetEntry[];
  syncedAt: string;
  syncStatus: "fresh" | "refreshing" | "stale" | "error";
  source: "indexer" | "rpc";
  environment?: NetworkClass;
}

export interface TransferIntentDoc {
  _id?: ObjectId;
  userId: string;
  idempotencyKey: string;
  kind: "transfer" | "vault_deposit" | "aggregation";
  recipient: {
    kind: "username" | "address" | "vault";
    value: string;
    resolvedUserId?: string;
    resolvedAddress: string;
    chainKey: ChainKey;
  };
  asset: { assetKey: string; amountRaw: string };
  sourceChainKey: ChainKey;
  quote: { fees: string; eta: number; legPlan: string[] };
  status: "draft" | "quoted" | "approved" | "executing" | "settled" | "partially_settled" | "failed";
  createdAt: string;
  updatedAt: string;
  environment?: NetworkClass;
}

export interface TransferLegDoc {
  _id?: ObjectId;
  intentId: string;
  seq: number;
  kind: "same_chain" | "bridge" | "vault_deposit" | "collect";
  fromChainKey: ChainKey;
  toChainKey: ChainKey;
  provider: ProviderKey;
  status: "pending" | "submitted" | "confirmed" | "failed";
  txRef?: string;
  attempts: number;
  deadlineAt: string;
  error?: string;
  updatedAt: string;
  environment?: NetworkClass;
}

export interface PaymasterQuotaDoc {
  _id?: ObjectId;
  userId: string;
  windowStart: string;
  sponsoredOps: number;
  gasSpendWei: string;
  tier: "none" | "capped" | "full";
  environment?: NetworkClass;
}

export interface RegistryOverrideDoc {
  _id?: ObjectId;
  scope: "chain" | "provider";
  key: string;
  patch: Record<string, unknown>;
  reason: string;
  actor: string;
  createdAt: string;
  expiresAt?: string;
}

export interface ProviderRuntimeDoc {
  _id?: ObjectId;
  providerKey: ProviderKey;
  status: "active" | "degraded" | "disabled";
  lastCheckAt: string;
  notes?: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: zero new errors (pure type file — nothing to run yet; later tasks import and exercise these types).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/data/entities.ts
git commit -m "feat(data): add MongoDB document entity types per Planning.md §18"
```

---

## Task 4: `UsersRepository` + `WalletsRepository`

**Files:**
- Create: `web/src/lib/data/repositories/users-repository.ts`
- Create: `web/src/lib/data/repositories/wallets-repository.ts`
- Test: `web/src/lib/data/repositories/users-repository.test.ts`
- Test: `web/src/lib/data/repositories/wallets-repository.test.ts`

**Interfaces:**
- Consumes: from Task 2 — `BaseRepository`; from Task 3 — `UserDoc`, `WalletDoc`.
- Produces: `class UsersRepository extends BaseRepository<UserDoc>` with `findByFirebaseUid(uid: string): Promise<UserDoc | null>`, `findByUsername(username: string): Promise<UserDoc | null>`; `class WalletsRepository extends BaseRepository<WalletDoc>` with `findByUserAndFamily(userId: string, family: ChainFamily): Promise<WalletDoc | null>`, `findAllForUser(userId: string): Promise<WalletDoc[]>`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/data/repositories/users-repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { UsersRepository } from "./users-repository";

const baseUser = {
  firebaseUid: "fb-1",
  username: "alice",
  email: "alice@example.com",
  preferences: { defaultChain: { test: "ethereum-sepolia", main: "ethereum-mainnet" }, displayCurrency: "USD" },
  status: "active" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("UsersRepository", () => {
  it("findByFirebaseUid finds an inserted user", async () => {
    const repo = new UsersRepository();
    await repo.insertOne(baseUser);
    const found = await repo.findByFirebaseUid("fb-1");
    expect(found?.username).toBe("alice");
  });

  it("findByUsername finds an inserted user", async () => {
    const repo = new UsersRepository();
    await repo.insertOne(baseUser);
    const found = await repo.findByUsername("alice");
    expect(found?.firebaseUid).toBe("fb-1");
  });

  it("findByFirebaseUid returns null for an unknown uid", async () => {
    const repo = new UsersRepository();
    expect(await repo.findByFirebaseUid("nope")).toBeNull();
  });
});
```

`web/src/lib/data/repositories/wallets-repository.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd web && npx vitest run src/lib/data/repositories/users-repository.test.ts src/lib/data/repositories/wallets-repository.test.ts`
Expected: FAIL — cannot resolve the repository modules.

- [ ] **Step 3: Implement `web/src/lib/data/repositories/users-repository.ts`**

```ts
import { BaseRepository } from "../base-repository";
import type { UserDoc } from "../entities";

export class UsersRepository extends BaseRepository<UserDoc> {
  protected collectionName = "users";

  async findByFirebaseUid(uid: string): Promise<UserDoc | null> {
    return this.findOne({ firebaseUid: uid });
  }

  async findByUsername(username: string): Promise<UserDoc | null> {
    return this.findOne({ username });
  }
}
```

- [ ] **Step 4: Implement `web/src/lib/data/repositories/wallets-repository.ts`**

```ts
import { BaseRepository } from "../base-repository";
import type { WalletDoc } from "../entities";
import type { ChainFamily } from "../../config/schema";

export class WalletsRepository extends BaseRepository<WalletDoc> {
  protected collectionName = "wallets";

  async findByUserAndFamily(userId: string, family: ChainFamily): Promise<WalletDoc | null> {
    return this.findOne({ userId, family });
  }

  async findAllForUser(userId: string): Promise<WalletDoc[]> {
    return this.find({ userId });
  }
}
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd web && npx vitest run src/lib/data/repositories/users-repository.test.ts src/lib/data/repositories/wallets-repository.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/data/repositories/users-repository.ts web/src/lib/data/repositories/users-repository.test.ts web/src/lib/data/repositories/wallets-repository.ts web/src/lib/data/repositories/wallets-repository.test.ts
git commit -m "feat(data): add UsersRepository and WalletsRepository"
```

---

## Task 5: `VaultsRepository` + `VaultMembershipsRepository` + `WorkspacesRepository` + `WorkspaceMembershipsRepository`

**Files:**
- Create: `web/src/lib/data/repositories/vaults-repository.ts`
- Create: `web/src/lib/data/repositories/vault-memberships-repository.ts`
- Create: `web/src/lib/data/repositories/workspaces-repository.ts`
- Create: `web/src/lib/data/repositories/workspace-memberships-repository.ts`
- Test: `web/src/lib/data/repositories/vaults-repository.test.ts`
- Test: `web/src/lib/data/repositories/vault-memberships-repository.test.ts`
- Test: `web/src/lib/data/repositories/workspaces-repository.test.ts`

**Interfaces:**
- Consumes: from Task 2 — `BaseRepository`; from Task 3 — `VaultDoc`, `VaultMembershipDoc`, `WorkspaceDoc`, `WorkspaceMembershipDoc`.
- Produces: `class VaultsRepository extends BaseRepository<VaultDoc>` with `findByChainKey(chainKey: ChainKey): Promise<VaultDoc[]>`; `class VaultMembershipsRepository extends BaseRepository<VaultMembershipDoc>` with `findByVaultAndUser(vaultId: string, userId: string): Promise<VaultMembershipDoc | null>`, `findActiveByVault(vaultId: string): Promise<VaultMembershipDoc[]>`, `findByDriftState(): Promise<VaultMembershipDoc[]>`; `class WorkspacesRepository extends BaseRepository<WorkspaceDoc>`; `class WorkspaceMembershipsRepository extends BaseRepository<WorkspaceMembershipDoc>` with `findByWorkspace(workspaceId: string): Promise<WorkspaceMembershipDoc[]>`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/data/repositories/vaults-repository.test.ts`:

```ts
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
```

`web/src/lib/data/repositories/vault-memberships-repository.test.ts`:

```ts
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
```

`web/src/lib/data/repositories/workspaces-repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { WorkspacesRepository } from "./workspaces-repository";
import { WorkspaceMembershipsRepository } from "./workspace-memberships-repository";

describe("WorkspacesRepository + WorkspaceMembershipsRepository", () => {
  it("creates a workspace and finds its members", async () => {
    const workspaces = new WorkspacesRepository();
    const memberships = new WorkspaceMembershipsRepository();

    const ws = await workspaces.insertOne({ name: "Acme Corp", ownerUserId: "owner-1", createdAt: new Date().toISOString() });
    await memberships.insertOne({ workspaceId: String(ws._id), userId: "owner-1", role: "owner", createdAt: new Date().toISOString() });
    await memberships.insertOne({ workspaceId: String(ws._id), userId: "user-2", role: "member", createdAt: new Date().toISOString() });

    const found = await memberships.findByWorkspace(String(ws._id));
    expect(found).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd web && npx vitest run src/lib/data/repositories/vaults-repository.test.ts src/lib/data/repositories/vault-memberships-repository.test.ts src/lib/data/repositories/workspaces-repository.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `web/src/lib/data/repositories/vaults-repository.ts`**

```ts
import { BaseRepository } from "../base-repository";
import type { VaultDoc } from "../entities";
import type { ChainKey } from "../../config/schema";

export class VaultsRepository extends BaseRepository<VaultDoc> {
  protected collectionName = "vaults";

  async findByChainKey(chainKey: ChainKey): Promise<VaultDoc[]> {
    return this.find({ chainKey });
  }
}
```

- [ ] **Step 4: Implement `web/src/lib/data/repositories/vault-memberships-repository.ts`**

```ts
import { BaseRepository } from "../base-repository";
import type { VaultMembershipDoc } from "../entities";

export class VaultMembershipsRepository extends BaseRepository<VaultMembershipDoc> {
  protected collectionName = "vault_memberships";

  async findByVaultAndUser(vaultId: string, userId: string): Promise<VaultMembershipDoc | null> {
    return this.findOne({ vaultId, userId });
  }

  async findActiveByVault(vaultId: string): Promise<VaultMembershipDoc[]> {
    return this.find({ vaultId, status: "active" });
  }

  async findByDriftState(): Promise<VaultMembershipDoc[]> {
    return this.find({ onChain: { projectedAddress: "", syncState: "drift" } as VaultMembershipDoc["onChain"] } as Partial<VaultMembershipDoc>);
  }
}
```

Note on `findByDriftState`: `BaseRepository.find` takes `Partial<T>` and merges it directly into the MongoDB filter, so a nested-field query needs dot notation rather than a partial nested object (a partial `onChain` object would require an *exact* sub-document match, not a match on one nested field). Use `find`'s underlying filter shape directly via a dot-path key:

```ts
  async findByDriftState(): Promise<VaultMembershipDoc[]> {
    return this.find({ "onChain.syncState": "drift" } as unknown as Partial<VaultMembershipDoc>);
  }
```

Replace the earlier version of this method with this corrected one before running the test.

- [ ] **Step 5: Implement `web/src/lib/data/repositories/workspaces-repository.ts`**

```ts
import { BaseRepository } from "../base-repository";
import type { WorkspaceDoc } from "../entities";

export class WorkspacesRepository extends BaseRepository<WorkspaceDoc> {
  protected collectionName = "workspaces";
}
```

- [ ] **Step 6: Implement `web/src/lib/data/repositories/workspace-memberships-repository.ts`**

```ts
import { BaseRepository } from "../base-repository";
import type { WorkspaceMembershipDoc } from "../entities";

export class WorkspaceMembershipsRepository extends BaseRepository<WorkspaceMembershipDoc> {
  protected collectionName = "workspace_memberships";

  async findByWorkspace(workspaceId: string): Promise<WorkspaceMembershipDoc[]> {
    return this.find({ workspaceId });
  }
}
```

- [ ] **Step 7: Run tests — verify they pass**

Run: `cd web && npx vitest run src/lib/data/repositories/vaults-repository.test.ts src/lib/data/repositories/vault-memberships-repository.test.ts src/lib/data/repositories/workspaces-repository.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/data/repositories/vaults-repository.ts web/src/lib/data/repositories/vaults-repository.test.ts web/src/lib/data/repositories/vault-memberships-repository.ts web/src/lib/data/repositories/vault-memberships-repository.test.ts web/src/lib/data/repositories/workspaces-repository.ts web/src/lib/data/repositories/workspace-memberships-repository.ts web/src/lib/data/repositories/workspaces-repository.test.ts
git commit -m "feat(data): add Vault, VaultMembership, Workspace, WorkspaceMembership repositories"
```

---

## Task 6: `ContactsRepository` + `ActivityRepository`

**Files:**
- Create: `web/src/lib/data/repositories/contacts-repository.ts`
- Create: `web/src/lib/data/repositories/activity-repository.ts`
- Test: `web/src/lib/data/repositories/contacts-repository.test.ts`
- Test: `web/src/lib/data/repositories/activity-repository.test.ts`

**Interfaces:**
- Consumes: from Task 2 — `BaseRepository`; from Task 3 — `ContactDoc`, an `ActivityDoc` entity (add this one to `entities.ts` now — §18's `activity` block was defined but not yet added to Task 3's type list; adding it here keeps the type beside its first consumer, consistent with the "entities.ts has 7 immediate consumers" note in Task 3).
- Produces: `class ContactsRepository extends BaseRepository<ContactDoc>` with `findAllForUser(userId: string): Promise<ContactDoc[]>`; `class ActivityRepository extends BaseRepository<ActivityDoc>` with `recordForUser(userId: string, kind: string, refs: ActivityDoc["refs"], summary: string): Promise<void>`, `findRecentForUser(userId: string, limit: number): Promise<ActivityDoc[]>`.

- [ ] **Step 1: Add `ActivityDoc` to `web/src/lib/data/entities.ts`**

Append this interface to the file (after `ProviderRuntimeDoc`):

```ts
export interface ActivityDoc {
  _id?: ObjectId;
  userId?: string;
  kind: string;
  refs: { intentId?: string; membershipId?: string; txRef?: string };
  summary: string;
  at: string;
  environment?: NetworkClass;
}
```

- [ ] **Step 2: Write the failing tests**

`web/src/lib/data/repositories/contacts-repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ContactsRepository } from "./contacts-repository";

describe("ContactsRepository", () => {
  it("findAllForUser returns only that user's contacts", async () => {
    const repo = new ContactsRepository();
    await repo.insertOne({ userId: "user-1", alias: "Maya", target: { kind: "username", value: "@maya" }, createdAt: new Date().toISOString() });
    await repo.insertOne({ userId: "user-2", alias: "Bob", target: { kind: "username", value: "@bob" }, createdAt: new Date().toISOString() });

    const found = await repo.findAllForUser("user-1");
    expect(found).toHaveLength(1);
    expect(found[0].alias).toBe("Maya");
  });
});
```

`web/src/lib/data/repositories/activity-repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ActivityRepository } from "./activity-repository";

describe("ActivityRepository", () => {
  it("recordForUser inserts an entry findable via findRecentForUser", async () => {
    const repo = new ActivityRepository();
    await repo.recordForUser("user-1", "transfer_settled", { intentId: "intent-1" }, "Sent 10 USDC to @maya");

    const recent = await repo.findRecentForUser("user-1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].kind).toBe("transfer_settled");
    expect(recent[0].summary).toBe("Sent 10 USDC to @maya");
  });

  it("findRecentForUser respects the limit and excludes other users", async () => {
    const repo = new ActivityRepository();
    await repo.recordForUser("user-1", "a", {}, "first");
    await repo.recordForUser("user-1", "b", {}, "second");
    await repo.recordForUser("user-2", "c", {}, "other user");

    const recent = await repo.findRecentForUser("user-1", 1);
    expect(recent).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

Run: `cd web && npx vitest run src/lib/data/repositories/contacts-repository.test.ts src/lib/data/repositories/activity-repository.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 4: Implement `web/src/lib/data/repositories/contacts-repository.ts`**

```ts
import { BaseRepository } from "../base-repository";
import type { ContactDoc } from "../entities";

export class ContactsRepository extends BaseRepository<ContactDoc> {
  protected collectionName = "contacts";

  async findAllForUser(userId: string): Promise<ContactDoc[]> {
    return this.find({ userId });
  }
}
```

- [ ] **Step 5: Implement `web/src/lib/data/repositories/activity-repository.ts`**

```ts
import { getDb } from "../client";
import { BaseRepository } from "../base-repository";
import type { ActivityDoc } from "../entities";
import { getActiveProfile } from "../../config/registry";

export class ActivityRepository extends BaseRepository<ActivityDoc> {
  protected collectionName = "activity";

  async recordForUser(
    userId: string,
    kind: string,
    refs: ActivityDoc["refs"],
    summary: string,
  ): Promise<void> {
    await this.insertOne({ userId, kind, refs, summary, at: new Date().toISOString() });
  }

  async findRecentForUser(userId: string, limit: number): Promise<ActivityDoc[]> {
    const db = await getDb();
    const col = db.collection<ActivityDoc>(this.collectionName);
    return col
      .find({ userId, environment: getActiveProfile().networkClass })
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
  }
}
```

- [ ] **Step 6: Run tests — verify they pass**

Run: `cd web && npx vitest run src/lib/data/repositories/contacts-repository.test.ts src/lib/data/repositories/activity-repository.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/data/entities.ts web/src/lib/data/repositories/contacts-repository.ts web/src/lib/data/repositories/contacts-repository.test.ts web/src/lib/data/repositories/activity-repository.ts web/src/lib/data/repositories/activity-repository.test.ts
git commit -m "feat(data): add ContactsRepository and ActivityRepository"
```

---

## Task 7: `PortfolioCacheRepository`

**Files:**
- Create: `web/src/lib/data/repositories/portfolio-cache-repository.ts`
- Test: `web/src/lib/data/repositories/portfolio-cache-repository.test.ts`

**Interfaces:**
- Consumes: from Task 2 — `BaseRepository`; from Task 3 — `PortfolioCacheDoc`.
- Produces: `class PortfolioCacheRepository extends BaseRepository<PortfolioCacheDoc>` with `findByWalletAndChain(walletId: string, chainKey: ChainKey): Promise<PortfolioCacheDoc | null>`, `upsertForWalletAndChain(walletId: string, chainKey: ChainKey, doc: Omit<PortfolioCacheDoc, "_id" | "walletId" | "chainKey">): Promise<void>`.

- [ ] **Step 1: Write the failing test — `web/src/lib/data/repositories/portfolio-cache-repository.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { PortfolioCacheRepository } from "./portfolio-cache-repository";

describe("PortfolioCacheRepository", () => {
  it("upsertForWalletAndChain creates a new entry when none exists", async () => {
    const repo = new PortfolioCacheRepository();
    await repo.upsertForWalletAndChain("wallet-1", "arbitrum-sepolia", {
      userId: "user-1",
      assets: [],
      syncedAt: new Date().toISOString(),
      syncStatus: "fresh",
      source: "rpc",
    });

    const found = await repo.findByWalletAndChain("wallet-1", "arbitrum-sepolia");
    expect(found?.syncStatus).toBe("fresh");
  });

  it("upsertForWalletAndChain replaces the existing entry rather than duplicating", async () => {
    const repo = new PortfolioCacheRepository();
    await repo.upsertForWalletAndChain("wallet-1", "arbitrum-sepolia", {
      userId: "user-1",
      assets: [],
      syncedAt: new Date().toISOString(),
      syncStatus: "fresh",
      source: "rpc",
    });
    await repo.upsertForWalletAndChain("wallet-1", "arbitrum-sepolia", {
      userId: "user-1",
      assets: [],
      syncedAt: new Date().toISOString(),
      syncStatus: "stale",
      source: "rpc",
    });

    const all = await repo.find({ walletId: "wallet-1" });
    expect(all).toHaveLength(1);
    expect(all[0].syncStatus).toBe("stale");
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd web && npx vitest run src/lib/data/repositories/portfolio-cache-repository.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `web/src/lib/data/repositories/portfolio-cache-repository.ts`**

```ts
import { getDb } from "../client";
import { BaseRepository } from "../base-repository";
import type { PortfolioCacheDoc } from "../entities";
import type { ChainKey } from "../../config/schema";
import { getActiveProfile } from "../../config/registry";

export class PortfolioCacheRepository extends BaseRepository<PortfolioCacheDoc> {
  protected collectionName = "portfolio_cache";

  async findByWalletAndChain(walletId: string, chainKey: ChainKey): Promise<PortfolioCacheDoc | null> {
    return this.findOne({ walletId, chainKey });
  }

  async upsertForWalletAndChain(
    walletId: string,
    chainKey: ChainKey,
    doc: Omit<PortfolioCacheDoc, "_id" | "walletId" | "chainKey" | "environment">,
  ): Promise<void> {
    const db = await getDb();
    const col = db.collection<PortfolioCacheDoc>(this.collectionName);
    await col.updateOne(
      { walletId, chainKey, environment: getActiveProfile().networkClass },
      { $set: { ...doc, walletId, chainKey, environment: getActiveProfile().networkClass } },
      { upsert: true },
    );
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd web && npx vitest run src/lib/data/repositories/portfolio-cache-repository.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/data/repositories/portfolio-cache-repository.ts web/src/lib/data/repositories/portfolio-cache-repository.test.ts
git commit -m "feat(data): add PortfolioCacheRepository with upsert semantics"
```

---

## Task 8: `TransferIntentsRepository` + `TransferLegsRepository`

**Files:**
- Create: `web/src/lib/data/repositories/transfer-intents-repository.ts`
- Create: `web/src/lib/data/repositories/transfer-legs-repository.ts`
- Test: `web/src/lib/data/repositories/transfer-intents-repository.test.ts`
- Test: `web/src/lib/data/repositories/transfer-legs-repository.test.ts`

**Interfaces:**
- Consumes: from Task 2 — `BaseRepository`; from Task 3 — `TransferIntentDoc`, `TransferLegDoc`.
- Produces: `class TransferIntentsRepository extends BaseRepository<TransferIntentDoc>` with `findByIdempotencyKey(key: string): Promise<TransferIntentDoc | null>`, `findRecentForUser(userId: string, limit: number): Promise<TransferIntentDoc[]>`; `class TransferLegsRepository extends BaseRepository<TransferLegDoc>` with `findByIntent(intentId: string): Promise<TransferLegDoc[]>` (sorted by `seq`), `findDueForJanitorScan(beforeDeadline: string): Promise<TransferLegDoc[]>` (status `submitted` and `deadlineAt < beforeDeadline`, per §15.3's janitor re-poll).

- [ ] **Step 1: Write the failing tests**

`web/src/lib/data/repositories/transfer-intents-repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TransferIntentsRepository } from "./transfer-intents-repository";

const baseIntent = {
  userId: "user-1",
  kind: "transfer" as const,
  recipient: { kind: "username" as const, value: "@maya", resolvedAddress: "0xMAYA", chainKey: "arbitrum-sepolia" as const },
  asset: { assetKey: "arbitrum-sepolia:native", amountRaw: "1000000000000000000" },
  sourceChainKey: "arbitrum-sepolia" as const,
  quote: { fees: "0", eta: 30, legPlan: ["leg-1"] },
  status: "draft" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("TransferIntentsRepository", () => {
  it("findByIdempotencyKey finds the matching intent", async () => {
    const repo = new TransferIntentsRepository();
    await repo.insertOne({ ...baseIntent, idempotencyKey: "idem-1" });
    const found = await repo.findByIdempotencyKey("idem-1");
    expect(found?.userId).toBe("user-1");
  });

  it("findRecentForUser respects the limit", async () => {
    const repo = new TransferIntentsRepository();
    await repo.insertOne({ ...baseIntent, idempotencyKey: "idem-1" });
    await repo.insertOne({ ...baseIntent, idempotencyKey: "idem-2" });
    const found = await repo.findRecentForUser("user-1", 1);
    expect(found).toHaveLength(1);
  });
});
```

`web/src/lib/data/repositories/transfer-legs-repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TransferLegsRepository } from "./transfer-legs-repository";

const baseLeg = {
  intentId: "intent-1",
  kind: "same_chain" as const,
  fromChainKey: "arbitrum-sepolia" as const,
  toChainKey: "arbitrum-sepolia" as const,
  provider: "evm-rpc" as const,
  status: "pending" as const,
  attempts: 0,
  deadlineAt: new Date(Date.now() + 60_000).toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("TransferLegsRepository", () => {
  it("findByIntent returns legs sorted by seq", async () => {
    const repo = new TransferLegsRepository();
    await repo.insertOne({ ...baseLeg, seq: 2 });
    await repo.insertOne({ ...baseLeg, seq: 1 });

    const legs = await repo.findByIntent("intent-1");
    expect(legs.map((l) => l.seq)).toEqual([1, 2]);
  });

  it("findDueForJanitorScan finds submitted legs past their deadline", async () => {
    const repo = new TransferLegsRepository();
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 1000_000).toISOString();

    await repo.insertOne({ ...baseLeg, seq: 1, status: "submitted", deadlineAt: past });
    await repo.insertOne({ ...baseLeg, seq: 2, status: "submitted", deadlineAt: future });
    await repo.insertOne({ ...baseLeg, seq: 3, status: "confirmed", deadlineAt: past });

    const due = await repo.findDueForJanitorScan(new Date().toISOString());
    expect(due).toHaveLength(1);
    expect(due[0].seq).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd web && npx vitest run src/lib/data/repositories/transfer-intents-repository.test.ts src/lib/data/repositories/transfer-legs-repository.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `web/src/lib/data/repositories/transfer-intents-repository.ts`**

```ts
import { getDb } from "../client";
import { BaseRepository } from "../base-repository";
import type { TransferIntentDoc } from "../entities";
import { getActiveProfile } from "../../config/registry";

export class TransferIntentsRepository extends BaseRepository<TransferIntentDoc> {
  protected collectionName = "transfer_intents";

  async findByIdempotencyKey(key: string): Promise<TransferIntentDoc | null> {
    return this.findOne({ idempotencyKey: key });
  }

  async findRecentForUser(userId: string, limit: number): Promise<TransferIntentDoc[]> {
    const db = await getDb();
    const col = db.collection<TransferIntentDoc>(this.collectionName);
    return col
      .find({ userId, environment: getActiveProfile().networkClass })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}
```

- [ ] **Step 4: Implement `web/src/lib/data/repositories/transfer-legs-repository.ts`**

```ts
import { getDb } from "../client";
import { BaseRepository } from "../base-repository";
import type { TransferLegDoc } from "../entities";
import { getActiveProfile } from "../../config/registry";

export class TransferLegsRepository extends BaseRepository<TransferLegDoc> {
  protected collectionName = "transfer_legs";

  async findByIntent(intentId: string): Promise<TransferLegDoc[]> {
    const db = await getDb();
    const col = db.collection<TransferLegDoc>(this.collectionName);
    return col
      .find({ intentId, environment: getActiveProfile().networkClass })
      .sort({ seq: 1 })
      .toArray();
  }

  async findDueForJanitorScan(beforeDeadline: string): Promise<TransferLegDoc[]> {
    const db = await getDb();
    const col = db.collection<TransferLegDoc>(this.collectionName);
    return col
      .find({
        status: "submitted",
        deadlineAt: { $lt: beforeDeadline },
        environment: getActiveProfile().networkClass,
      })
      .toArray();
  }
}
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd web && npx vitest run src/lib/data/repositories/transfer-intents-repository.test.ts src/lib/data/repositories/transfer-legs-repository.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/data/repositories/transfer-intents-repository.ts web/src/lib/data/repositories/transfer-intents-repository.test.ts web/src/lib/data/repositories/transfer-legs-repository.ts web/src/lib/data/repositories/transfer-legs-repository.test.ts
git commit -m "feat(data): add TransferIntentsRepository and TransferLegsRepository"
```

---

## Task 9: `PaymasterQuotasRepository` + `RegistryOverridesRepository` + `ProviderRuntimeRepository`

**Files:**
- Create: `web/src/lib/data/repositories/paymaster-quotas-repository.ts`
- Create: `web/src/lib/data/repositories/registry-overrides-repository.ts`
- Create: `web/src/lib/data/repositories/provider-runtime-repository.ts`
- Test: `web/src/lib/data/repositories/paymaster-quotas-repository.test.ts`
- Test: `web/src/lib/data/repositories/registry-overrides-repository.test.ts`
- Test: `web/src/lib/data/repositories/provider-runtime-repository.test.ts`

**Interfaces:**
- Consumes: from Task 2 — `BaseRepository`; from Task 3 — `PaymasterQuotaDoc`, `RegistryOverrideDoc`, `ProviderRuntimeDoc`.
- Produces: `class PaymasterQuotasRepository extends BaseRepository<PaymasterQuotaDoc>` with `findByUserAndWindow(userId: string, windowStart: string): Promise<PaymasterQuotaDoc | null>`; `class RegistryOverridesRepository` (does **not** extend `BaseRepository` — this collection is explicitly environment-agnostic per §18's ops-config note) with `findActiveByScope(scope: "chain" | "provider", key: string): Promise<RegistryOverrideDoc[]>` (excludes expired: `expiresAt` unset or in the future); `class ProviderRuntimeRepository` (also environment-agnostic) with `findByProviderKey(key: ProviderKey): Promise<ProviderRuntimeDoc | null>`, `upsertStatus(key: ProviderKey, status: ProviderRuntimeDoc["status"], notes?: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/data/repositories/paymaster-quotas-repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PaymasterQuotasRepository } from "./paymaster-quotas-repository";

describe("PaymasterQuotasRepository", () => {
  it("findByUserAndWindow finds the matching quota window", async () => {
    const repo = new PaymasterQuotasRepository();
    const windowStart = "2026-07-01T00:00:00.000Z";
    await repo.insertOne({ userId: "user-1", windowStart, sponsoredOps: 3, gasSpendWei: "1000", tier: "capped" });
    const found = await repo.findByUserAndWindow("user-1", windowStart);
    expect(found?.sponsoredOps).toBe(3);
  });
});
```

`web/src/lib/data/repositories/registry-overrides-repository.test.ts`:

```ts
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
```

`web/src/lib/data/repositories/provider-runtime-repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ProviderRuntimeRepository } from "./provider-runtime-repository";

describe("ProviderRuntimeRepository", () => {
  it("upsertStatus creates then updates a single record per provider", async () => {
    const repo = new ProviderRuntimeRepository();
    await repo.upsertStatus("magic", "active");
    await repo.upsertStatus("magic", "degraded", "elevated latency");

    const found = await repo.findByProviderKey("magic");
    expect(found?.status).toBe("degraded");
    expect(found?.notes).toBe("elevated latency");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd web && npx vitest run src/lib/data/repositories/paymaster-quotas-repository.test.ts src/lib/data/repositories/registry-overrides-repository.test.ts src/lib/data/repositories/provider-runtime-repository.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `web/src/lib/data/repositories/paymaster-quotas-repository.ts`**

```ts
import { BaseRepository } from "../base-repository";
import type { PaymasterQuotaDoc } from "../entities";

export class PaymasterQuotasRepository extends BaseRepository<PaymasterQuotaDoc> {
  protected collectionName = "paymaster_quotas";

  async findByUserAndWindow(userId: string, windowStart: string): Promise<PaymasterQuotaDoc | null> {
    return this.findOne({ userId, windowStart });
  }
}
```

- [ ] **Step 4: Implement `web/src/lib/data/repositories/registry-overrides-repository.ts`**

```ts
import { getDb } from "../client";
import type { RegistryOverrideDoc } from "../entities";

// Environment-agnostic (ops config applies across environments) — does not
// extend BaseRepository, unlike every other repository in this plan.
export class RegistryOverridesRepository {
  private readonly collectionName = "registry_overrides";

  private async collection() {
    const db = await getDb();
    return db.collection<RegistryOverrideDoc>(this.collectionName);
  }

  async insertOne(doc: RegistryOverrideDoc): Promise<void> {
    const col = await this.collection();
    await col.insertOne(doc);
  }

  async findActiveByScope(scope: "chain" | "provider", key: string): Promise<RegistryOverrideDoc[]> {
    const col = await this.collection();
    const now = new Date().toISOString();
    return col
      .find({
        scope,
        key,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
      })
      .toArray();
  }
}
```

- [ ] **Step 5: Implement `web/src/lib/data/repositories/provider-runtime-repository.ts`**

```ts
import { getDb } from "../client";
import type { ProviderRuntimeDoc } from "../entities";
import type { ProviderKey } from "../../config/schema";

// Environment-agnostic (provider health is a global ops signal) — does not
// extend BaseRepository, unlike every other repository in this plan.
export class ProviderRuntimeRepository {
  private readonly collectionName = "provider_runtime";

  private async collection() {
    const db = await getDb();
    return db.collection<ProviderRuntimeDoc>(this.collectionName);
  }

  async findByProviderKey(key: ProviderKey): Promise<ProviderRuntimeDoc | null> {
    const col = await this.collection();
    return col.findOne({ providerKey: key });
  }

  async upsertStatus(key: ProviderKey, status: ProviderRuntimeDoc["status"], notes?: string): Promise<void> {
    const col = await this.collection();
    await col.updateOne(
      { providerKey: key },
      { $set: { providerKey: key, status, notes, lastCheckAt: new Date().toISOString() } },
      { upsert: true },
    );
  }
}
```

- [ ] **Step 6: Run tests — verify they pass**

Run: `cd web && npx vitest run src/lib/data/repositories/paymaster-quotas-repository.test.ts src/lib/data/repositories/registry-overrides-repository.test.ts src/lib/data/repositories/provider-runtime-repository.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full data-layer suite + typecheck**

Run:
```bash
cd web && npx vitest run src/lib/data
cd web && npx tsc --noEmit
```
Expected: all data-layer tests PASS (30 tests across this plan); `tsc` reports zero errors.

- [ ] **Step 8: Add `MONGODB_URI` to the documented env vars**

In `web/CLAUDE.md`, find the "Conventions" section's env var list (currently starts with `Env vars (never commit): DATABASE_URL, PINATA_JWT, ZERODEV_PROJECT_ID, ...`) and add `MONGODB_URI` to that comma-separated list.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/data/repositories/paymaster-quotas-repository.ts web/src/lib/data/repositories/paymaster-quotas-repository.test.ts web/src/lib/data/repositories/registry-overrides-repository.ts web/src/lib/data/repositories/registry-overrides-repository.test.ts web/src/lib/data/repositories/provider-runtime-repository.ts web/src/lib/data/repositories/provider-runtime-repository.test.ts web/CLAUDE.md
git commit -m "feat(data): add PaymasterQuotas, RegistryOverrides, ProviderRuntime repositories"
```

---

## Self-Review

**Spec coverage (against Planning.md §18):**
- All 14 schema'd collections implemented: `users`, `wallets`, `vaults`, `vault_memberships`, `workspaces`, `workspace_memberships`, `contacts`, `portfolio_cache`, `transfer_intents`, `transfer_legs`, `activity`, `paymaster_quotas`, `registry_overrides`, `provider_runtime`. ✅
- `fund_requests`/`invoices`/`transactions` explicitly deferred with reasoning in Global Constraints (no schema block in §18, no current consumer). ✅
- Environment-scoping enforcement (§4.2 "repository level") → Task 2 `BaseRepository`, proven by 4 dedicated cross-environment-isolation tests, then relied on implicitly by every subsequent repository. ✅
- `registry_overrides`/`provider_runtime` correctly environment-agnostic (§18 doesn't list `environment` in either's field set) → Task 9, explicitly does NOT extend `BaseRepository`. ✅
- Write concern majority for identity/membership/saga collections (§22.5) — **gap found during self-review**: no task actually configures write concern. Adding as an explicit note below rather than silently deferring.
- Unique indexes (`idempotencyKey`, `(userId,family,environment)`, etc.) — **gap found during self-review**: no task creates MongoDB indexes at all. Adding as an explicit note below.

**Gaps found and resolved:**
1. **Write concern and indexes are declared in `Planning.md` §18 but no task in this plan creates them.** This is a real omission, not a deliberate scope cut (unlike `fund_requests`/`invoices`/`transactions`, which had an explicit rationale). Fix: add Task 10.

- [ ] **Task 10: Indexes and write concern**

**Files:**
- Create: `web/src/lib/data/ensure-indexes.ts`
- Modify: `web/src/lib/data/base-repository.ts` (write concern for the 6 §22.5 collections)
- Test: `web/src/lib/data/ensure-indexes.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `getDb`.
- Produces: `async function ensureIndexes(): Promise<void>` — idempotent, creates every index §18 lists; called once at application boot (not per-request).

- [ ] **Step 1: Write the failing test — `web/src/lib/data/ensure-indexes.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ensureIndexes } from "./ensure-indexes";
import { getDb } from "./client";

describe("ensureIndexes", () => {
  it("creates the unique index on users.firebaseUid", async () => {
    await ensureIndexes();
    const db = await getDb();
    const indexes = await db.collection("users").indexes();
    const uidIndex = indexes.find((i) => i.key.firebaseUid === 1);
    expect(uidIndex?.unique).toBe(true);
  });

  it("creates the unique compound index on wallets (userId, family, environment)", async () => {
    await ensureIndexes();
    const db = await getDb();
    const indexes = await db.collection("wallets").indexes();
    const compound = indexes.find((i) => i.key.userId === 1 && i.key.family === 1 && i.key.environment === 1);
    expect(compound?.unique).toBe(true);
  });

  it("is idempotent — running twice does not throw", async () => {
    await ensureIndexes();
    await expect(ensureIndexes()).resolves.not.toThrow();
  });

  it("creates the unique index on transfer_intents.idempotencyKey", async () => {
    await ensureIndexes();
    const db = await getDb();
    const indexes = await db.collection("transfer_intents").indexes();
    const idemIndex = indexes.find((i) => i.key.idempotencyKey === 1);
    expect(idemIndex?.unique).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd web && npx vitest run src/lib/data/ensure-indexes.test.ts`
Expected: FAIL — cannot resolve `./ensure-indexes`.

- [ ] **Step 3: Implement `web/src/lib/data/ensure-indexes.ts`**

```ts
import { getDb } from "./client";

export async function ensureIndexes(): Promise<void> {
  const db = await getDb();

  await db.collection("users").createIndex({ firebaseUid: 1 }, { unique: true });
  await db.collection("users").createIndex({ username: 1 }, { unique: true });

  await db.collection("wallets").createIndex({ userId: 1, family: 1, environment: 1 }, { unique: true });
  await db.collection("wallets").createIndex({ environment: 1, address: 1 });

  await db.collection("vault_memberships").createIndex({ vaultId: 1, userId: 1 }, { unique: true });
  await db.collection("vault_memberships").createIndex({ userId: 1, environment: 1 });
  await db.collection("vault_memberships").createIndex({ "onChain.syncState": 1 });

  await db.collection("portfolio_cache").createIndex({ walletId: 1, chainKey: 1 }, { unique: true });
  await db.collection("portfolio_cache").createIndex({ userId: 1, environment: 1 });
  await db.collection("portfolio_cache").createIndex({ syncedAt: 1 });

  await db.collection("transfer_intents").createIndex({ idempotencyKey: 1 }, { unique: true });
  await db.collection("transfer_intents").createIndex({ userId: 1, environment: 1, createdAt: -1 });
  await db.collection("transfer_intents").createIndex({ status: 1 });

  await db.collection("transfer_legs").createIndex({ intentId: 1, seq: 1 }, { unique: true });
  await db.collection("transfer_legs").createIndex({ status: 1, deadlineAt: 1 });

  await db.collection("activity").createIndex({ userId: 1, environment: 1, at: -1 });
  await db.collection("activity").createIndex({ kind: 1, at: -1 });

  await db.collection("paymaster_quotas").createIndex({ userId: 1, environment: 1, windowStart: 1 }, { unique: true });
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd web && npx vitest run src/lib/data/ensure-indexes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add write concern for §22.5 collections in `web/src/lib/data/base-repository.ts`**

Modify the `collection()` method to accept a per-repository write-concern flag, set by the six collections §22.5 names:

```ts
export abstract class BaseRepository<T extends { environment?: string }> {
  protected abstract collectionName: string;
  protected majorityWriteConcern = false;

  private async collection() {
    const db = await getDb();
    const col = db.collection<T>(this.collectionName);
    return this.majorityWriteConcern ? col.withWriteConcern({ w: "majority" }) : col;
  }

  // ... rest of the class unchanged
```

Then set `protected majorityWriteConcern = true;` in the class bodies of: `UsersRepository`, `WalletsRepository`, `VaultsRepository`, `VaultMembershipsRepository`, `TransferIntentsRepository`, `TransferLegsRepository` (the six §22.5 collections). Add one line to each of those six repository files, directly under `protected collectionName = "...";`.

- [ ] **Step 6: Run the full data-layer suite once more**

Run: `cd web && npx vitest run src/lib/data`
Expected: PASS (all 34 tests — 30 from Tasks 1–9 plus 4 from Task 10; write-concern change is structural and doesn't add new assertions, `mongodb-memory-server` accepts `w: "majority"` as a no-op single-node acknowledgment).

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/data/ensure-indexes.ts web/src/lib/data/ensure-indexes.test.ts web/src/lib/data/base-repository.ts web/src/lib/data/repositories/users-repository.ts web/src/lib/data/repositories/wallets-repository.ts web/src/lib/data/repositories/vaults-repository.ts web/src/lib/data/repositories/vault-memberships-repository.ts web/src/lib/data/repositories/transfer-intents-repository.ts web/src/lib/data/repositories/transfer-legs-repository.ts
git commit -m "feat(data): add index creation and majority write concern per §18/§22.5"
```

2. **`entities.ts`'s `ActivityDoc` was originally missing from Task 3's type list** (§18 defines it, Task 3's produces-list omitted it) — caught and fixed inline by moving it into Task 6 where it's first consumed, with an explicit note explaining the placement. No dangling reference remains: grep confirms `ActivityDoc` is defined exactly once (Task 6, Step 1) and imported only by `activity-repository.ts`.

**Placeholder scan:** No TBD/TODO; every step shows complete file contents; the `findByDriftState` dot-notation correction in Task 5 is shown as a real fix with the corrected code, not a "handle this properly" placeholder. ✅

**Type consistency:** `UserDoc`/`WalletDoc`/etc. defined once in Task 3 (plus `ActivityDoc` in Task 6), imported unchanged by every repository. `BaseRepository<T extends { environment?: string }>` generic constraint is satisfied by every entity (all have `environment?: NetworkClass`). Repository class names match the roadmap's collection names exactly (`vault_memberships` → `VaultMembershipsRepository`, not `VaultMembersRepository` or similar drift). ✅

**Scope:** Single subsystem (Data Layer only) — zero domain-service logic, zero adapter/port dependencies beyond Plan 1's registry facade for environment resolution. Every repository is independently testable via `mongodb-memory-server`, no live Atlas cluster required to develop or CI this plan. ✅
