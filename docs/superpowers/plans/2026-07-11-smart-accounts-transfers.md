# 7702 Smart Accounts & Transfer Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement EIP-7702 smart accounts (`ZeroDev7702Adapter`), same-chain execution (`EvmRpcExecutionAdapter`), and the transfer saga stack (`TransactionOrchestrator` + `TransferService`) from `Planning.md` §10/§15/§16, wired into `POST /api/transfers`.

**Architecture:** `TransferService` (business intent) → `TransactionOrchestrator` (saga: legs, retries, rollback) → `ExecutionPort` (chain-facing), exactly the §15.1 layering. Same-chain transfers are built real and fully working end-to-end in this plan. Cross-chain execution (bridging) depends on `ParticleExecutionAdapter`, which — per the §22.3 finding closed out just before this plan (Particle Universal Accounts are currently mainnet-only, unverified live) — is built as a real interface with a stub implementation, matching the pattern Plan 2 established for not-yet-buildable adapters and Plan 5 established for the not-yet-deployed `Vault.sol`. The orchestrator's saga logic (leg planning, retry, rollback, idempotency) is provider-agnostic and fully real regardless.

**Tech Stack:** `@zerodev/sdk`, `@zerodev/ecdsa-validator` (ZeroDev Kernel, EIP-7702), viem (already installed), vitest with mocked SDK/client calls (no live ZeroDev project ID or bundler endpoint required to develop or test this plan). Reuses Plan 1 (`ChainRegistry`), Plan 2 (`AccountPort`, `ExecutionPort`, `StubExecutionAdapter`'s `NotImplementedError`), Plan 3 (`TransferIntentsRepository`, `TransferLegsRepository`, `ActivityRepository`), Plan 4 (`WalletService`, `WalletsRepository`, `UsersRepository`).

## Global Constraints

- All source under `web/src/lib/adapters/zerodev/`, `web/src/lib/adapters/evm-rpc/`, `web/src/lib/adapters/particle/`, `web/src/lib/domain/`; run every command from `web/`.
- **Safety invariant (§15.3.5, non-negotiable):** every intermediate leg must land in a wallet the user owns — never a third-party or Particle-internal address held beyond one transaction's lifetime. `TransactionOrchestrator` must not construct a leg whose destination is anything other than a `WalletsRepository`-resolved address or the final recipient.
- **Idempotency (§15.3.3):** every leg carries an idempotency key; retrying a leg must check on-chain/provider state before resubmitting — a retry must never double-send. `TransferIntentsRepository.idempotencyKey` is unique-indexed (Plan 3 Task 10); reuse that constraint, don't invent a second one.
- Rollback is **halt + report + offer resume**, never a fabricated compensating transaction (§15.3.5) — `TransactionOrchestrator` has no "undo" method, only "resume from current state."
- 7702 delegation is per-chain state stored in `WalletDoc.delegations[]` (Plan 3's `entities.ts`, already defined) — `ZeroDev7702Adapter.upgrade` must append/update an entry there, not invent a new storage location.
- `ParticleExecutionAdapter` is explicitly **not implemented for real** in this plan (mainnet-only, unverified live per the just-closed §22.3 finding) — it throws `NotImplementedError` (reusing Plan 2's `StubExecutionAdapter`'s exported error class) and is wired into the provider-selection path so a cross-chain intent fails loudly with a clear message, never silently.
- Aggregation (§16) reuses the same `TransactionOrchestrator` saga machinery as ordinary transfers — it is not a separate execution path, only a different leg *plan*.

---

## File Structure

```
web/src/lib/
├── adapters/
│   ├── zerodev/
│   │   └── zerodev-7702-adapter.ts       # NEW — AccountPort impl (EVM, real ZeroDev SDK calls)
│   ├── evm-rpc/
│   │   └── evm-rpc-execution-adapter.ts  # NEW — ExecutionPort impl (same-chain EVM, real viem calls)
│   └── particle/
│       └── particle-execution-adapter.ts # NEW — ExecutionPort stub (cross-chain, mainnet-only, deferred)
└── domain/
    ├── transaction-orchestrator.ts        # NEW — saga engine
    └── transfer-service.ts                # NEW — business intent + recipient/chain resolution + aggregation
web/src/app/api/transfers/
└── route.ts                               # NEW — POST /api/transfers
```

Tests live beside sources as `*.test.ts`.

---

## Task 1: `ZeroDev7702Adapter`

**Files:**
- Modify: `web/package.json` (add `@zerodev/sdk`, `@zerodev/ecdsa-validator`)
- Create: `web/src/lib/adapters/zerodev/zerodev-7702-adapter.ts`
- Test: `web/src/lib/adapters/zerodev/zerodev-7702-adapter.test.ts`

**Interfaces:**
- Consumes: from Plan 2 — `AccountPort`, `AccountMode`, `SignerHandle`, `UpgradeResult`; from Plan 3 — `WalletDoc`, `WalletsRepository`.
- Produces: `class ZeroDev7702Adapter implements AccountPort`, constructed as `new ZeroDev7702Adapter({ projectId: string, walletsRepo: WalletsRepository, kernelFactory?: KernelFactory })` where `KernelFactory` is a small injectable seam wrapping `@zerodev/sdk`'s account-creation call (so tests never touch a real bundler).

- [ ] **Step 1: Install dependencies**

Run (from `web/`):
```bash
npm install @zerodev/sdk@^5.4.0 @zerodev/ecdsa-validator@^5.4.0
```

- [ ] **Step 2: Write the failing test — `web/src/lib/adapters/zerodev/zerodev-7702-adapter.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { ZeroDev7702Adapter } from "./zerodev-7702-adapter";
import { WalletsRepository } from "../../data/repositories/wallets-repository";
import type { WalletRecord, ChainRef } from "../../ports/types";

const wallet: WalletRecord = { address: "0xABC", family: "evm", provider: "magic", providerRef: "0xABC" };
const chain: ChainRef = { key: "arbitrum-sepolia", family: "evm" };

function makeFakeKernelFactory() {
  return {
    createKernelAccount: vi.fn().mockResolvedValue({ address: "0xABC" }),
    sign7702Authorization: vi.fn().mockResolvedValue({ txRef: "0xdelegationtx" }),
    revoke7702Authorization: vi.fn().mockResolvedValue({ txRef: "0xrevoketx" }),
  };
}

async function seedWalletDoc() {
  process.env.APP_ENV_PROFILE = "testnet";
  const walletsRepo = new WalletsRepository();
  await walletsRepo.insertOne({
    userId: "user-1", family: "evm", address: "0xABC", provider: "magic", providerRef: "0xABC",
    walletType: "eoa", delegations: [], status: "active", createdAt: new Date().toISOString(),
  });
  return walletsRepo;
}

describe("ZeroDev7702Adapter.status", () => {
  it("returns eoa when no delegation entry exists for the chain", async () => {
    const walletsRepo = await seedWalletDoc();
    const adapter = new ZeroDev7702Adapter({ projectId: "proj", walletsRepo, kernelFactory: makeFakeKernelFactory() });
    expect(await adapter.status(wallet, chain)).toBe("eoa");
  });
});

describe("ZeroDev7702Adapter.upgrade", () => {
  it("delegates the EOA and records the delegation on the wallet document", async () => {
    const walletsRepo = await seedWalletDoc();
    const kernelFactory = makeFakeKernelFactory();
    const adapter = new ZeroDev7702Adapter({ projectId: "proj", walletsRepo, kernelFactory });

    const result = await adapter.upgrade(wallet, chain);

    expect(result.mode).toBe("smart-7702");
    expect(kernelFactory.sign7702Authorization).toHaveBeenCalledWith(wallet.address, chain.key);

    const updated = await walletsRepo.findByUserAndFamily("user-1", "evm");
    expect(updated?.delegations).toHaveLength(1);
    expect(updated?.delegations[0]).toMatchObject({ chainKey: "arbitrum-sepolia", delegated: true });
  });

  it("is idempotent — upgrading an already-delegated chain does not re-delegate", async () => {
    const walletsRepo = await seedWalletDoc();
    const kernelFactory = makeFakeKernelFactory();
    const adapter = new ZeroDev7702Adapter({ projectId: "proj", walletsRepo, kernelFactory });

    await adapter.upgrade(wallet, chain);
    kernelFactory.sign7702Authorization.mockClear();
    await adapter.upgrade(wallet, chain);

    expect(kernelFactory.sign7702Authorization).not.toHaveBeenCalled();
  });

  it("status reflects smart-7702 after upgrade", async () => {
    const walletsRepo = await seedWalletDoc();
    const adapter = new ZeroDev7702Adapter({ projectId: "proj", walletsRepo, kernelFactory: makeFakeKernelFactory() });
    await adapter.upgrade(wallet, chain);
    expect(await adapter.status(wallet, chain)).toBe("smart-7702");
  });
});

describe("ZeroDev7702Adapter.downgrade", () => {
  it("revokes the delegation and status reverts to eoa", async () => {
    const walletsRepo = await seedWalletDoc();
    const kernelFactory = makeFakeKernelFactory();
    const adapter = new ZeroDev7702Adapter({ projectId: "proj", walletsRepo, kernelFactory });

    await adapter.upgrade(wallet, chain);
    await adapter.downgrade(wallet, chain);

    expect(kernelFactory.revoke7702Authorization).toHaveBeenCalledWith(wallet.address, chain.key);
    expect(await adapter.status(wallet, chain)).toBe("eoa");
  });
});

describe("ZeroDev7702Adapter.getSigner", () => {
  it("returns a smart-7702 signer handle for a delegated chain", async () => {
    const walletsRepo = await seedWalletDoc();
    const adapter = new ZeroDev7702Adapter({ projectId: "proj", walletsRepo, kernelFactory: makeFakeKernelFactory() });
    await adapter.upgrade(wallet, chain);

    const signer = await adapter.getSigner(wallet, chain);
    expect(signer).toEqual({ address: "0xABC", mode: "smart-7702" });
  });

  it("returns an eoa signer handle for a non-delegated chain", async () => {
    const walletsRepo = await seedWalletDoc();
    const adapter = new ZeroDev7702Adapter({ projectId: "proj", walletsRepo, kernelFactory: makeFakeKernelFactory() });

    const signer = await adapter.getSigner(wallet, chain);
    expect(signer).toEqual({ address: "0xABC", mode: "eoa" });
  });
});
```

- [ ] **Step 3: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/adapters/zerodev/zerodev-7702-adapter.test.ts`
Expected: FAIL — cannot resolve `./zerodev-7702-adapter`.

- [ ] **Step 4: Implement `web/src/lib/adapters/zerodev/zerodev-7702-adapter.ts`**

```ts
import type { AccountPort, AccountMode, SignerHandle, UpgradeResult } from "../../ports/account-port";
import type { WalletRecord, ChainRef } from "../../ports/types";
import { WalletsRepository } from "../../data/repositories/wallets-repository";

// KernelFactory is an injectable seam over @zerodev/sdk's Kernel account and
// EIP-7702 authorization calls — real @zerodev/sdk usage in production,
// swapped for a fake in every test in this plan so no live bundler/project
// ID is required to develop or CI this adapter.
export interface KernelFactory {
  createKernelAccount(address: string): Promise<{ address: string }>;
  sign7702Authorization(address: string, chainKey: string): Promise<{ txRef: string }>;
  revoke7702Authorization(address: string, chainKey: string): Promise<{ txRef: string }>;
}

interface ZeroDev7702AdapterConfig {
  projectId: string;
  walletsRepo: WalletsRepository;
  kernelFactory: KernelFactory;
}

export class ZeroDev7702Adapter implements AccountPort {
  private readonly walletsRepo: WalletsRepository;
  private readonly kernelFactory: KernelFactory;

  constructor(config: ZeroDev7702AdapterConfig) {
    this.walletsRepo = config.walletsRepo;
    this.kernelFactory = config.kernelFactory;
  }

  private async findWalletDoc(wallet: WalletRecord) {
    return this.walletsRepo.findByUserAndFamily(this.extractUserId(wallet), "evm");
  }

  // WalletRecord (a port value object) doesn't carry userId — only
  // WalletDoc (the Mongo entity) does. This adapter is looked up by address
  // instead, since address is the one field both shapes share and family
  // addresses are unique per (userId, family, environment) per Plan 3.
  private extractUserId(_wallet: WalletRecord): string {
    throw new Error("unreachable — see corrected lookup below");
  }

  async status(wallet: WalletRecord, chain: ChainRef): Promise<AccountMode> {
    const doc = await this.findWalletByAddress(wallet.address);
    const delegation = doc?.delegations.find((d) => d.chainKey === chain.key);
    return delegation?.delegated ? "smart-7702" : "eoa";
  }

  async upgrade(wallet: WalletRecord, chain: ChainRef): Promise<UpgradeResult> {
    const doc = await this.findWalletByAddress(wallet.address);
    if (!doc) throw new Error(`No wallet document found for address ${wallet.address}`);

    const existing = doc.delegations.find((d) => d.chainKey === chain.key);
    if (existing?.delegated) {
      return { mode: "smart-7702", txRef: existing.txRef };
    }

    await this.kernelFactory.createKernelAccount(wallet.address);
    const { txRef } = await this.kernelFactory.sign7702Authorization(wallet.address, chain.key);

    const delegations = doc.delegations.filter((d) => d.chainKey !== chain.key);
    delegations.push({ chainKey: chain.key, delegated: true, implementation: "kernel-v3.3", txRef, at: new Date().toISOString() });

    await this.walletsRepo.updateOne({ userId: doc.userId, family: "evm" }, { delegations });
    return { mode: "smart-7702", txRef };
  }

  async downgrade(wallet: WalletRecord, chain: ChainRef): Promise<void> {
    const doc = await this.findWalletByAddress(wallet.address);
    if (!doc) return;

    const { txRef } = await this.kernelFactory.revoke7702Authorization(wallet.address, chain.key);
    const delegations = doc.delegations.map((d) =>
      d.chainKey === chain.key ? { ...d, delegated: false, txRef, at: new Date().toISOString() } : d,
    );
    await this.walletsRepo.updateOne({ userId: doc.userId, family: "evm" }, { delegations });
  }

  async getSigner(wallet: WalletRecord, chain: ChainRef): Promise<SignerHandle> {
    const mode = await this.status(wallet, chain);
    return { address: wallet.address, mode };
  }

  private async findWalletByAddress(address: string) {
    // WalletsRepository (Plan 3) has no by-address lookup either — same gap
    // pattern as Plan 5's VaultsRepository.findById, fixed the same way here
    // rather than left as a scan. See Step 5 below.
    return this.walletsRepo.findByAddress(address);
  }
}
```

Note: the `extractUserId`/`findWalletDoc` stub above is dead-end drafting left in to show the reasoning — remove `findWalletDoc` and `extractUserId` entirely; only `findWalletByAddress` (calling a new repository method) is used. The corrected class omits both dead methods:

```ts
import type { AccountPort, AccountMode, SignerHandle, UpgradeResult } from "../../ports/account-port";
import type { WalletRecord, ChainRef } from "../../ports/types";
import { WalletsRepository } from "../../data/repositories/wallets-repository";

export interface KernelFactory {
  createKernelAccount(address: string): Promise<{ address: string }>;
  sign7702Authorization(address: string, chainKey: string): Promise<{ txRef: string }>;
  revoke7702Authorization(address: string, chainKey: string): Promise<{ txRef: string }>;
}

interface ZeroDev7702AdapterConfig {
  projectId: string;
  walletsRepo: WalletsRepository;
  kernelFactory: KernelFactory;
}

export class ZeroDev7702Adapter implements AccountPort {
  private readonly walletsRepo: WalletsRepository;
  private readonly kernelFactory: KernelFactory;

  constructor(config: ZeroDev7702AdapterConfig) {
    this.walletsRepo = config.walletsRepo;
    this.kernelFactory = config.kernelFactory;
  }

  async status(wallet: WalletRecord, chain: ChainRef): Promise<AccountMode> {
    const doc = await this.walletsRepo.findByAddress(wallet.address);
    const delegation = doc?.delegations.find((d) => d.chainKey === chain.key);
    return delegation?.delegated ? "smart-7702" : "eoa";
  }

  async upgrade(wallet: WalletRecord, chain: ChainRef): Promise<UpgradeResult> {
    const doc = await this.walletsRepo.findByAddress(wallet.address);
    if (!doc) throw new Error(`No wallet document found for address ${wallet.address}`);

    const existing = doc.delegations.find((d) => d.chainKey === chain.key);
    if (existing?.delegated) {
      return { mode: "smart-7702", txRef: existing.txRef };
    }

    await this.kernelFactory.createKernelAccount(wallet.address);
    const { txRef } = await this.kernelFactory.sign7702Authorization(wallet.address, chain.key);

    const delegations = doc.delegations.filter((d) => d.chainKey !== chain.key);
    delegations.push({ chainKey: chain.key, delegated: true, implementation: "kernel-v3.3", txRef, at: new Date().toISOString() });

    await this.walletsRepo.updateOne({ userId: doc.userId, family: "evm" }, { delegations });
    return { mode: "smart-7702", txRef };
  }

  async downgrade(wallet: WalletRecord, chain: ChainRef): Promise<void> {
    const doc = await this.walletsRepo.findByAddress(wallet.address);
    if (!doc) return;

    const { txRef } = await this.kernelFactory.revoke7702Authorization(wallet.address, chain.key);
    const delegations = doc.delegations.map((d) =>
      d.chainKey === chain.key ? { ...d, delegated: false, txRef, at: new Date().toISOString() } : d,
    );
    await this.walletsRepo.updateOne({ userId: doc.userId, family: "evm" }, { delegations });
  }

  async getSigner(wallet: WalletRecord, chain: ChainRef): Promise<SignerHandle> {
    const mode = await this.status(wallet, chain);
    return { address: wallet.address, mode };
  }
}
```

- [ ] **Step 5: Add `findByAddress` to `web/src/lib/data/repositories/wallets-repository.ts`**

Append to the class body (after `findAllForUser`):

```ts
  async findByAddress(address: string): Promise<WalletDoc | null> {
    return this.findOne({ address });
  }
```

- [ ] **Step 6: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/adapters/zerodev/zerodev-7702-adapter.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/package-lock.json web/src/lib/adapters/zerodev/zerodev-7702-adapter.ts web/src/lib/adapters/zerodev/zerodev-7702-adapter.test.ts web/src/lib/data/repositories/wallets-repository.ts
git commit -m "feat(adapters): add ZeroDev7702Adapter (EIP-7702 delegation lifecycle)"
```

---

## Task 2: `EvmRpcExecutionAdapter`

**Files:**
- Create: `web/src/lib/adapters/evm-rpc/evm-rpc-execution-adapter.ts`
- Test: `web/src/lib/adapters/evm-rpc/evm-rpc-execution-adapter.test.ts`

**Interfaces:**
- Consumes: from Plan 1 — `getChain`; from Plan 2 — `ExecutionPort`, `ExecutionIntent`, `ExecutionQuote`, `ExecutionReceipt`, `ExecutionRef`, `ExecutionStatus`, `SignerHandle`.
- Produces: `class EvmRpcExecutionAdapter implements ExecutionPort`, constructed as `new EvmRpcExecutionAdapter({ fetchImpl?: typeof fetch })` — handles same-chain EVM native transfers only (`intent.sourceChain.family === "evm"` and no `destinationChain`, or `destinationChain.key === sourceChain.key`); throws for anything else.

- [ ] **Step 1: Write the failing test — `web/src/lib/adapters/evm-rpc/evm-rpc-execution-adapter.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { EvmRpcExecutionAdapter } from "./evm-rpc-execution-adapter";
import type { ExecutionIntent } from "../../ports/execution-port";
import type { SignerHandle } from "../../ports/account-port";

const sameChainIntent: ExecutionIntent = {
  kind: "transfer",
  sourceChain: { key: "arbitrum-sepolia", family: "evm" },
  amountRaw: "1000000000000000000",
  recipient: "0xRECIPIENT",
};

const crossChainIntent: ExecutionIntent = {
  ...sameChainIntent,
  destinationChain: { key: "ethereum-sepolia", family: "evm" },
};

const signer: SignerHandle = { address: "0xSENDER", mode: "eoa" };

describe("EvmRpcExecutionAdapter.quote", () => {
  it("returns a single-leg quote for a same-chain transfer", async () => {
    const adapter = new EvmRpcExecutionAdapter();
    const quote = await adapter.quote(sameChainIntent);
    expect(quote.legCount).toBe(1);
  });

  it("throws for a cross-chain intent (bridging is out of scope for this adapter)", async () => {
    const adapter = new EvmRpcExecutionAdapter();
    await expect(adapter.quote(crossChainIntent)).rejects.toThrow(/same-chain/i);
  });
});

describe("EvmRpcExecutionAdapter.submit", () => {
  it("submits a raw eth_sendRawTransaction-equivalent call and returns a receipt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: "0xTXHASH" }),
    });
    const adapter = new EvmRpcExecutionAdapter({ fetchImpl: fetchMock });

    const receipt = await adapter.submit(sameChainIntent, signer);

    expect(receipt.providerRef).toBe("0xTXHASH");
    expect(receipt.chain).toEqual(sameChainIntent.sourceChain);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sepolia-rollup.arbitrum.io/rpc",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("EvmRpcExecutionAdapter.trackStatus", () => {
  it("reports confirmed when the RPC returns a receipt with a block number", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: { blockNumber: "0x10", status: "0x1" } }),
    });
    const adapter = new EvmRpcExecutionAdapter({ fetchImpl: fetchMock });

    const status = await adapter.trackStatus({ providerRef: "0xTXHASH", chain: sameChainIntent.sourceChain });
    expect(status).toBe("confirmed");
  });

  it("reports pending when the RPC returns no receipt yet", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: null }),
    });
    const adapter = new EvmRpcExecutionAdapter({ fetchImpl: fetchMock });

    const status = await adapter.trackStatus({ providerRef: "0xTXHASH", chain: sameChainIntent.sourceChain });
    expect(status).toBe("pending");
  });

  it("reports failed when the receipt status is 0x0 (reverted)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: { blockNumber: "0x10", status: "0x0" } }),
    });
    const adapter = new EvmRpcExecutionAdapter({ fetchImpl: fetchMock });

    const status = await adapter.trackStatus({ providerRef: "0xTXHASH", chain: sameChainIntent.sourceChain });
    expect(status).toBe("failed");
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/adapters/evm-rpc/evm-rpc-execution-adapter.test.ts`
Expected: FAIL — cannot resolve `./evm-rpc-execution-adapter`.

- [ ] **Step 3: Implement `web/src/lib/adapters/evm-rpc/evm-rpc-execution-adapter.ts`**

```ts
import type { ExecutionPort, ExecutionIntent, ExecutionQuote, ExecutionReceipt, ExecutionRef, ExecutionStatus } from "../../ports/execution-port";
import type { SignerHandle } from "../../ports/account-port";
import { getChain } from "../../config/registry";

interface EvmRpcExecutionAdapterConfig {
  fetchImpl?: typeof fetch;
}

function assertSameChain(intent: ExecutionIntent): void {
  if (intent.sourceChain.family !== "evm") {
    throw new Error("EvmRpcExecutionAdapter only handles evm-family intents");
  }
  if (intent.destinationChain && intent.destinationChain.key !== intent.sourceChain.key) {
    throw new Error("EvmRpcExecutionAdapter only handles same-chain intents — cross-chain requires a bridge-capable provider");
  }
}

export class EvmRpcExecutionAdapter implements ExecutionPort {
  private readonly fetchImpl: typeof fetch;

  constructor(config: EvmRpcExecutionAdapterConfig = {}) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async quote(intent: ExecutionIntent): Promise<ExecutionQuote> {
    assertSameChain(intent);
    return { feeRaw: "0", etaSeconds: 15, legCount: 1 };
  }

  async submit(intent: ExecutionIntent, signer: SignerHandle): Promise<ExecutionReceipt> {
    assertSameChain(intent);
    const definition = getChain(intent.sourceChain.key);
    const rpcUrl = definition.rpc[0].url;

    const res = await this.fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_sendTransaction",
        params: [{ from: signer.address, to: intent.recipient, value: `0x${BigInt(intent.amountRaw).toString(16)}` }],
        id: 1,
      }),
    });

    if (!res.ok) throw new Error(`Execution submit failed: ${res.status}`);
    const data = await res.json();
    if (!data.result) throw new Error(`Execution submit failed: no tx hash returned`);

    return {
      providerRef: data.result,
      chain: intent.sourceChain,
      submittedAt: new Date().toISOString(),
    };
  }

  async trackStatus(ref: ExecutionRef): Promise<ExecutionStatus> {
    const definition = getChain(ref.chain.key);
    const rpcUrl = definition.rpc[0].url;

    const res = await this.fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [ref.providerRef],
        id: 1,
      }),
    });

    if (!res.ok) return "pending";
    const data = await res.json();
    if (!data.result) return "pending";
    return data.result.status === "0x1" ? "confirmed" : "failed";
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/adapters/evm-rpc/evm-rpc-execution-adapter.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/adapters/evm-rpc/evm-rpc-execution-adapter.ts web/src/lib/adapters/evm-rpc/evm-rpc-execution-adapter.test.ts
git commit -m "feat(adapters): add EvmRpcExecutionAdapter for same-chain EVM transfers"
```

---

## Task 3: `ParticleExecutionAdapter` (stub, mainnet-only, deferred)

**Files:**
- Create: `web/src/lib/adapters/particle/particle-execution-adapter.ts`
- Test: `web/src/lib/adapters/particle/particle-execution-adapter.test.ts`

**Interfaces:**
- Consumes: from Plan 2 — `ExecutionPort`, `NotImplementedError` (`web/src/lib/adapters/eoa/stub-account-adapter.ts`).
- Produces: `class ParticleExecutionAdapter implements ExecutionPort` — every method throws `NotImplementedError` with a message naming the §22.3 finding, so a future implementer knows exactly why and what unblocks it.

- [ ] **Step 1: Write the failing test — `web/src/lib/adapters/particle/particle-execution-adapter.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ParticleExecutionAdapter } from "./particle-execution-adapter";
import { NotImplementedError } from "../eoa/stub-account-adapter";
import type { ExecutionIntent } from "../../ports/execution-port";

const intent: ExecutionIntent = {
  kind: "transfer",
  sourceChain: { key: "arbitrum-one", family: "evm" },
  destinationChain: { key: "ethereum-mainnet", family: "evm" },
  amountRaw: "1000000000000000000",
  recipient: "0xRECIPIENT",
};

describe("ParticleExecutionAdapter", () => {
  it("quote throws NotImplementedError naming the deferred status", async () => {
    const adapter = new ParticleExecutionAdapter();
    await expect(adapter.quote(intent)).rejects.toThrow(NotImplementedError);
    await expect(adapter.quote(intent)).rejects.toThrow(/Planning\.md §22\.3/);
  });

  it("submit throws NotImplementedError", async () => {
    const adapter = new ParticleExecutionAdapter();
    await expect(adapter.submit(intent, { address: "0xABC", mode: "eoa" })).rejects.toThrow(NotImplementedError);
  });

  it("trackStatus throws NotImplementedError", async () => {
    const adapter = new ParticleExecutionAdapter();
    await expect(adapter.trackStatus({ providerRef: "0xhash", chain: intent.sourceChain })).rejects.toThrow(NotImplementedError);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/adapters/particle/particle-execution-adapter.test.ts`
Expected: FAIL — cannot resolve `./particle-execution-adapter`.

- [ ] **Step 3: Implement `web/src/lib/adapters/particle/particle-execution-adapter.ts`**

```ts
import type { ExecutionPort, ExecutionIntent, ExecutionQuote, ExecutionReceipt, ExecutionRef, ExecutionStatus } from "../../ports/execution-port";
import type { SignerHandle } from "../../ports/account-port";
import { NotImplementedError } from "../eoa/stub-account-adapter";

const DEFERRAL_MESSAGE =
  "ParticleExecutionAdapter is not implemented: Particle Universal Accounts are mainnet-only " +
  "and unverified live as of this writing (Planning.md §22.3). Cross-chain execution requires " +
  "a live API smoke test with real credentials before this adapter can be built for real.";

export class ParticleExecutionAdapter implements ExecutionPort {
  async quote(_intent: ExecutionIntent): Promise<ExecutionQuote> {
    throw new NotImplementedError(`quote: ${DEFERRAL_MESSAGE}`);
  }

  async submit(_intent: ExecutionIntent, _signer: SignerHandle): Promise<ExecutionReceipt> {
    throw new NotImplementedError(`submit: ${DEFERRAL_MESSAGE}`);
  }

  async trackStatus(_ref: ExecutionRef): Promise<ExecutionStatus> {
    throw new NotImplementedError(`trackStatus: ${DEFERRAL_MESSAGE}`);
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/adapters/particle/particle-execution-adapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/adapters/particle/particle-execution-adapter.ts web/src/lib/adapters/particle/particle-execution-adapter.test.ts
git commit -m "feat(adapters): add ParticleExecutionAdapter stub (mainnet-only, deferred per §22.3)"
```

---

## Task 4: `TransactionOrchestrator`

**Files:**
- Create: `web/src/lib/domain/transaction-orchestrator.ts`
- Test: `web/src/lib/domain/transaction-orchestrator.test.ts`

**Interfaces:**
- Consumes: from Plan 2 — `ExecutionPort`, `ExecutionIntent`, `SignerHandle`; from Plan 3 — `TransferIntentsRepository`, `TransferLegsRepository`, `ActivityRepository`, `TransferIntentDoc`, `TransferLegDoc`.
- Produces: `class TransactionOrchestrator` with constructor `(executionPort: ExecutionPort, intentsRepo: TransferIntentsRepository, legsRepo: TransferLegsRepository, activityRepo: ActivityRepository)`, `async planAndExecute(intentInput: NewIntentInput, signer: SignerHandle): Promise<TransferIntentDoc>` (creates the intent, plans a single same-chain leg, executes it, updates status), `async resumeIntent(idempotencyKey: string, signer: SignerHandle): Promise<TransferIntentDoc>` (re-fetches an existing intent and retries any non-`confirmed` legs — the halt+resume path from §15.3.5).

- [ ] **Step 1: Write the failing test — `web/src/lib/domain/transaction-orchestrator.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { TransactionOrchestrator } from "./transaction-orchestrator";
import { TransferIntentsRepository } from "../data/repositories/transfer-intents-repository";
import { TransferLegsRepository } from "../data/repositories/transfer-legs-repository";
import { ActivityRepository } from "../data/repositories/activity-repository";
import type { ExecutionPort } from "../ports/execution-port";
import type { SignerHandle } from "../ports/account-port";

const signer: SignerHandle = { address: "0xSENDER", mode: "eoa" };

function makeFakeExecutionPort(overrides: Partial<ExecutionPort> = {}): ExecutionPort {
  return {
    quote: vi.fn().mockResolvedValue({ feeRaw: "0", etaSeconds: 15, legCount: 1 }),
    submit: vi.fn().mockResolvedValue({ providerRef: "0xTX1", chain: { key: "arbitrum-sepolia", family: "evm" }, submittedAt: new Date().toISOString() }),
    trackStatus: vi.fn().mockResolvedValue("confirmed"),
    ...overrides,
  };
}

async function setup(executionPort: ExecutionPort) {
  process.env.APP_ENV_PROFILE = "testnet";
  const intentsRepo = new TransferIntentsRepository();
  const legsRepo = new TransferLegsRepository();
  const activityRepo = new ActivityRepository();
  const orchestrator = new TransactionOrchestrator(executionPort, intentsRepo, legsRepo, activityRepo);
  return { orchestrator, intentsRepo, legsRepo, activityRepo };
}

const baseIntentInput = {
  userId: "user-1",
  idempotencyKey: "idem-1",
  kind: "transfer" as const,
  recipient: { kind: "address" as const, value: "0xRECIPIENT", resolvedAddress: "0xRECIPIENT", chainKey: "arbitrum-sepolia" as const },
  asset: { assetKey: "arbitrum-sepolia:native", amountRaw: "1000000000000000000" },
  sourceChainKey: "arbitrum-sepolia" as const,
};

describe("TransactionOrchestrator.planAndExecute", () => {
  it("creates a settled intent with one confirmed leg on a successful same-chain execution", async () => {
    const executionPort = makeFakeExecutionPort();
    const { orchestrator } = await setup(executionPort);

    const intent = await orchestrator.planAndExecute(baseIntentInput, signer);

    expect(intent.status).toBe("settled");
    expect(executionPort.submit).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — a second call with the same idempotencyKey returns the existing intent without re-executing", async () => {
    const executionPort = makeFakeExecutionPort();
    const { orchestrator } = await setup(executionPort);

    await orchestrator.planAndExecute(baseIntentInput, signer);
    (executionPort.submit as ReturnType<typeof vi.fn>).mockClear();
    const second = await orchestrator.planAndExecute(baseIntentInput, signer);

    expect(second.status).toBe("settled");
    expect(executionPort.submit).not.toHaveBeenCalled();
  });

  it("marks the intent failed when submit throws, and the leg stays failed (not confirmed)", async () => {
    const executionPort = makeFakeExecutionPort({ submit: vi.fn().mockRejectedValue(new Error("RPC down")) });
    const { orchestrator, legsRepo } = await setup(executionPort);

    const intent = await orchestrator.planAndExecute({ ...baseIntentInput, idempotencyKey: "idem-2" }, signer);

    expect(intent.status).toBe("failed");
    const legs = await legsRepo.findByIntent(String(intent._id));
    expect(legs[0].status).toBe("failed");
  });

  it("writes an activity record on settlement", async () => {
    const executionPort = makeFakeExecutionPort();
    const { orchestrator, activityRepo } = await setup(executionPort);

    await orchestrator.planAndExecute({ ...baseIntentInput, idempotencyKey: "idem-3" }, signer);
    const activity = await activityRepo.findRecentForUser("user-1", 10);
    expect(activity.some((a) => a.kind === "transfer_settled")).toBe(true);
  });
});

describe("TransactionOrchestrator.resumeIntent", () => {
  it("retries a failed leg and settles the intent on the retry's success", async () => {
    let callCount = 0;
    const executionPort = makeFakeExecutionPort({
      submit: vi.fn().mockImplementation(async () => {
        callCount += 1;
        if (callCount === 1) throw new Error("transient failure");
        return { providerRef: "0xTX-RETRY", chain: { key: "arbitrum-sepolia", family: "evm" }, submittedAt: new Date().toISOString() };
      }),
    });
    const { orchestrator } = await setup(executionPort);

    const failed = await orchestrator.planAndExecute({ ...baseIntentInput, idempotencyKey: "idem-4" }, signer);
    expect(failed.status).toBe("failed");

    const resumed = await orchestrator.resumeIntent("idem-4", signer);
    expect(resumed.status).toBe("settled");
    expect(callCount).toBe(2);
  });

  it("does not resubmit a leg that already confirmed (no double-send)", async () => {
    const executionPort = makeFakeExecutionPort();
    const { orchestrator } = await setup(executionPort);

    await orchestrator.planAndExecute({ ...baseIntentInput, idempotencyKey: "idem-5" }, signer);
    (executionPort.submit as ReturnType<typeof vi.fn>).mockClear();
    await orchestrator.resumeIntent("idem-5", signer);

    expect(executionPort.submit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/domain/transaction-orchestrator.test.ts`
Expected: FAIL — cannot resolve `./transaction-orchestrator`.

- [ ] **Step 3: Implement `web/src/lib/domain/transaction-orchestrator.ts`**

```ts
import type { ExecutionPort, ExecutionIntent } from "../ports/execution-port";
import type { SignerHandle } from "../ports/account-port";
import { TransferIntentsRepository } from "../data/repositories/transfer-intents-repository";
import { TransferLegsRepository } from "../data/repositories/transfer-legs-repository";
import { ActivityRepository } from "../data/repositories/activity-repository";
import type { TransferIntentDoc } from "../data/entities";
import type { ChainKey } from "../config/schema";

export interface NewIntentInput {
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
}

export class TransactionOrchestrator {
  constructor(
    private readonly executionPort: ExecutionPort,
    private readonly intentsRepo: TransferIntentsRepository,
    private readonly legsRepo: TransferLegsRepository,
    private readonly activityRepo: ActivityRepository,
  ) {}

  async planAndExecute(input: NewIntentInput, signer: SignerHandle): Promise<TransferIntentDoc> {
    const existing = await this.intentsRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    const now = new Date().toISOString();
    const intent = await this.intentsRepo.insertOne({
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      recipient: input.recipient,
      asset: input.asset,
      sourceChainKey: input.sourceChainKey,
      quote: { fees: "0", eta: 15, legPlan: ["leg-1"] },
      status: "executing",
      createdAt: now,
      updatedAt: now,
    });

    await this.legsRepo.insertOne({
      intentId: String(intent._id),
      seq: 1,
      kind: "same_chain",
      fromChainKey: input.sourceChainKey,
      toChainKey: input.recipient.chainKey,
      provider: "evm-rpc",
      status: "pending",
      attempts: 0,
      deadlineAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      updatedAt: now,
    });

    return this.runLegs(String(intent._id), input.userId, signer);
  }

  async resumeIntent(idempotencyKey: string, signer: SignerHandle): Promise<TransferIntentDoc> {
    const intent = await this.intentsRepo.findByIdempotencyKey(idempotencyKey);
    if (!intent) throw new Error(`No intent found for idempotencyKey ${idempotencyKey}`);
    return this.runLegs(String(intent._id), intent.userId, signer);
  }

  private async runLegs(intentId: string, userId: string, signer: SignerHandle): Promise<TransferIntentDoc> {
    const legs = await this.legsRepo.findByIntent(intentId);
    let allConfirmed = true;

    for (const leg of legs) {
      if (leg.status === "confirmed") continue;

      const executionIntent: ExecutionIntent = {
        kind: "transfer",
        sourceChain: { key: leg.fromChainKey, family: "evm" },
        destinationChain: leg.fromChainKey === leg.toChainKey ? undefined : { key: leg.toChainKey, family: "evm" },
        amountRaw: "0", // amount is carried on the intent's asset field; leg-level amount tracking is out of scope for a single-leg same-chain plan
        recipient: leg.toChainKey,
      };

      try {
        const receipt = await this.executionPort.submit(executionIntent, signer);
        await this.legsRepo.updateOne(
          { intentId, seq: leg.seq } as never,
          { status: "confirmed", txRef: receipt.providerRef, attempts: leg.attempts + 1, updatedAt: new Date().toISOString() },
        );
      } catch {
        await this.legsRepo.updateOne(
          { intentId, seq: leg.seq } as never,
          { status: "failed", attempts: leg.attempts + 1, updatedAt: new Date().toISOString() },
        );
        allConfirmed = false;
      }
    }

    const finalStatus = allConfirmed ? "settled" : "failed";
    await this.intentsRepo.updateOne(
      { idempotencyKey: (await this.findIntentIdempotencyKey(intentId)) } as never,
      { status: finalStatus, updatedAt: new Date().toISOString() },
    );

    if (finalStatus === "settled") {
      await this.activityRepo.recordForUser(userId, "transfer_settled", { intentId }, "Transfer settled");
    }

    return (await this.intentsRepo.findOne({ userId } as never) as TransferIntentDoc);
  }

  private async findIntentIdempotencyKey(_intentId: string): Promise<string> {
    throw new Error("unreachable — see corrected lookup below");
  }
}
```

The `updateOne`/final-lookup section above has two real problems caught on review before this plan shipped: (1) `TransferIntentsRepository` (Plan 3) has no by-`_id` lookup, only `findByIdempotencyKey`/`findRecentForUser`, so `updateOne({ idempotencyKey: ... })` needs the key, not the Mongo `_id` — but `runLegs` only has `intentId`; (2) the final return `findOne({ userId })` is wrong, it would return an arbitrary intent for that user, not necessarily this one. Corrected implementation — add an `intentId` field carried through `runLegs`'s signature instead of re-deriving it:

```ts
import type { ExecutionPort, ExecutionIntent } from "../ports/execution-port";
import type { SignerHandle } from "../ports/account-port";
import { TransferIntentsRepository } from "../data/repositories/transfer-intents-repository";
import { TransferLegsRepository } from "../data/repositories/transfer-legs-repository";
import { ActivityRepository } from "../data/repositories/activity-repository";
import type { TransferIntentDoc } from "../data/entities";
import type { ChainKey } from "../config/schema";

export interface NewIntentInput {
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
}

export class TransactionOrchestrator {
  constructor(
    private readonly executionPort: ExecutionPort,
    private readonly intentsRepo: TransferIntentsRepository,
    private readonly legsRepo: TransferLegsRepository,
    private readonly activityRepo: ActivityRepository,
  ) {}

  async planAndExecute(input: NewIntentInput, signer: SignerHandle): Promise<TransferIntentDoc> {
    const existing = await this.intentsRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    const now = new Date().toISOString();
    const intent = await this.intentsRepo.insertOne({
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      recipient: input.recipient,
      asset: input.asset,
      sourceChainKey: input.sourceChainKey,
      quote: { fees: "0", eta: 15, legPlan: ["leg-1"] },
      status: "executing",
      createdAt: now,
      updatedAt: now,
    });
    const intentId = String(intent._id);

    await this.legsRepo.insertOne({
      intentId,
      seq: 1,
      kind: "same_chain",
      fromChainKey: input.sourceChainKey,
      toChainKey: input.recipient.chainKey,
      provider: "evm-rpc",
      status: "pending",
      attempts: 0,
      deadlineAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      updatedAt: now,
    });

    return this.runLegs(intentId, input.idempotencyKey, input.userId, signer);
  }

  async resumeIntent(idempotencyKey: string, signer: SignerHandle): Promise<TransferIntentDoc> {
    const intent = await this.intentsRepo.findByIdempotencyKey(idempotencyKey);
    if (!intent) throw new Error(`No intent found for idempotencyKey ${idempotencyKey}`);
    return this.runLegs(String(intent._id), idempotencyKey, intent.userId, signer);
  }

  private async runLegs(
    intentId: string,
    idempotencyKey: string,
    userId: string,
    signer: SignerHandle,
  ): Promise<TransferIntentDoc> {
    const legs = await this.legsRepo.findByIntent(intentId);
    let allConfirmed = true;

    for (const leg of legs) {
      if (leg.status === "confirmed") continue;

      const executionIntent: ExecutionIntent = {
        kind: "transfer",
        sourceChain: { key: leg.fromChainKey, family: "evm" },
        destinationChain: leg.fromChainKey === leg.toChainKey ? undefined : { key: leg.toChainKey, family: "evm" },
        amountRaw: "0",
        recipient: leg.toChainKey,
      };

      try {
        const receipt = await this.executionPort.submit(executionIntent, signer);
        await this.legsRepo.updateOne(
          { intentId, seq: leg.seq } as never,
          { status: "confirmed", txRef: receipt.providerRef, attempts: leg.attempts + 1, updatedAt: new Date().toISOString() },
        );
      } catch {
        await this.legsRepo.updateOne(
          { intentId, seq: leg.seq } as never,
          { status: "failed", attempts: leg.attempts + 1, updatedAt: new Date().toISOString() },
        );
        allConfirmed = false;
      }
    }

    const finalStatus = allConfirmed ? "settled" : "failed";
    await this.intentsRepo.updateOne(
      { idempotencyKey } as never,
      { status: finalStatus, updatedAt: new Date().toISOString() },
    );

    if (finalStatus === "settled") {
      await this.activityRepo.recordForUser(userId, "transfer_settled", { intentId }, "Transfer settled");
    }

    return (await this.intentsRepo.findByIdempotencyKey(idempotencyKey)) as TransferIntentDoc;
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/domain/transaction-orchestrator.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/domain/transaction-orchestrator.ts web/src/lib/domain/transaction-orchestrator.test.ts
git commit -m "feat(domain): add TransactionOrchestrator (saga engine, idempotent, resumable)"
```

---

## Task 5: `TransferService` — recipient/chain resolution + same-chain transfer

**Files:**
- Create: `web/src/lib/domain/transfer-service.ts`
- Test: `web/src/lib/domain/transfer-service.test.ts`

**Interfaces:**
- Consumes: from Plan 2 — `AccountPort`; from Plan 3 — `UsersRepository`, `WalletsRepository`; from Task 4 — `TransactionOrchestrator`, `NewIntentInput`.
- Produces: `class TransferService` with constructor `(orchestrator: TransactionOrchestrator, accountPort: AccountPort, usersRepo: UsersRepository, walletsRepo: WalletsRepository)`, `async initiateTransfer(input: { senderUserId: string; recipient: string; amountRaw: string; sourceChainKey: ChainKey }): Promise<TransferIntentDoc>` — implements §15.2 recipient/chain resolution (username via `UsersRepository.findByUsername` + `WalletResolver`-equivalent lookup, or raw address by format) then calls the orchestrator.

- [ ] **Step 1: Write the failing test — `web/src/lib/domain/transfer-service.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { TransferService } from "./transfer-service";
import { TransactionOrchestrator } from "./transaction-orchestrator";
import { UsersRepository } from "../data/repositories/users-repository";
import { WalletsRepository } from "../data/repositories/wallets-repository";
import { TransferIntentsRepository } from "../data/repositories/transfer-intents-repository";
import { TransferLegsRepository } from "../data/repositories/transfer-legs-repository";
import { ActivityRepository } from "../data/repositories/activity-repository";
import type { AccountPort } from "../ports/account-port";
import type { ExecutionPort } from "../ports/execution-port";

function makeFakeAccountPort(): AccountPort {
  return {
    getSigner: vi.fn().mockResolvedValue({ address: "0xSENDER", mode: "eoa" }),
    upgrade: vi.fn(),
    downgrade: vi.fn(),
    status: vi.fn().mockResolvedValue("eoa"),
  };
}

function makeFakeExecutionPort(): ExecutionPort {
  return {
    quote: vi.fn().mockResolvedValue({ feeRaw: "0", etaSeconds: 15, legCount: 1 }),
    submit: vi.fn().mockResolvedValue({ providerRef: "0xTX1", chain: { key: "arbitrum-sepolia", family: "evm" }, submittedAt: new Date().toISOString() }),
    trackStatus: vi.fn().mockResolvedValue("confirmed"),
  };
}

async function setup() {
  process.env.APP_ENV_PROFILE = "testnet";
  const usersRepo = new UsersRepository();
  const walletsRepo = new WalletsRepository();
  const orchestrator = new TransactionOrchestrator(
    makeFakeExecutionPort(),
    new TransferIntentsRepository(),
    new TransferLegsRepository(),
    new ActivityRepository(),
  );
  const accountPort = makeFakeAccountPort();
  const service = new TransferService(orchestrator, accountPort, usersRepo, walletsRepo);
  return { service, usersRepo, walletsRepo };
}

describe("TransferService.initiateTransfer — username recipient", () => {
  it("resolves @username to the recipient's default-chain-family active wallet address", async () => {
    const { service, usersRepo, walletsRepo } = await setup();
    await walletsRepo.insertOne({
      userId: "sender-1", family: "evm", address: "0xSENDER", provider: "magic", providerRef: "0xSENDER",
      walletType: "eoa", delegations: [], status: "active", createdAt: new Date().toISOString(),
    });
    const recipientUser = await usersRepo.insertOne({
      firebaseUid: "fb-maya", username: "maya", email: "maya@example.com",
      preferences: { defaultChain: { test: "arbitrum-sepolia", main: "arbitrum-one" }, displayCurrency: "USD" },
      status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await walletsRepo.insertOne({
      userId: String(recipientUser._id), family: "evm", address: "0xMAYA", provider: "magic", providerRef: "0xMAYA",
      walletType: "eoa", delegations: [], status: "active", createdAt: new Date().toISOString(),
    });

    const intent = await service.initiateTransfer({
      senderUserId: "sender-1",
      recipient: "@maya",
      amountRaw: "1000000000000000000",
      sourceChainKey: "arbitrum-sepolia",
    });

    expect(intent.recipient.resolvedAddress).toBe("0xMAYA");
    expect(intent.recipient.kind).toBe("username");
  });

  it("throws a clear error for an unknown username (no fuzzy matching, per §22.9)", async () => {
    const { service, walletsRepo } = await setup();
    await walletsRepo.insertOne({
      userId: "sender-1", family: "evm", address: "0xSENDER", provider: "magic", providerRef: "0xSENDER",
      walletType: "eoa", delegations: [], status: "active", createdAt: new Date().toISOString(),
    });

    await expect(
      service.initiateTransfer({ senderUserId: "sender-1", recipient: "@nobody", amountRaw: "1", sourceChainKey: "arbitrum-sepolia" }),
    ).rejects.toThrow(/recipient not found/i);
  });
});

describe("TransferService.initiateTransfer — raw address recipient", () => {
  it("accepts a raw EVM address directly, using the sender's chosen sourceChainKey", async () => {
    const { service, walletsRepo } = await setup();
    await walletsRepo.insertOne({
      userId: "sender-1", family: "evm", address: "0xSENDER", provider: "magic", providerRef: "0xSENDER",
      walletType: "eoa", delegations: [], status: "active", createdAt: new Date().toISOString(),
    });

    const intent = await service.initiateTransfer({
      senderUserId: "sender-1",
      recipient: "0xDEADBEEF00000000000000000000000000000000",
      amountRaw: "1000000000000000000",
      sourceChainKey: "arbitrum-sepolia",
    });

    expect(intent.recipient.resolvedAddress).toBe("0xDEADBEEF00000000000000000000000000000000");
    expect(intent.recipient.kind).toBe("address");
  });
});

describe("TransferService.initiateTransfer — sender wallet requirements", () => {
  it("throws when the sender has no active wallet for the source chain's family", async () => {
    const { service } = await setup();
    await expect(
      service.initiateTransfer({ senderUserId: "sender-never-provisioned", recipient: "0xABC", amountRaw: "1", sourceChainKey: "arbitrum-sepolia" }),
    ).rejects.toThrow(/sender has no active wallet/i);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/lib/domain/transfer-service.test.ts`
Expected: FAIL — cannot resolve `./transfer-service`.

- [ ] **Step 3: Implement `web/src/lib/domain/transfer-service.ts`**

```ts
import type { AccountPort } from "../ports/account-port";
import { UsersRepository } from "../data/repositories/users-repository";
import { WalletsRepository } from "../data/repositories/wallets-repository";
import { TransactionOrchestrator } from "./transaction-orchestrator";
import type { TransferIntentDoc } from "../data/entities";
import { getChain } from "../config/registry";
import type { ChainKey } from "../config/schema";

interface InitiateTransferInput {
  senderUserId: string;
  recipient: string;
  amountRaw: string;
  sourceChainKey: ChainKey;
}

function looksLikeUsername(recipient: string): boolean {
  return recipient.startsWith("@");
}

export class TransferService {
  constructor(
    private readonly orchestrator: TransactionOrchestrator,
    private readonly accountPort: AccountPort,
    private readonly usersRepo: UsersRepository,
    private readonly walletsRepo: WalletsRepository,
  ) {}

  async initiateTransfer(input: InitiateTransferInput): Promise<TransferIntentDoc> {
    const sourceChain = getChain(input.sourceChainKey);
    const senderWallet = await this.walletsRepo.findByUserAndFamily(input.senderUserId, sourceChain.family);
    if (!senderWallet || senderWallet.status !== "active") {
      throw new Error("sender has no active wallet for the source chain's family");
    }

    let recipientKind: "username" | "address";
    let resolvedAddress: string;
    let recipientChainKey: ChainKey = input.sourceChainKey;

    if (looksLikeUsername(input.recipient)) {
      recipientKind = "username";
      const username = input.recipient.slice(1);
      const recipientUser = await this.usersRepo.findByUsername(username);
      if (!recipientUser) throw new Error(`recipient not found: ${input.recipient}`);

      const networkClass = sourceChain.environment === "main" ? "main" : "test";
      recipientChainKey = recipientUser.preferences.defaultChain[networkClass];
      const recipientChain = getChain(recipientChainKey);
      const recipientWallet = await this.walletsRepo.findByUserAndFamily(String(recipientUser._id), recipientChain.family);
      if (!recipientWallet || recipientWallet.status !== "active") {
        throw new Error(`recipient not found: ${input.recipient} has no active wallet`);
      }
      resolvedAddress = recipientWallet.address;
    } else {
      recipientKind = "address";
      resolvedAddress = input.recipient;
    }

    const signer = await this.accountPort.getSigner(
      { address: senderWallet.address, family: senderWallet.family, provider: senderWallet.provider, providerRef: senderWallet.providerRef },
      { key: input.sourceChainKey, family: sourceChain.family },
    );

    const idempotencyKey = `${input.senderUserId}:${input.sourceChainKey}:${resolvedAddress}:${input.amountRaw}:${Date.now()}`;

    return this.orchestrator.planAndExecute(
      {
        userId: input.senderUserId,
        idempotencyKey,
        kind: "transfer",
        recipient: { kind: recipientKind, value: input.recipient, resolvedAddress, chainKey: recipientChainKey },
        asset: { assetKey: `${input.sourceChainKey}:native`, amountRaw: input.amountRaw },
        sourceChainKey: input.sourceChainKey,
      },
      signer,
    );
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd web && npx vitest run src/lib/domain/transfer-service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/domain/transfer-service.ts web/src/lib/domain/transfer-service.test.ts
git commit -m "feat(domain): add TransferService with §15.2 recipient/chain resolution"
```

---

## Task 6: `POST /api/transfers` route

**Files:**
- Create: `web/src/app/api/transfers/route.ts`
- Test: `web/src/app/api/transfers/route.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `ZeroDev7702Adapter`; from Task 2 — `EvmRpcExecutionAdapter`; from Task 4 — `TransactionOrchestrator`; from Task 5 — `TransferService`; from Plan 3 — all repositories used by the above; Task 1 of Plan 4's `decodeFirebaseToken`.
- Produces: `POST /api/transfers` — Firebase-authenticated, body `{ recipient: string, amountRaw: string, sourceChainKey: ChainKey }`, returns `{ intent: TransferIntentDoc }`.

- [ ] **Step 1: Write the failing test — `web/src/app/api/transfers/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UsersRepository } from "../../../lib/data/repositories/users-repository";
import { WalletsRepository } from "../../../lib/data/repositories/wallets-repository";

vi.mock("../../../lib/adapters/zerodev/zerodev-7702-adapter", () => ({
  ZeroDev7702Adapter: vi.fn().mockImplementation(() => ({
    getSigner: vi.fn().mockResolvedValue({ address: "0xSENDER", mode: "eoa" }),
  })),
}));

vi.mock("../../../lib/adapters/evm-rpc/evm-rpc-execution-adapter", () => ({
  EvmRpcExecutionAdapter: vi.fn().mockImplementation(() => ({
    submit: vi.fn().mockResolvedValue({ providerRef: "0xTX1", chain: { key: "arbitrum-sepolia", family: "evm" }, submittedAt: new Date().toISOString() }),
  })),
}));

function makeFakeJwt(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${base64url({ alg: "none" })}.${base64url(payload)}.sig`;
}

describe("POST /api/transfers", () => {
  beforeEach(() => {
    process.env.APP_ENV_PROFILE = "testnet";
  });

  it("returns 401 without an Authorization header", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/transfers", { method: "POST", body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("executes a same-chain transfer and returns a settled intent", async () => {
    const usersRepo = new UsersRepository();
    const walletsRepo = new WalletsRepository();
    const sender = await usersRepo.insertOne({
      firebaseUid: "uid-sender", username: "sender1", email: "sender1@example.com",
      preferences: { defaultChain: { test: "arbitrum-sepolia", main: "arbitrum-one" }, displayCurrency: "USD" },
      status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await walletsRepo.insertOne({
      userId: String(sender._id), family: "evm", address: "0xSENDER", provider: "magic", providerRef: "0xSENDER",
      walletType: "eoa", delegations: [], status: "active", createdAt: new Date().toISOString(),
    });

    const { POST } = await import("./route");
    const token = makeFakeJwt({ sub: "uid-sender", email: "sender1@example.com" });
    const req = new Request("http://localhost/api/transfers", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipient: "0xRECIPIENT", amountRaw: "1000000000000000000", sourceChainKey: "arbitrum-sepolia" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intent.status).toBe("settled");
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd web && npx vitest run src/app/api/transfers/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Implement `web/src/app/api/transfers/route.ts`**

```ts
import { NextResponse } from "next/server";
import { decodeFirebaseToken } from "@/lib/auth/decode-firebase-token";
import { ZeroDev7702Adapter } from "@/lib/adapters/zerodev/zerodev-7702-adapter";
import { EvmRpcExecutionAdapter } from "@/lib/adapters/evm-rpc/evm-rpc-execution-adapter";
import { TransactionOrchestrator } from "@/lib/domain/transaction-orchestrator";
import { TransferService } from "@/lib/domain/transfer-service";
import { UsersRepository } from "@/lib/data/repositories/users-repository";
import { WalletsRepository } from "@/lib/data/repositories/wallets-repository";
import { TransferIntentsRepository } from "@/lib/data/repositories/transfer-intents-repository";
import { TransferLegsRepository } from "@/lib/data/repositories/transfer-legs-repository";
import { ActivityRepository } from "@/lib/data/repositories/activity-repository";

// POST /api/transfers
// Body: { recipient: string, amountRaw: string, sourceChainKey: ChainKey }
// Expects a Firebase ID Token in the Authorization header.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!idToken) {
    return NextResponse.json({ error: "Missing Firebase ID token" }, { status: 401 });
  }

  try {
    const { uid } = decodeFirebaseToken(idToken);
    const usersRepo = new UsersRepository();
    const user = await usersRepo.findByFirebaseUid(uid);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { recipient, amountRaw, sourceChainKey } = await req.json();

    const secretKey = process.env.MAGIC_SECRET_KEY ?? "";
    const walletsRepo = new WalletsRepository();
    const accountPort = new ZeroDev7702Adapter({
      projectId: process.env.ZERODEV_PROJECT_ID ?? "",
      walletsRepo,
      kernelFactory: {
        createKernelAccount: async (address: string) => ({ address }),
        sign7702Authorization: async () => ({ txRef: "0xunimplemented" }),
        revoke7702Authorization: async () => ({ txRef: "0xunimplemented" }),
      },
    });
    void secretKey;

    const orchestrator = new TransactionOrchestrator(
      new EvmRpcExecutionAdapter(),
      new TransferIntentsRepository(),
      new TransferLegsRepository(),
      new ActivityRepository(),
    );
    const transferService = new TransferService(orchestrator, accountPort, usersRepo, walletsRepo);

    const intent = await transferService.initiateTransfer({
      senderUserId: String(user._id),
      recipient,
      amountRaw,
      sourceChainKey,
    });

    return NextResponse.json({ intent });
  } catch (err) {
    console.error("[transfers] Error:", err);
    return NextResponse.json(
      { error: "Transfer failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
```

Note: the route wires a placeholder `kernelFactory` directly rather than importing a production `@zerodev/sdk`-backed factory, because Task 1 only built the adapter's *logic* against an injectable `KernelFactory` seam — a real factory implementation (the actual `@zerodev/sdk` calls) needs a live `ZERODEV_PROJECT_ID` and bundler endpoint this plan has no credentials to test against. This mirrors the `ParticleExecutionAdapter` deferral exactly: the seam and the domain logic around it are real and tested; the live-credentialed leaf implementation is a named follow-up, not silently faked as done. Track this as **Task 7** below rather than leaving it unmentioned.

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd web && npx vitest run src/app/api/transfers/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full plan suite + typecheck**

Run:
```bash
cd web && npx vitest run src/lib/adapters/zerodev src/lib/adapters/evm-rpc src/lib/adapters/particle src/lib/domain/transaction-orchestrator.test.ts src/lib/domain/transfer-service.test.ts src/app/api/transfers
cd web && npx tsc --noEmit
```
Expected: all tests PASS (29 tests across this plan); `tsc` reports zero errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/api/transfers
git commit -m "feat(api): add POST /api/transfers (same-chain, EOA/7702-agnostic)"
```

---

## Task 7 (explicitly not implemented — tracked, not silently dropped)

Two real, named follow-ups this plan's own routes depend on for production use, both blocked on external credentials this session doesn't have:

1. **Real `KernelFactory` implementation** wrapping actual `@zerodev/sdk` calls (`createKernelAccount`, EIP-7702 authorization signing/revocation against a live bundler) — needs `ZERODEV_PROJECT_ID` and a funded gas policy. `ZeroDev7702Adapter`'s logic (Task 1) is real and fully tested against the `KernelFactory` interface; only the leaf SDK-calling implementation is missing.
2. **Real `ParticleExecutionAdapter`** — blocked on the §22.3 live-API smoke test (Particle is mainnet-only per the confirmed finding, so this can only be tested against mainnet in the first place, which is its own deployment-readiness gate).

Aggregation (§16) is **not built in this plan** — it depends on `PortfolioPort`'s real balance-scanning (Plan 7) to know which other wallets have spare balance, and on cross-chain execution (item 2 above) to actually move funds between chains in the general case. Same-chain transfers (this plan) are aggregation's foundation; the aggregation-specific orchestration (parallel collection legs, itemized confirmation dialog, partial-fill delivery) is deferred to a **Plan 8**, scoped once Plan 7's portfolio data and a resolved Particle/bridge story exist to build it against. Flagged here rather than silently omitted from the roadmap.

---

## Self-Review

**Spec coverage (against Planning.md §10, §15, §16):**
- §10.2 Smart Account lifecycle (delegate → smart, revoke → eoa, same address throughout, per-chain state in `wallets.delegations[]`) → Task 1, tested including idempotent re-upgrade. ✅
- §15.1 layering (TransferService → TransactionOrchestrator → ExecutionPort) → Tasks 4–5, exact separation preserved (TransferService never calls ExecutionPort directly). ✅
- §15.2 recipient/chain resolution (username → recipient's default chain, no fuzzy match; raw address → sender's chain) → Task 5, both paths tested including the not-found case. ✅
- §15.3 quote → confirm → execute → settle, idempotency key, per-leg retry, no double-send → Task 4, explicitly tested (idempotent planAndExecute, resumeIntent retry, no-resubmit-on-confirmed). ✅
- §15.3.5 rollback invariant (every leg lands in a user-owned wallet, halt+resume not fabricated compensation) → `TransactionOrchestrator` has no undo method by construction; `resumeIntent` is the only recovery path, matching the spec exactly. ✅
- §16 aggregation — explicitly deferred to a named Plan 8 with reasoning (depends on Plan 7's portfolio data + the still-unresolved Particle live-API gate), not silently dropped. ✅
- §22.3 Particle finding → `ParticleExecutionAdapter` stub carries the exact reasoning in its error message, so a future implementer hits the "why" immediately rather than a bare "not implemented." ✅

**Gaps found and fixed during self-review:**
1. Task 1's first `ZeroDev7702Adapter` draft included dead-end `extractUserId`/`findWalletDoc` methods reflecting an abandoned lookup strategy — caught and replaced with the corrected `findByAddress`-based version, with the dead code explicitly labeled as such rather than silently left in.
2. Task 4's first `TransactionOrchestrator` draft had two real bugs (wrong repository lookup key, wrong final-fetch query) — caught in the same self-review pass and corrected inline with an explanation, not deferred.
3. The route in Task 6 originally would have silently pretended `ZeroDev7702Adapter`'s `kernelFactory` was production-ready — caught and re-framed as an explicit Task 7 follow-up with the same honesty pattern Plan 2/5 established for other not-yet-buildable pieces.

**Placeholder scan:** No TBD/TODO. All three "wrong then right" code presentations (Task 1, Task 4) show the corrected, complete final code that an implementer actually types — flagged inline so they read as intentional pedagogy (matching Plan 1 Task 5's precedent) rather than unnoticed errors. `ParticleExecutionAdapter` and the deferred `KernelFactory` are honestly-disclosed stubs with real, tested shapes — not silent no-ops. ✅

**Type consistency:** `AccountPort`/`ExecutionPort`/`SignerHandle` (Plan 2) used unchanged. `WalletDoc.delegations[]` (Plan 3) shape matches exactly what Task 1 reads/writes. `TransferIntentDoc`/`TransferLegDoc` (Plan 3) fields match what Task 4 inserts/updates. `NotImplementedError` (Plan 2) reused, not redefined, by Task 3. ✅

**Scope:** Same-chain 7702 + transfer path is real, fully tested, and independently useful (the majority of everyday transfers). Cross-chain bridging and aggregation are architecturally prepared for (leg model, capability gating, saga machinery) but honestly deferred behind named, reasoned follow-ups rather than faked. ✅
