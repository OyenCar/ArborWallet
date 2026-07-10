# ArborWallet — Multi-Chain Wallet Architecture (Planning)

> **Status:** Architecture & planning only. No implementation in this document.
> **Scope:** Multi-chain internal wallets, chain registry, provider abstraction,
> Smart Wallets (EIP-7702 / ZeroDev), Particle Network orchestration,
> Testnet/Mainnet environments, MongoDB Atlas datastore, Vault compatibility.
> **Companions:** `SPEC.md` (current product spec), `PLAN.md` (original hackathon build plan).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Architecture Overview](#3-architecture-overview)
4. [NetworkEnvironment & EnvironmentProfile](#4-networkenvironment--environmentprofile)
5. [ChainRegistry](#5-chainregistry)
6. [ChainFamily Architecture](#6-chainfamily-architecture)
7. [ProviderRegistry](#7-providerregistry)
8. [Core Ports](#8-core-ports)
9. [Wallet Model & Lifecycle](#9-wallet-model--lifecycle)
10. [Smart Wallet Architecture (EIP-7702 + ZeroDev)](#10-smart-wallet-architecture-eip-7702--zerodev)
11. [Identity-Based Authorization Model](#11-identity-based-authorization-model)
12. [Vault Integration Flow](#12-vault-integration-flow)
13. [Portfolio Architecture](#13-portfolio-architecture)
14. [Default Wallet](#14-default-wallet)
15. [Transfer Architecture](#15-transfer-architecture)
16. [Automatic Balance Aggregation](#16-automatic-balance-aggregation)
17. [Paymaster Strategy](#17-paymaster-strategy)
18. [MongoDB Schema Proposal](#18-mongodb-schema-proposal)
19. [UI & UX — Environment Awareness](#19-ui--ux--environment-awareness)
20. [Extensibility Playbooks](#20-extensibility-playbooks)
21. [Migration Considerations](#21-migration-considerations)
22. [Critical Architecture Review](#22-critical-architecture-review)

---

## 1. Executive Summary

ArborWallet evolves from a single-chain (Arbitrum Sepolia) corporate vault app
into a **domain-centric, multi-chain wallet platform**. The architecture rests
on six pillars:

| Pillar | What it is | What it buys |
|---|---|---|
| **ChainRegistry** | Declarative, validated config for every chain × network | Single source of truth; zero hardcoded chain data |
| **ChainFamily** | Chains grouped by protocol compatibility (EVM / Solana / Bitcoin) | One adapter per family, not per chain |
| **ProviderRegistry** | Declarative catalog of infrastructure vendors keyed by role | Vendor swap = registry edit, not refactor |
| **Core Ports (4)** | `WalletPort`, `AccountPort`, `ExecutionPort`, `PortfolioPort` | Business logic never sees a provider name |
| **EnvironmentProfile** | Named deployment profiles (local → mainnet) | Testnet/Mainnet switch = config change only |
| **Identity-based authorization** | Vault permissions mount to user identity; addresses are projections | Wallet migration / 7702 upgrade without permission changes |

**Custody decision (approved):** Magic TEE Server Wallet stays the key-custody
layer (per-family keys, bound to Firebase identity). Particle Network sits *on
top* as an execution/orchestration provider — never as the identity or custody
layer. ZeroDev provides EIP-7702 smart-account logic at the user's existing
address. All three are replaceable adapters.

**Environment decision (approved):** one environment per deployment, selected
by a global `EnvironmentProfile`. Every off-chain record is tagged with its
environment; repositories inject the environment filter automatically.

**Datastore decision:** MongoDB Atlas is the primary off-chain application
datastore. The blockchain remains the source of truth for vault state, treasury
balances, smart-contract state, transaction execution, permissions, and
spending limits. MongoDB stores identity, membership, metadata, caches, and
orchestration state — never authoritative financial state.

The result: adding a new EVM chain is a registry entry. Adding a new provider
is an adapter behind an existing port. Adding a new environment is a profile.
No business logic changes for any of the three.

---

## 2. Goals & Non-Goals

### Goals

- Multi-chain by design: Bitcoin, Ethereum, Solana, BNB Chain, Arbitrum at launch.
- Environment-aware: Testnet and Mainnet fully isolated; future `local`,
  `development`, `staging` profiles.
- Chain-agnostic business logic: services consume ports + registries only.
- Extensible: new chains, providers, environments, and wallet technologies with
  minimal effort.
- Particle Network Smart WaaS as orchestration (not a coupled dependency).
- EIP-7702 Smart Wallets via ZeroDev, coexisting with plain EOAs.
- Compatible with existing Vault architecture (`Vault.sol` on Arbitrum).
- Traditional addresses and Smart Accounts under one wallet abstraction.
- Minimal vendor lock-in across custody, execution, indexing, and paymaster.

### Non-Goals (explicitly out of scope for this phase)

- Multi-vault-per-chain or Vault deployment beyond Arbitrum.
- NFT portfolio support (modeled for, not implemented).
- Session keys for end users beyond the existing ZeroDev vault session keys
  (modeled as future work).
- User-facing environment switching inside one deployment (a deployment serves
  exactly one environment).
- Decentralized / self-hosted key custody (Magic TEE remains custodian).

---

## 3. Architecture Overview

### 3.1 Domain-centric layering

The architecture is **domain-centric**: business domains sit at the center;
infrastructure providers are peripheral plug-ins. The business layer never
knows whether it is talking to Particle, ZeroDev, Magic, native RPC, or a
future provider.

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI LAYER (Next.js pages/components)                                │
│  Dashboard · Transfers · Settings · Vault screens · Env badge       │
│  Knows: domain view-models. Never knows: chain IDs, providers.      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ view-models / API routes
┌───────────────────────────────▼─────────────────────────────────────┐
│  DOMAIN LAYER (services — pure business logic)                      │
│  WalletService · PortfolioService · TransferService                 │
│  DefaultWalletService · VaultService · WalletResolver               │
│  MembershipReconciler · PaymasterPolicy                             │
│  TransactionOrchestrator (saga engine, serves TransferService)      │
│  Knows: ports, registries, domain entities.                        │
│  Never knows: provider SDKs, RPC URLs, chain IDs as literals.       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ interfaces only
┌───────────────────────────────▼─────────────────────────────────────┐
│  CORE PORTS (contracts)                                             │
│  WalletPort · AccountPort · ExecutionPort · PortfolioPort           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ implemented by
┌───────────────────────────────▼─────────────────────────────────────┐
│  ADAPTER LAYER (family × provider implementations)                  │
│  MagicWalletAdapter        (WalletPort, all families)               │
│  ZeroDev7702Adapter        (AccountPort, EVM)                       │
│  EoaPassthroughAdapter     (AccountPort, Solana/Bitcoin)            │
│  ParticleExecutionAdapter  (ExecutionPort, EVM cross-chain)         │
│  EvmRpcExecutionAdapter    (ExecutionPort, EVM same-chain)          │
│  SolanaExecutionAdapter    (ExecutionPort, Solana)                  │
│  BitcoinExecutionAdapter   (ExecutionPort, Bitcoin)                 │
│  IndexerPortfolioAdapter   (PortfolioPort, primary)                 │
│  RpcPortfolioAdapter       (PortfolioPort, fallback)                │
│  Provider names exist ONLY here and in DI wiring.                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ configured by
┌───────────────────────────────▼─────────────────────────────────────┐
│  CONFIGURATION LAYER (data, zero behavior)                          │
│  ChainRegistry · ProviderRegistry · EnvironmentProfile              │
│  ChainCapability objects · feature flags                            │
└─────────────────────────────────────────────────────────────────────┘
                                │ persisted state
┌───────────────────────────────▼─────────────────────────────────────┐
│  DATA LAYER                                                         │
│  MongoDB Atlas (identity, membership, metadata, caches, sagas)      │
│  Blockchains (vault state, balances, permissions — source of truth) │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Dependency rule

Dependencies point inward-only:

```
UI → Domain Services → Ports ← Adapters ← Providers (SDKs)
                 ↘  Registries (pure data) ↙
```

- Domain services depend on **port interfaces** and **registry data**.
- Adapters depend on ports (they implement them) and provider SDKs.
- Nothing in `domain/` may import from `adapters/` or any provider SDK.
  Enforceable with an ESLint `no-restricted-imports` boundary rule.

### 3.3 Composition over abstraction

Only **four** ports exist. Explorer URLs, faucets, paymaster policy, RPC
endpoints, and feature flags are **data in ChainRegistry**, not behavioral
adapters — they have no behavior to abstract. Where the original requirement
suggested seven adapter layers, four ports + registry data cover the same
surface with less indirection (see §22.2 for the trade-off analysis).

### 3.4 Proposed module layout (for orientation only)

```
web/src/lib/
├── config/
│   ├── chains/            # ChainRegistry entries (one file per chain)
│   ├── providers.ts       # ProviderRegistry
│   ├── environments.ts    # EnvironmentProfiles
│   └── registry.ts        # load + zod-validate + merge runtime overrides
├── domain/
│   ├── wallet/            # WalletService, lifecycle state machine
│   ├── portfolio/         # PortfolioService, normalizer models
│   ├── transfer/          # TransferService, TransactionOrchestrator
│   ├── vault/             # VaultService, WalletResolver, MembershipReconciler
│   └── entities.ts        # User, WalletIdentity, VaultMembership, ...
├── ports/                 # the 4 interfaces + shared value objects
├── adapters/
│   ├── magic/  zerodev/  particle/  evm-rpc/  solana/  bitcoin/  indexer/
└── data/                  # MongoDB repositories (environment-scoped)
```

---

## 4. NetworkEnvironment & EnvironmentProfile

### 4.1 EnvironmentProfile

A single env var selects a named profile; the profile controls everything else:

```
APP_ENV_PROFILE = local | development | staging | testnet | mainnet
```

```ts
interface EnvironmentProfile {
  name: "local" | "development" | "staging" | "testnet" | "mainnet";
  networkClass: "test" | "main" | "local";   // asset-isolation boundary
  activeChainKeys: ChainKey[];               // which registry entries are live
  providerSelection?: Partial<ProviderSelection>; // per-profile overrides
  featureFlags: Record<string, boolean>;
  faucetsEnabled: boolean;
  paymasterTier: "none" | "capped" | "full";
  bannerStyle: "none" | "testnet" | "local"; // drives UI badge
}
```

| Profile | networkClass | Typical chains | Notes |
|---|---|---|---|
| `local` | local | Anvil, local Solana validator | Dev laptops; faucet = mint script |
| `development` | test | Same as testnet, dev API keys | Shared dev deployment |
| `staging` | test | Testnet chains, prod-like config | Pre-release validation |
| `testnet` | test | Sepolia, Arbitrum Sepolia, BNB Testnet, Solana Devnet, Bitcoin Testnet | Public demo |
| `mainnet` | main | Ethereum, Arbitrum One, BNB, Solana Mainnet Beta, Bitcoin | Production |

**One deployment = one profile.** Switching environments = redeploy (or
restart) with a different `APP_ENV_PROFILE`. No business logic, UI logic, or
adapter implementation changes — only which registry entries are active.

### 4.2 Asset isolation between environments

Isolation is enforced at four levels:

1. **Registry level** — a profile only activates chains whose `environment`
   matches its `networkClass`. A `mainnet` profile physically cannot load
   `ethereum-sepolia`; validation fails at boot.
2. **Data level** — every MongoDB document that references chain state carries
   an `environment` field. All compound indexes lead with it.
3. **Repository level** — data access goes through environment-scoped
   repositories that inject `environment: activeProfile.networkClass` into
   every query and write. Business code *cannot* forget the filter because it
   never writes raw queries.
4. **Address level** — testnet and mainnet wallets are separate documents even
   when the underlying key (and hence address) is identical. A wallet document
   is `(userId, family, environment)`-unique, so a Sepolia balance can never
   render under a mainnet portfolio.

Cross-environment operations do not exist as a code path: `ExecutionPort`
receives a `ChainRef` resolved from the active registry, and the active
registry only contains one environment's chains.

---

## 5. ChainRegistry

### 5.1 Single source of truth

Every piece of chain knowledge lives in one place. No module defines its own
RPC URL, chain ID, decimals, or explorer link. Services receive `ChainRef`
objects resolved from the registry.

**Chain identity:** `ChainKey = "<chain>-<network>"` (internal), plus the
CAIP-2 identifier for interoperability with external tooling:

```ts
type ChainKey = "ethereum-mainnet" | "ethereum-sepolia" | "arbitrum-one"
  | "arbitrum-sepolia" | "bnb-mainnet" | "bnb-testnet"
  | "solana-mainnet" | "solana-devnet" | "bitcoin-mainnet" | "bitcoin-testnet"
  | string; // future chains register new keys
```

### 5.2 Chain definition shape

```ts
interface ChainDefinition {
  key: ChainKey;                    // "arbitrum-sepolia"
  name: string;                     // "Arbitrum Sepolia"
  family: "evm" | "solana" | "bitcoin";  // extensible union
  environment: "main" | "test" | "local";
  caip2: string;                    // "eip155:421614", "solana:EtWT...", "bip122:0000..."
  chainId?: number;                 // EVM only; Solana/Bitcoin use caip2
  rpc: { url: string; weight: number }[];   // ordered fallback pool
  explorer: { base: string; tx: string; address: string }; // URL templates
  nativeCurrency: { symbol: string; name: string; decimals: number };
  tokens: TokenDefinition[];        // curated supported tokens
  providers: {                      // KEYS into ProviderRegistry — never impls
    wallet: ProviderKey;            // "magic"
    account: ProviderKey;           // "zerodev" | "eoa"
    execution: ProviderKey[];       // ordered: ["particle", "evm-rpc"]
    portfolio: ProviderKey[];       // ordered: ["indexer", "rpc"]
  };
  capabilities: ChainCapability;    // §5.3
  faucet?: { url: string; note?: string };  // testnet only
  featureFlags: Record<string, boolean>;
  defaultWalletEligible: boolean;
  vaultCompatible: boolean;         // true only for arbitrum-* today
}
```

### 5.3 ChainCapability object

Capabilities are a single typed object — not scattered booleans — and they are
the **only** thing business services are allowed to branch on:

```ts
interface ChainCapability {
  smartWallet: boolean;        // EIP-7702 delegation possible
  accountAbstraction: boolean; // UserOp-style execution available
  paymaster: boolean;          // gas sponsorship available
  vault: boolean;              // Vault.sol deployed on this chain
  portfolio: boolean;          // indexer coverage exists
  bridge: boolean;             // cross-chain routing in/out supported
  swap: boolean;               // token swap routing supported
  nft: boolean;                // NFT indexing (future)
  gasSponsorship: boolean;     // sponsored ops enabled in this deployment
}
```

Rule: **never check chain names.** `if (chain.capabilities.paymaster)` is
legal; `if (chain.key === "arbitrum-one")` is a lint error outside the
registry itself.

### 5.4 Supported networks at launch

| Chain | Family | Mainnet key | Testnet key | Testnet network | Smart wallet | Vault |
|---|---|---|---|---|---|---|
| Ethereum | evm | `ethereum-mainnet` (eip155:1) | `ethereum-sepolia` (eip155:11155111) | Sepolia | ✅ 7702 | — |
| Arbitrum | evm | `arbitrum-one` (eip155:42161) | `arbitrum-sepolia` (eip155:421614) | Arbitrum Sepolia | ✅ 7702 | ✅ |
| BNB Chain | evm | `bnb-mainnet` (eip155:56) | `bnb-testnet` (eip155:97) | BNB Testnet | ✅ 7702 | — |
| Solana | solana | `solana-mainnet` | `solana-devnet` | Devnet | ❌ (EOA) | — |
| Bitcoin | bitcoin | `bitcoin-mainnet` | `bitcoin-testnet` | Testnet3/4 (pick at config time) | ❌ (EOA) | — |

Future (registry entries only, no code): Polygon (137/80002), Base
(8453/84532), Optimism (10/11155420), Avalanche C-Chain (43114/43113) — all
EVM family. Sui, Aptos, Starknet, Bitcoin L2s — new families (see §20.1).

### 5.5 Static config + runtime overrides

- **Base truth lives in code**: typed TS files, one per chain, zod-validated at
  boot. Versioned, reviewed, testable.
- **Runtime overrides live in MongoDB** (`registry_overrides` collection):
  feature-flag flips, RPC endpoint rotation, temporary chain disable — ops
  actions that shouldn't require a deploy. Merged over base config at boot and
  refreshed on an interval.
- Overrides may **narrow** (disable a chain, remove an RPC) but never
  **introduce** a chain — new chains always land as reviewed code.

---

## 6. ChainFamily Architecture

### 6.1 The family tree

```
ChainRegistry
│
├── EVM family ──────────── ONE adapter set, N chains
│   ├── Ethereum   (mainnet / Sepolia)
│   ├── Arbitrum   (One / Arbitrum Sepolia)
│   ├── BNB Chain  (mainnet / testnet)
│   └── future: Base, Polygon, Optimism, Avalanche C-Chain
│
├── Solana family ───────── one adapter set
│   └── Solana (mainnet-beta / devnet)
│
├── Bitcoin family ──────── one adapter set
│   └── Bitcoin (mainnet / testnet)
│
└── Future families ─────── new adapter set per family
    ├── Sui / Aptos (Move-based)
    └── Starknet, Bitcoin L2s, private networks
```

### 6.2 Why ChainFamily cuts maintenance cost

A family groups chains that share: transaction format, signature scheme,
address derivation, RPC semantics, and token standards. Every adapter is
written **per family and parameterized by `ChainDefinition`**, so:

- **Adapter count grows with families, not chains.** Launch scope = 5 chains
  but only 3 adapter sets. Adding Base, Polygon, Optimism, and Avalanche later
  adds **zero** adapter code — 4 more chains, still 3 adapter sets.
- **A new EVM chain is a pull request touching one directory** (`config/chains/`):
  1. Register the chain in ChainRegistry.
  2. Provide RPC configuration.
  3. Configure explorer URLs.
  4. Enable capability/feature flags.
  No business logic changes. No adapter changes. No UI changes (UI renders
  from registry data).
- **Testing collapses.** The EVM adapter test suite runs against every EVM
  chain definition; a new chain gets its coverage for free.
- **Wallet identity is per-family** (§9), so a new EVM chain requires **no new
  keys** — the existing EVM address simply becomes usable there.

Family membership is declared in the registry (`family: "evm"`), and the DI
container binds each chain to its family's adapters at boot.

---

## 7. ProviderRegistry

ChainRegistry describes **blockchains**. ProviderRegistry describes
**infrastructure vendors**. Chains reference providers by key only.

```ts
type ProviderKey = "magic" | "privy" | "dynamic"       // wallet custody
                 | "zerodev" | "eoa"                   // smart account
                 | "particle" | "evm-rpc" | "solana-rpc" | "bitcoin-rpc"  // execution
                 | "indexer" | "rpc";                  // portfolio

interface ProviderDefinition {
  key: ProviderKey;
  role: "wallet" | "account" | "execution" | "portfolio";
  families: ChainFamily[];        // which families this provider can serve
  environments: NetworkClass[];   // e.g. Particle UA may exclude "test"
  adapter: string;                // DI token, e.g. "MagicWalletAdapter"
  config: Record<string, string>; // env-var names, NOT values
  status: "active" | "degraded" | "disabled";  // ops toggle via overrides
}
```

Launch matrix:

| Role | Primary | Fallback / future |
|---|---|---|
| Wallet custody | Magic TEE | Privy, Dynamic, native wallets |
| Smart account | ZeroDev (EVM) | EOA passthrough (Solana/Bitcoin, EVM fallback) |
| Execution | Particle (EVM cross-chain), native RPC (same-chain, Solana, Bitcoin) | future routers/bridges |
| Portfolio | Indexer API | direct RPC scan |

**Provider swap procedure** (e.g. Magic → Privy): write `PrivyWalletAdapter`
implementing `WalletPort`, register it in ProviderRegistry, flip
`providers.wallet` in affected chain definitions, run the wallet-migration
lifecycle (§9.6). Business logic untouched — this is the concrete meaning of
"minimized vendor lock-in."

---

## 8. Core Ports

Four ports. Each is a small interface with value-object inputs/outputs; no
provider types leak through signatures.

### 8.1 WalletPort — custody & provisioning

```ts
interface WalletPort {
  provision(identity: IdentityAttestation, family: ChainFamily): Promise<WalletRecord>;
  getAddress(identity: IdentityAttestation, family: ChainFamily): Promise<Address | null>;
  sign(identity: IdentityAttestation, family: ChainFamily, payload: SignPayload): Promise<Signature>;
  healthcheck(): Promise<ProviderHealth>;
}
```

- `IdentityAttestation` is a value object wrapping the verified Firebase ID
  token (issuer, subject, expiry). The port receives *proof of identity*, it
  does not own authentication.
- Magic adapter maps `family` → `X-Magic-Chain` header (`ETH`, `SOL`, `BTC`)
  and calls the TEE API. Keys never leave the enclave; "signing" is remote.
- Deterministic from the provider's perspective: same Firebase identity →
  same key → same address, which is what makes recovery = re-login (§9.5).

#### WalletPort vs IdentityPort — evaluation (required)

Considered renaming/expanding this port to `IdentityPort` owning identity
binding, wallet provisioning, key management, signer lifecycle, and the
authentication relationship. **Recommendation: keep `WalletPort`.** Reasons:

1. **Authentication already has an owner.** Firebase is the identity provider;
   the domain `User` aggregate is the identity representation. Folding auth
   into the custody port would couple *who the user is* to *who holds keys* —
   precisely the coupling that makes today's Magic↔Firebase JWT relationship
   feel special. Passing an `IdentityAttestation` value object keeps the
   relationship explicit but unowned by the port.
2. **IdentityPort would become a god-port.** Identity binding + provisioning +
   keys + signers + recovery + auth is five responsibilities. The current
   composition already separates them: `User` aggregate (identity),
   `WalletPort` (custody), `AccountPort` (signing semantics), WalletService
   (lifecycle). Composition over one deep abstraction.
3. **The rename buys nothing today and costs migration later.** If the product
   grows real identity-linking needs (multiple IdPs, linking external
   self-custody wallets, DID), introduce a *narrow* `IdentityLinkPort` beside
   `WalletPort` at that point. The seam is already clean because
   `IdentityAttestation` is the only identity-shaped thing WalletPort sees.

### 8.2 AccountPort — signing semantics & smart accounts

```ts
interface AccountPort {
  getSigner(wallet: WalletRecord, chain: ChainRef): Promise<SignerHandle>;
  upgrade(wallet: WalletRecord, chain: ChainRef): Promise<UpgradeResult>;   // 7702 delegation
  downgrade(wallet: WalletRecord, chain: ChainRef): Promise<void>;          // revoke delegation
  status(wallet: WalletRecord, chain: ChainRef): Promise<AccountMode>;      // "eoa" | "smart-7702"
}
```

- `SignerHandle` is a uniform signing facade. For EVM chains with
  `capabilities.smartWallet`, the ZeroDev adapter returns a 7702 smart signer
  (batching, sponsorship, future session keys). For Solana/Bitcoin, the EOA
  passthrough adapter returns a plain signer backed by `WalletPort.sign`.
- Consumers (TransactionOrchestrator) never branch on account mode — they call
  `signer.execute(intent)` and capabilities decide the path.

### 8.3 ExecutionPort — transaction build / submit / track

```ts
interface ExecutionPort {
  quote(intent: ExecutionIntent): Promise<ExecutionQuote>;      // fees, route, ETA
  submit(intent: ExecutionIntent, signer: SignerHandle): Promise<ExecutionReceipt>;
  trackStatus(ref: ExecutionRef): Promise<ExecutionStatus>;     // pending|confirmed|failed
}
```

- `ExecutionIntent` covers same-chain transfer, cross-chain transfer (source +
  destination `ChainRef`), contract call (Vault deposit/withdraw), and swap.
- Routing is registry-driven: `chain.providers.execution` is an ordered list;
  the DI layer composes a **failover chain** (try Particle → fall back to
  native RPC) per §22.6 rules. Cross-chain intents require an adapter whose
  provider supports `bridge` capability on both ends.
- **Particle positioning:** Particle Universal Accounts act strictly as a
  *routing/bridging engine* whose destination is always a user-owned canonical
  address. Particle never defines the user's identity address (§22.3).

### 8.4 PortfolioPort — balances & assets

```ts
interface PortfolioPort {
  fetchAssets(wallet: WalletRecord, chain: ChainRef): Promise<RawAssetPage>;
  fetchNativeBalance(address: Address, chain: ChainRef): Promise<RawBalance>;
}
```

Deliberately thin: it returns **raw provider data**. Normalization, caching,
aggregation, and refresh policy are domain concerns (PortfolioService +
Normalizer, §13) — keeping the port thin means swapping indexer vendors
touches zero business logic.

---

## 9. Wallet Model & Lifecycle

### 9.1 Family-based wallet identity

A user owns **one wallet identity per chain family**, not per chain:

```
User (identity)
│
├── WalletIdentity: EVM      → address 0xABC…   (works on Ethereum, Arbitrum,
│                                                 BNB, and any future EVM chain)
├── WalletIdentity: Solana   → address 9f3K…
└── WalletIdentity: Bitcoin  → address bc1q…
```

**Address reuse across EVM chains — consequences:**

- *UX*: one address to share/receive on any EVM chain; balances differ per
  chain but identity is stable.
- *Vault compatibility*: the address whitelisted in `Vault.sol` is the EVM
  family address; it stays valid regardless of which EVM chain the user is
  viewing, and survives the 7702 upgrade (§10.2).
- *Privacy trade-off*: activity on all EVM chains is trivially correlatable to
  one identity. Accepted for a corporate-treasury product where auditability
  is a feature; documented as a known property (§22.8). Per-chain derived
  addresses remain possible later by adding a `derivationScope` field to the
  wallet identity without changing any port.
- *Migration*: because identity → address resolution goes through
  WalletResolver (§11), a future move to per-chain addresses (or a new custody
  provider producing new addresses) is a resolver + reconciler operation, not
  a permissions rewrite.

### 9.2 Lifecycle state machine

```
                 provision (idempotent)
   signup ──────────────────────────────► DECLARED
                                             │  first successful balance sync
                                             ▼
                                          ACTIVE ◄────────────┐
                                             │                │ re-enable
              7702 delegation (EVM, lazy)    │                │
   ACTIVE(eoa) ──────────────► ACTIVE(smart-7702)             │
                                             │ chain disabled / user request
                                             ▼                │
                                          ARCHIVED ───────────┘
                                     (soft state; never hard-deleted)
```

| Phase | What happens | Notes |
|---|---|---|
| **Creation** | On signup (post Firebase auth), WalletService iterates `activeChains()` grouped by family and calls `WalletPort.provision(identity, family)` once per family. Wallet documents written as `declared`. | Idempotent + retry-safe: provisioning re-run returns the same address. Partial failure leaves missing families `declared`-absent; a repair job re-provisions on next login. |
| **Activation** | First successful portfolio sync (or first inbound funds) flips `declared → active`. On EVM, the 7702 delegation is **lazy**: executed on the user's first outgoing smart-account action, bundled into that transaction where possible. | Avoids paying delegation gas for users who never transact. |
| **Synchronization** | PortfolioService refresh loop (§13.4) stamps `syncedAt`/`syncStatus` per wallet × chain. | |
| **Backup** | No user-held seed exists. The custody backup story = Magic TEE's enclave redundancy + the identity binding (Firebase). What ArborWallet backs up: wallet *metadata* (MongoDB Atlas continuous backup) so account structure is restorable. | Provider-custody risk analyzed in §22.4. |
| **Recovery** | User recovers access by recovering their Firebase identity (email/Google). Re-login → `WalletPort.getAddress` re-derives the same wallets. No mnemonic UX. | Identity compromise = wallet compromise; mitigations in §22.4. |
| **Migration** | Provider swap or address rotation: provision new wallet identity under new provider → mark old `ARCHIVED`, new `ACTIVE` → WalletResolver now resolves the new address → MembershipReconciler updates on-chain whitelists → user sweeps/aggregates funds via TransactionOrchestrator (an internal transfer intent). | Permissions never edited manually; they follow identity (§11). |
| **Deletion policy** | Wallets are never hard-deleted (funds may exist on-chain forever). Account deletion = archive wallets, purge PII from user document, retain address records flagged `orphaned` for audit. | |
| **Archival** | Chain removed from profile → wallets on it stop syncing, UI hides them, documents remain. Re-enabling the chain restores them untouched. | |

### 9.3 Deterministic vs non-deterministic generation — decision

| Option | Verdict |
|---|---|
| **App-held HD master seed** (BIP-32/39/44, derive per user) | ❌ Rejected: makes ArborWallet's server a custodial single point of catastrophic failure; key ceremony + HSM ops out of scope. |
| **Per-user client-side seed** (user backs up mnemonic) | ❌ Rejected: contradicts the social-login product (SPEC: employees onboard with email/Google; mnemonic UX kills onboarding). |
| **Provider-deterministic (Magic TEE): identity → key inside enclave** ✅ | Chosen. Deterministic *with respect to identity*, non-custodial *with respect to ArborWallet* (we never see keys), recoverable via social login. Provider risk contained behind WalletPort. |

### 9.4 Onboarding flow

```
1. User signs up (Firebase email/Google)            [existing]
2. Frontend obtains Firebase ID token               [existing]
3. POST /api/wallets/provision (idempotent)
     → WalletService.provisionAll(identity)
         → for each family in activeProfile:  WalletPort.provision()
         → upsert wallet documents (declared)
4. Dashboard renders immediately with declared wallets (zero balances)
5. Background: first portfolio sync → wallets flip active
6. First outgoing EVM action → AccountPort.upgrade() (7702) piggybacked
```

Existing `/api/wallet/create` + `/api/wallet/address` routes become the Magic
adapter's internals; the public API becomes family-plural.

---

## 10. Smart Wallet Architecture (EIP-7702 + ZeroDev)

### 10.1 Why EIP-7702 (vs ERC-4337 standalone smart accounts)

- **Address preservation.** 7702 lets the existing Magic EOA *become* a smart
  account by delegating to contract code. The address does not change —
  existing Vault whitelists, received-funds addresses, and user-shared
  addresses all remain valid. A standalone 4337 account would mint a new
  address per user per chain and force a whitelist + funds migration.
- **Reversibility.** Delegation can be revoked (back to plain EOA), giving a
  clean downgrade path if a vulnerability is found in the delegate.
- **Ecosystem fit.** ZeroDev Kernel supports 7702 delegation and keeps the
  existing session-key machinery (already used for Vault withdrawals) in play.

### 10.2 Smart Account lifecycle

```
EOA (Magic TEE key, address A)
   │  user's first smart action on an EVM chain
   ▼
7702 delegation tx: A signs authorization → A's code slot points at
ZeroDev Kernel implementation                        [per chain]
   │
   ▼
Smart Account at address A: batching, gas sponsorship, validators,
(future) session keys — signer is still the Magic TEE key
   │  upgrade: re-delegate to new Kernel version (new authorization)
   │  downgrade: revoke delegation → plain EOA again
   ▼
Same address A throughout. Vault whitelist never changes.
```

- **Signer lifecycle:** the Magic TEE key is the root validator. Signer
  rotation (custody migration) = wallet migration (§9.2), not a smart-account
  concern; the delegate contract's ownership follows the resolver.
- **Per-chain nuance:** delegation is per-chain state. `wallets.delegations[]`
  tracks `{ chainKey, delegated, implementation, txRef }`. A user can be
  smart on Arbitrum and plain EOA on BNB; `AccountPort.status()` reads truth
  from chain, MongoDB caches it.
- **Session keys (future):** ZeroDev permission validators scoped by
  `CallPolicy` — the same mechanism the Vault already uses for
  `withdraw()`-only session keys — generalized to user-level delegated
  execution and automations. Modeled in `AccountPort` as a future
  `grantSession(policy)` extension; no schema change required.
- **Gas abstraction:** smart mode unlocks paymaster sponsorship + paying gas
  in ERC-20 (§17).
- **Security:** delegate implementation is version-pinned in ProviderRegistry
  config; upgrades are explicit re-delegations (never auto-followed);
  delegation authorizations are chain-scoped to prevent cross-chain replay
  (7702 authorizations commit to chainId; the registry supplies it).

### 10.3 EOA / Smart coexistence — unified abstraction

| Wallet flavor | Where | Signing path | User-visible? |
|---|---|---|---|
| Embedded EOA | Solana, Bitcoin, un-upgraded EVM | `WalletPort.sign` direct | No — just "your wallet" |
| Smart account (7702) | Upgraded EVM chains | ZeroDev signer wrapping `WalletPort.sign` | No — features silently better |

`AccountPort.getSigner()` is the single seam: every service asks for a
`SignerHandle` and gets whatever the chain + wallet state supports. The UI
shows capability differences only as feature availability (e.g. "gas covered"
badge when sponsorship applies), never as wallet-type jargon.

---

## 11. Identity-Based Authorization Model

### 11.1 From address-based to identity-based

```
BEFORE (SPEC.md today)                AFTER (this architecture)
──────────────────────                ─────────────────────────
Wallet address                        User Identity
   ↓                                     ↓
Whitelist (on-chain)                  Vault Membership   (MongoDB, intent)
   ↓                                     ↓
Permission                            Wallet Resolver    (identity → active wallet)
                                         ↓
                                      Active Wallet      (family address)
                                         ↓
                                      Execution          (on-chain enforcement)
```

The Vault is *mounted to identity*. Addresses become an implementation detail
resolved at execution time.

### 11.2 The projection pattern (honest constraint)

`Vault.sol` cannot verify identity — on-chain enforcement is and remains
address-based (`whitelist`, `partitionLimit`). The architecture therefore
treats the on-chain whitelist as a **derived projection** of identity-level
membership:

- **Source of authorization intent:** `vault_memberships` in MongoDB —
  "identity U is a member of partition P with limit L."
- **WalletResolver** (pure domain service): `(userId, vaultChain)` → the
  user's ACTIVE wallet identity for that chain's family → address.
- **MembershipReconciler** (background + event-driven): keeps chain state
  equal to `resolve(all active memberships)`:
  - membership added → `whitelistToPartition(partition, [addr], [limit])` via owner sudo key
  - membership removed → revoke/zero limit on-chain
  - wallet migrated (new address) → whitelist new, revoke old, atomically per
    membership; membership document tracks `onChain.syncState: pending | synced | drift`
  - **drift detection:** periodic job compares on-chain whitelist sets against
    resolved membership sets; mismatches flag `drift` and alert — chain is
    never silently "corrected" in the trusting direction (removal from Mongo
    always propagates; unexpected on-chain additions raise an incident).

### 11.3 What this decoupling buys

| Change | Permission work required |
|---|---|
| EIP-7702 upgrade | **None** — address preserved by design |
| Wallet migration (new custody provider, new address) | Automatic — reconciler re-projects |
| Provider replacement (Magic → Privy) | Automatic — same as migration |
| New EVM chain added | None — same family address already resolvable |
| Future per-chain addresses | Resolver change only; memberships untouched |

Security note: the reconciler wields the owner sudo key — it is the single
most privileged component in the system. Constraints: it may only call
`whitelistToPartition` / limit-revocation functions, every action is
idempotency-checked against on-chain state first (per existing CLAUDE.md
rule), and every action writes an audit record (§18, `activity`).

---

## 12. Vault Integration Flow

Vault remains **Arbitrum-only**; ZeroDev remains the withdrawal-authorization
layer (session keys scoped to `withdraw()`); Particle remains deposit-side.
`chain.capabilities.vault` gates all vault UX.

```
┌──────────────────────────── VAULT FLOWS ────────────────────────────┐
│                                                                     │
│ MEMBERSHIP    admin adds @user to partition                         │
│               → vault_memberships doc (Mongo)                       │
│               → MembershipReconciler → whitelistToPartition() tx    │
│                                                                     │
│ DEPOSIT       any user wallet / any chain                           │
│               → TransferService intent (recipient = vault deposit)  │
│               → TransactionOrchestrator                             │
│                  · same-chain (Arbitrum): direct deposit() call     │
│                  · cross-chain: Particle route → land on Arbitrum   │
│                    → deposit() as final leg                         │
│                                                                     │
│ WITHDRAW      member initiates (QR pay / manual)                    │
│               → VaultService validates vs membership + cached limit │
│               → withdraw() UserOp via member's ZeroDev session key  │
│               → contract enforces partition/limit (source of truth) │
│                                                                     │
│ AGGREGATED    member funds vault from scattered balances            │
│ DEPOSIT       → §16 aggregation saga, final leg = deposit()         │
└─────────────────────────────────────────────────────────────────────┘
```

How identity, membership, smart wallets, and 7702 work together: membership
lives on identity (§11); the resolver picks the member's EVM family address;
that address is simultaneously the 7702 smart account executing withdrawals
via session key and the whitelisted address the contract checks. Because 7702
preserves addresses, **existing whitelist entries remain valid with zero
migration** — the single most important compatibility property of this design.

Required architectural changes to existing Vault code: none on-chain. Off-chain:
`users/partitions/fund-requests` API routes re-point from Postgres schema to
MongoDB collections (§18, §21), and whitelist writes move from ad-hoc calls
into MembershipReconciler.

---

## 13. Portfolio Architecture

### 13.1 Pipeline

```
Indexer Adapter (per family; primary)      RPC Adapter (fallback)
        │                                        │
        └──────────────┬─────────────────────────┘
                       ▼
             Portfolio Normalizer
     (family-specific raw → NormalizedAsset)
                       ▼
              MongoDB Cache (portfolio_cache)
                       ▼
                 PortfolioPort reads ──► PortfolioService ──► UI view-models
```

*(Note: the adapters implement `PortfolioPort` for fetching; the cache sits
between adapters and the service — reads hit Mongo, misses/refreshes hit
adapters.)*

### 13.2 Normalized asset model

```ts
interface NormalizedAsset {
  assetKey: string;          // "ethereum-sepolia:native" | "arbitrum-one:erc20:0xA0b8..."
  chainKey: ChainKey;
  environment: NetworkClass;
  kind: "native" | "erc20" | "spl" | "utxo" | "nft";   // family token standards
  symbol: string; name: string; decimals: number;
  raw: string;               // integer string, chain units (wei / lamports / sats)
  display: string;           // decimal-adjusted
  usdValue?: number;         // priced via cached feed; null if unpriced
  priceStale: boolean;
}
```

One model serves EVM (native + ERC-20), Solana (native + SPL), Bitcoin (UTXO
sum as one native balance). NFTs reserved via `kind: "nft"` — schema-ready,
not implemented.

### 13.3 Aggregation levels

PortfolioService composes cached assets into: **total portfolio value** (sum
of `usdValue` across active wallets in the active environment) → **by chain**
→ **by wallet (family)** → **by token**. All derived in-memory from one cache
read; no per-view queries to chains.

### 13.4 Refresh, invalidation, staleness

| Trigger | Behavior |
|---|---|
| **On view** | Serve cache immediately; if `syncedAt` older than TTL (fast chains 30s, Bitcoin 5m), kick background refresh (stale-while-revalidate). |
| **Post-transaction** | Orchestrator invalidates affected `(wallet, chain)` entries on confirmation; targeted refetch. |
| **Background** | Rolling sweep refreshes active wallets at chain-appropriate cadence; inactive users decay to slow cadence. |
| **Manual** | Pull-to-refresh forces bypass, rate-limited per user. |

- **Stale data handling:** cache entries carry `syncedAt` + `syncStatus
  (fresh | refreshing | stale | error)`. UI renders stale values greyed with a
  "last updated" stamp rather than blanking — money UIs should degrade
  loudly, not emptily. Persistent `error` per chain surfaces as a chain-level
  banner ("Solana balances unavailable").
- **RPC redundancy:** registry RPC pools are ordered; adapters rotate on
  failure with per-endpoint circuit breakers (open after N consecutive
  failures, half-open probes). Indexer outage → automatic fallback to RPC
  adapter (native balances + curated token list only — degraded but correct).
- **Consistency stance:** cache is *eventually consistent by design*; the
  chain is the source of truth. Pre-flight balance checks for transfers (§15)
  always re-verify against chain, never trust cache (§22.5).

---

## 14. Default Wallet

- **Semantics:** the default wallet is a **chainKey-level choice** (Ethereum
  vs Arbitrum are different defaults even though the address is the same EVM
  identity). Initial default: Ethereum (`ethereum-*` per environment).
  Options at launch: Ethereum, Bitcoin, Solana, BNB Chain, Arbitrum — i.e.
  any active chain with `defaultWalletEligible: true`.
- **Storage:** on the user document, per environment:
  `preferences.defaultChain: { test: "ethereum-sepolia", main: "ethereum-mainnet" }`.
  Per-environment keys mean a testnet default can never leak into mainnet
  behavior. (Stored on `users`, not as a wallet flag — it's a preference about
  chains, not a property of a wallet document.)
- **Backend validation:** `PATCH /api/preferences/default-chain` validates:
  chain exists in active registry → `defaultWalletEligible` → user's family
  wallet for it is ACTIVE. Reject otherwise.
- **Frontend flow:** Settings → "Default wallet" selector listing eligible
  chains from registry data (name, icon, capability hints). Change is
  immediate; transfer screen picks it up next open.
- **Usage:** TransferService reads the default chain as the *source* seed for
  every new transfer intent (§15) — the sender's starting wallet, and the
  balance checked first in aggregation (§16).
- **Migration/fallback:** if a default chain is later deactivated in a
  profile, resolution falls back to the first eligible active chain and the
  UI prompts re-selection. New users get the environment's configured initial
  default (Ethereum).

---

## 15. Transfer Architecture

### 15.1 Separation: intent vs orchestration vs execution

```
TransferService            — business intent, validation, UX states
      ↓
TransactionOrchestrator    — saga engine: planning, legs, retries, rollback
      ↓
ExecutionPort              — chain-facing quote/submit/track
```

TransferService owns *what the user wants* (send 50 USDC to @maya). The
orchestrator owns *how it happens* (2 legs, bridge route, retry policy). Ports
own *talking to chains*. This split keeps business rules testable without
saga machinery and keeps saga machinery reusable (vault deposits, §16
aggregation, and future swaps all ride the same orchestrator).

### 15.2 Recipient & chain resolution

```
input ──► "@username"  ──► users lookup (Mongo) ──► recipient's default chain
   │                        └─ not found → error (no fuzzy match — §22.9)
   │                        recipient's WalletResolver → address on that chain
   │
   └────► raw address  ──► format detection: 0x… → EVM (chain must be picked
                            or defaulted — EVM addresses are chain-ambiguous);
                            base58 → Solana; bech32/base58check → Bitcoin
                            → validated against active environment's registry
```

Chain resolution precedence: explicit user choice → recipient's default chain
(username path) → sender's default chain (address path, same-family). The
signer is then selected by `AccountPort.getSigner(senderWallet, sourceChain)`.

### 15.3 Execution pipeline & saga

```
quote → confirm → execute → settle

transfer_intents (Mongo)                    transfer_legs (Mongo)
status: draft → quoted → approved →         each leg: pending → submitted →
executing → settled | failed |              confirmed | failed
partially_settled
```

1. **Quote:** orchestrator plans legs. Same-chain = 1 leg. Cross-chain = route
   legs via an execution provider with `bridge` capability (Particle on EVM),
   else reject with "route unavailable." Quote includes fees, ETA, and the
   exact leg list — shown in the confirmation UI (and the existing
   "View Infrastructure" panel gets the full technical trace).
2. **Pre-flight:** balances re-verified against chain (never cache), amounts
   locked into the intent, idempotency key minted.
3. **Execute:** legs run sequentially (a leg's output funds the next).
   Each leg: `quote → submit → trackStatus` with per-leg retry
   (exponential backoff; resubmission guarded by idempotency key + on-chain
   nonce/txRef checks so a retry can never double-send).
4. **Confirmation flow:** intent progress streamed to the UI per leg
   ("1/2 bridged… 2/2 delivering") from saga state — real progress tracking,
   not spinner theatre.
5. **Failure & rollback:** the invariant that makes rollback tractable —
   **every intermediate leg lands in a wallet the user owns.** Worst case, a
   mid-saga failure strands funds in the user's own wallet on some chain, never
   in third-party limbo. Rollback is therefore *halt + report + offer resume*:
   no compensating transactions are fabricated. `partially_settled` intents
   show exactly where funds sit and offer "retry remaining legs" or "keep
   funds where they are."
6. **Timeouts:** per-leg deadline (chain-appropriate: EVM minutes, Bitcoin
   hours). Expired legs → `failed(timeout)` → same halt+resume path. A
   background janitor re-polls `submitted` legs whose tracker died (crash
   recovery: sagas are resumable from Mongo state alone).
7. **Notifications:** settle/fail/partial events append to `activity` and
   surface as in-app notifications.

---

## 16. Automatic Balance Aggregation

The workflow (per approved spec):

```
user initiates transfer of amount X
        │
        ▼
default wallet balance ≥ X ?        [pre-flight, chain-verified]
        │yes                    │no
        ▼                       ▼
  normal §15 pipeline     aggregation quote:
                          scan user's other ACTIVE wallets (portfolio cache,
                          then chain-verify candidates); orchestrator plans
                          collection legs (cheapest-route-first: same-family
                          before cross-family; skip dust below fee floor)
                                │
                                ▼
                          CONFIRMATION DIALOG (explicit, itemized):
                          "Default wallet holds 30 USDC of 50. Pull 20 USDC
                           from Arbitrum (fee ~$0.12, ETA ~40s)?  [Approve]"
                                │approve
                                ▼
                          aggregation saga:
                          leg 1..n  collect → default wallet (or directly →
                                    destination when routing allows skipping
                                    the hop — orchestrator decides)
                          leg n+1   final delivery → recipient or Vault
                                │
                                ▼
                          settled → notify; partial failure → halt+resume (§15.5)
```

- **Orchestration/order:** collection legs may run in parallel (independent
  sources); the delivery leg waits for sufficient landed balance — not
  necessarily *all* legs (if 2 of 3 collections suffice, deliver; the
  straggler cancels).
- **Partial failure:** funds pulled so far sit in the user's default wallet —
  safe by the §15.5 invariant. User chooses: retry failed leg, deliver partial
  amount, or stop.
- **Security implications:** aggregation moves *user funds between user
  wallets* — no new trust surface vs a normal transfer, but the confirmation
  dialog must itemize every source, amount, and fee (informed consent);
  aggregation quotes are rate-limited per user (each quote costs RPC/bridge
  calls — DoS surface, §22.9); and the feature is gated per chain by
  `capabilities.bridge` (Bitcoin sources excluded initially, §22.7).

---

## 17. Paymaster Strategy

- **Scope:** paymaster = EVM chains with `capabilities.paymaster` in smart
  (7702) mode via ZeroDev's paymaster on the existing gas-policy setup.
  Solana/Bitcoin: no AA paymaster; fees paid natively (Solana fee-payer
  sponsorship is a possible future execution-adapter feature, flagged off).
- **Policy engine (domain):** `PaymasterPolicy` decides per operation:
  `sponsor | user_pays_native | user_pays_erc20`. Inputs: environment profile
  tier (`none`/`capped`/`full`), per-user quota, op type (vault withdrawals
  sponsored — existing behavior preserved; personal transfers capped),
  fee-token allowlist from registry.
- **Quota & abuse prevention:** `paymaster_quotas` (Mongo): rolling-window
  sponsored-op count + gas spend per user; thresholds per profile (testnet
  generous, mainnet conservative). Exceed → graceful fallback to
  `user_pays_native` (never a hard block on moving one's own funds).
  Global circuit breaker on aggregate daily sponsorship spend.
- **Fallback chain:** sponsor → ERC-20 gas payment → native gas. UI copy
  stays in finance language ("Network fee: covered / $0.12").
- **Future monetization:** fee-token payment with margin, sponsorship tiers as
  a workspace billing feature, vault-owner-funded sponsorship pools for
  members. All are policy-engine changes; no port or adapter changes.
- **Recommendation:** single vendor (ZeroDev) at launch — it already holds the
  session-key + kernel relationship; a second paymaster vendor would be a new
  `ProviderRegistry` entry consumed inside the execution adapter, so the swap
  path exists but is not pre-built (YAGNI).

---

## 18. MongoDB Schema Proposal

MongoDB Atlas = primary off-chain datastore. Blockchain = source of truth for
vault state, treasury balances, contract state, execution, permissions,
spending limits. Mongo never stores authoritative financial state — only
identity, intent, metadata, and caches derived from chain.

Conventions: every chain-touching collection carries `environment`; all listed
indexes are compound-leading with it; amounts are integer strings in chain
units; `write concern: majority` for identity/membership/saga collections
(§22.5).

```
users
{ _id, firebaseUid (uq), username (uq, immutable-ish), email,
  preferences: { defaultChain: { test: ChainKey, main: ChainKey },
                 displayCurrency },
  status: active|suspended|deleted, createdAt, updatedAt }
  idx: firebaseUid, username

wallets                                  // one doc per (user, family, environment)
{ _id, userId, family: evm|solana|bitcoin, environment,
  address, provider: ProviderKey, providerRef,
  walletType: eoa|smart,                 // family-level summary
  delegations: [ { chainKey, delegated: bool, implementation, txRef, at } ],
  status: declared|active|archived, createdAt, syncedAt }
  idx: (userId, family, environment) unique; (environment, address)

vaults
{ _id, label, contractAddress, chainKey, environment, ownerUserId,
  workspaceId?, createdAt }

vault_memberships                        // identity-level authorization intent (§11)
{ _id, vaultId, userId, partitionOnChainId, role: member|owner,
  limits: { limitWei, spentWeiCached, cachedAt },   // display cache ONLY
  onChain: { projectedAddress, syncState: pending|synced|drift, lastTxRef },
  status: active|revoked, environment, createdAt }
  idx: (vaultId, userId) unique; (userId, environment); onChain.syncState

workspaces / workspace_memberships       // org grouping above vaults
{ _id, name, ownerUserId, createdAt } /
{ _id, workspaceId, userId, role, createdAt }

contacts
{ _id, userId, alias, target: { kind: username|address, value, family? },
  createdAt }

portfolio_cache                          // one doc per (wallet, chainKey)
{ _id, walletId, userId, chainKey, environment,
  assets: [ NormalizedAsset ],           // §13.2
  syncedAt, syncStatus: fresh|refreshing|stale|error, source: indexer|rpc }
  idx: (walletId, chainKey) unique; (userId, environment); syncedAt

transfer_intents                         // saga root (§15)
{ _id, userId, environment, idempotencyKey (uq),
  kind: transfer|vault_deposit|aggregation,
  recipient: { kind: username|address|vault, value,
               resolvedUserId?, resolvedAddress, chainKey },
  asset: { assetKey, amountRaw },
  sourceChainKey, quote: { fees, eta, legPlan },
  status: draft|quoted|approved|executing|settled|partially_settled|failed,
  createdAt, updatedAt }
  idx: (userId, environment, createdAt); status; idempotencyKey unique

transfer_legs
{ _id, intentId, seq, kind: same_chain|bridge|vault_deposit|collect,
  fromChainKey, toChainKey, provider: ProviderKey,
  status: pending|submitted|confirmed|failed,
  txRef, attempts, deadlineAt, error?, updatedAt }
  idx: (intentId, seq) unique; (status, deadlineAt)   // janitor scan

activity                                 // timeline + audit (incl. reconciler actions)
{ _id, userId?, environment, kind, refs: { intentId?, membershipId?, txRef? },
  summary, at }
  idx: (userId, environment, at desc); (kind, at)

paymaster_quotas
{ _id, userId, environment, windowStart, sponsoredOps, gasSpendWei, tier }
  idx: (userId, environment, windowStart) unique

registry_overrides                       // ops-time config (§5.5) — narrow-only
{ _id, scope: chain|provider, key, patch, reason, actor, createdAt, expiresAt? }

provider_runtime                         // ProviderRegistry health/status metadata
{ _id, providerKey, status: active|degraded|disabled, lastCheckAt, notes }
```

Carried over from the existing Postgres design (SPEC.md) as collections with
the same responsibilities: `fund_requests`, `invoices`, `transactions`
(indexed on-chain events) — re-shaped to documents, each gaining
`environment` and `chainKey` fields. The on-chain event indexer writes
`transactions`; reporting reads Mongo, verification reads chain.

---

## 19. UI & UX — Environment Awareness

- **Persistent environment badge** in the nav (existing brutalist chip
  style): `TESTNET` (warning color) vs `MAINNET` (neutral) — driven by
  `profile.bannerStyle`, rendered app-wide, non-dismissable on testnet.
- **Non-production banner** on `local`/`development`/`staging`: thin top bar
  naming the profile.
- **Faucet affordances** (existing Settings pattern) render only when
  `profile.faucetsEnabled` and the chain has a `faucet` entry — registry-driven,
  per chain.
- **No user-facing network selector at launch** (one deployment = one
  environment). The Settings page shows the active environment read-only with
  a link to the counterpart deployment (testnet ↔ mainnet URLs), which is the
  honest version of a "network selector" under this deployment model.
- **Asset displays** always carry chain context (chain icon per balance row),
  and testnet asset values render with a "no real value" hint instead of USD.
- Existing design language (DESIGN.md product neo-brutalism, finance-first
  copy, "View Infrastructure" panels) extends unchanged: transfer sagas feed
  the infrastructure panel with leg/route/sponsorship traces.

---

## 20. Extensibility Playbooks

### 20.1 Add a chain

| Case | Work | Touches business logic? |
|---|---|---|
| New EVM chain (Base, Polygon, Optimism, Avalanche) | 1 registry file: key, chainId, RPCs, explorer, tokens, capabilities, flags. Add to profile `activeChainKeys`. | **No** |
| New chain in existing non-EVM family | Registry file (same as above). | **No** |
| New family (Sui, Aptos, Starknet, Bitcoin L2 with novel semantics) | Registry file + one adapter set (execution, portfolio normalizer branch, address validation) + WalletPort provider support for the family (Magic chain support or alternate custody provider entry). | **No** — new code is all adapter-layer |
| Private / local network | Registry entry with `environment: local`, used by `local` profile. | **No** |

### 20.2 Add a provider

Write adapter implementing the relevant port → register in ProviderRegistry →
reference its key from chain definitions (or profile override). Migration of
existing users (custody providers only) follows §9.2 Migration.

### 20.3 Add an environment

Add an `EnvironmentProfile` (name, networkClass, chain list, flags). Deploy
with `APP_ENV_PROFILE=<name>`. Data isolation is automatic via the
environment tagging rules (§4.2).

### 20.4 Add a wallet technology

New signing semantics (e.g. passkey-native accounts, MPC threshold signers)
enter as `AccountPort`/`WalletPort` adapters; the `SignerHandle` seam means
orchestrator and services are unaffected.

---

## 21. Migration Considerations

Current state (per repo): Arbitrum-Sepolia-only, Magic TEE ETH wallet,
Firebase auth, mock data + partial API routes, Postgres schema *designed* (in
SPEC.md) but the app largely runs on mocks.

**Sequenced migration:**

1. **Config extraction (no behavior change).** Introduce ChainRegistry +
   EnvironmentProfile; move the hardcoded Arbitrum Sepolia RPC/chainId
   (currently in `web/src/lib/format.ts`, AGENTS.md conventions) into
   `arbitrum-sepolia` registry entry. App still single-chain.
2. **Ports around existing behavior.** Wrap Magic TEE routes in
   MagicWalletAdapter/WalletPort; wrap balance fetch in RpcPortfolioAdapter.
   Existing `/api/wallet/*` routes become adapter internals.
3. **MongoDB Atlas stand-up.** Implement §18 collections; since production
   Postgres data is effectively absent (mock-stage app), this is a
   greenfield adoption, not a data migration — the Postgres schema in SPEC.md
   is superseded. Update SPEC.md/CLAUDE.md references when implementation
   starts.
4. **Multi-family provisioning.** Extend provisioning to SOL/BTC (after the
   Magic TEE support verification spike — §22.4). Wallet docs, portfolio
   pipeline, dashboard aggregation.
5. **Identity-based vault membership.** Introduce `vault_memberships` +
   WalletResolver + MembershipReconciler; existing whitelisted addresses are
   backfilled into membership docs (`syncState: synced`) — a metadata import,
   with zero on-chain changes.
6. **7702 + transfers.** AccountPort/ZeroDev delegation, then
   TransferService/Orchestrator, then Particle execution adapter, then
   aggregation.

Each step is independently shippable; steps 1–3 carry no user-visible risk.

**Compatibility invariants preserved throughout:** existing wallet addresses
(Magic-derived) never change; Vault whitelists never require on-chain
migration (7702 address preservation); Firebase remains the identity root.

---

## 22. Critical Architecture Review

Honest assessment. Items marked ⚠ are accepted risks with mitigations; ✋ are
open verification tasks that gate implementation phases.

### 22.1 Hidden coupling

- **MembershipReconciler couples Mongo → chain via the owner sudo key.** It
  is the most privileged component; a bug can rewrite whitelists. Mitigation:
  narrow command surface, on-chain idempotency pre-checks, full audit trail,
  drift detection that alerts instead of auto-correcting suspicious states
  (§11.2). Residual risk accepted — some component must hold this power.
- **`IdentityAttestation` still assumes a JWT-shaped identity.** A future IdP
  change (non-Firebase) reshapes the value object. Contained: only WalletPort
  adapters consume it.
- **Registry runtime overrides create a second config truth.** Mitigated by
  the narrow-only rule (§5.5), `expiresAt` on overrides, and boot-time logging
  of the merged effective config. Drift between code truth and Mongo overrides
  remains an ops hazard worth a dashboard.

### 22.2 Abstraction level — why four ports (not seven, not two)

Seven single-purpose adapters (per original requirement) would make Explorer/
Paymaster/Faucet "adapters" that contain no behavior — pure config indirection,
cost without benefit. Two ports (wallet + chain) would force the orchestrator
to know signing semantics. Four ports match the four real *behavioral* seams:
custody, signing semantics, execution, and data reading. Composition covers
the rest as registry data. If a fifth genuine seam emerges (e.g. swap routing
grows beyond execution), add a port then — ports are cheap to add, expensive
to remove.

### 22.3 Particle Universal Accounts vs canonical 7702 address ✋

Particle UA historically deploys **its own smart-account addresses** per user.
Letting UA define user addresses would fork identity against the 7702 design.
Decision: Particle is *routing only* — sources and destinations are always the
user's canonical wallets; any Particle-internal account is an invisible
transit detail *provided funds never rest there beyond a transaction's
lifetime*. **Verification spike required:** confirm Particle's current API
supports destination-address routing in this mode, and confirm its testnet
coverage. If either fails: testnet profile uses native-RPC execution only
(capability flags already express this), and/or Particle is replaced by a
bridge aggregator behind the same ExecutionPort. Vendor risk is real but
contained to one adapter.

### 22.4 Custody concentration & Magic TEE ✋

- **Magic TEE multi-chain support (BTC/SOL via `X-Magic-Chain`) is unverified.**
  Gate: verification spike before Phase 4 of §21. If unsupported, the family's
  custody routes to another provider (Privy/Dynamic) via ProviderRegistry —
  the architecture holds, launch chain set may stagger.
- **Magic outage = no signing, app-wide.** No hot fallback exists for custody
  (keys are *in* their enclave). Mitigations: provider health surfaced in
  `provider_runtime`, honest degraded-mode UX (balances readable, sends
  disabled), and the migration path (§9.2) as the strategic exit. This is the
  single largest availability risk in the design and cannot be abstracted
  away — only made visible and swappable.
- **Identity compromise = wallet compromise** (Firebase account takeover
  reaches funds). Mitigations: Firebase MFA enforcement for mainnet profile,
  step-up confirmation for large transfers (policy hook in TransferService),
  and session revocation propagating to API routes.

### 22.5 MongoDB consistency vs blockchain finality

Mongo is eventually consistent relative to chain truth and must never be the
basis for irreversible decisions:

- **Rule: caches display, chains decide.** Pre-flight checks (transfer
  balance, vault limits at execution) go to chain; Mongo caches serve UI only.
  Vault limits are additionally enforced by the contract itself — the cache
  being wrong can annoy, not steal.
- **Reorgs/finality:** leg confirmation uses chain-appropriate finality rules
  from the registry (EVM: N confirmations / finalized tag; Solana: finalized
  commitment; Bitcoin: configurable depth, default 3). The indexer writes
  `transactions` only past the finality bar.
- **Write concern `majority`** on identity/membership/saga collections so a
  primary failover cannot lose an approved intent or membership change.
- **Saga resumability:** all orchestrator state persists in Mongo; process
  crash mid-saga resumes from `transfer_legs` state (plus on-chain txRef
  re-checks). No in-memory-only execution state, ever.

### 22.6 Scalability & performance bottlenecks

- **The real cost center is indexing/synchronization ops, not adapters.**
  Portfolio freshness across 5+ chains × all users dominates infra spend and
  engineering time. Registry/ports are one-time costs; sync is forever.
  Design responses: indexer-first with RPC fallback, per-chain cadences,
  activity-based decay, and the stale-not-blank UI contract (§13.4).
- **RPC quotas:** registry RPC pools + circuit breakers + per-user manual
  refresh rate limits. Mainnet profile should budget for paid RPC/indexer
  tiers from day one.
- **Orchestrator throughput:** sagas are Mongo-backed and horizontally
  shardable by intentId; the janitor scan indexes `(status, deadlineAt)`.
  Not a launch bottleneck; noted for scale.

### 22.7 Bitcoin is the structural outlier ⚠

UTXO model, no smart accounts, no 7702, no paymaster, slow finality, and the
weakest indexer/bridge story. Phasing recommendation (accepted into plan):
**Bitcoin launches receive + balance only**; sending ships later; Bitcoin is
excluded from aggregation sources initially (`capabilities.bridge: false`).
This honestly narrows "5 chains at launch" to "5 chains visible, 4 fully
transactional" — better than shipping a fragile BTC send path.

### 22.8 Privacy: single EVM address across chains ⚠

Full cross-chain correlatability of a user's EVM activity. Accepted for a
treasury/corporate product where auditability is desired. Escape hatch
designed (per-chain derivation via resolver, §9.1) but not built.

### 22.9 UX & abuse edges

- **@username transfers:** usernames are permanent-ish handles (immutable-ish
  in §18) to prevent handle-reuse hijacking; no fuzzy matching on recipient
  lookup (typo → error, not "did you mean"); recipient confirmation screen
  shows display name + short address for out-of-band verification.
  Username squatting policy is a product decision to schedule.
- **Aggregation quote DoS:** quotes fan out to RPCs/bridges; rate-limit per
  user and cache quotes briefly.
- **Paymaster farming:** quotas + global circuit breaker (§17).
- **Testnet↔mainnet confusion:** §4.2 isolation + §19 badges; the remaining
  human risk (user *thinks* they're on the other deployment) is mitigated by
  the no-USD-on-testnet display rule.

### 22.10 Was a better architecture considered?

- **Event-sourced ledger core** (all state as event log, projections for
  views): stronger audit + replay, but heavy ceremony for a team of 2–3 on a
  Next.js monolith; the `activity` collection + on-chain events already give
  an audit trail. Rejected for now; the saga tables are event-shaped enough
  to evolve toward it.
- **Separate wallet microservice**: isolation of the privileged reconciler is
  attractive, but operationally premature. The module boundary (§3.4) is the
  microservice seam if/when extraction is warranted.
- **Provider-centric (all-in on Particle)**: fastest to demo, rejected —
  §22.3's identity conflict plus wholesale lock-in violate core goals.

**Conclusion:** the domain-centric registry/port architecture stands as the
recommendation. Its weakest genuinely-architectural point is custody
concentration (§22.4), which no software abstraction can remove — the design
makes it *visible* (health, degraded mode) and *exitable* (WalletPort +
migration lifecycle), which is the strongest available position short of
self-custody, which the product's onboarding model rules out.

---

*End of Planning.md*
