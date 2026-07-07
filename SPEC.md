# ArborWallet — Corporate Fund Distribution System

Corporate wallet distribution system on Arbitrum. Corporation deposits ETH into a
single on-chain Vault, splits it into partitions, whitelists Social IDs (usernames)
per partition with per-user spend limits, and tracks everything for reporting.

Hackathon: General Track, ZeroDev subtrack (Particle Network Universal Accounts
used for treasury funding only — not competing on the Universal Accounts track).

## Tech stack — role assignments

| Layer | Tool | Job |
|---|---|---|
| Auth / identity | Magic Wallet | Social/email login → deterministic embedded signer per user. This signer's address is what gets whitelisted. |
| Treasury funding | Particle Network (Universal Account) | Corporate finance deposits from any chain/token → Particle bridges/lands ETH into the Vault on Arbitrum. Deposit-side only. |
| Vault control / session keys | ZeroDev Kernel | The Vault's controlling smart account. Owner holds sudo validator. Each whitelisted Social ID gets a session key scoped via ZeroDev Permissions `CallPolicy` to only call `Vault.withdraw()`. Withdraw-side only. |
| Execution client | viem + Wagmi | viem for ZeroDev/Particle calls; Wagmi for React wallet-state hooks. |
| Chain | Arbitrum Sepolia (421614) for demo, Arbitrum One (42161) for prod |
| Backend | Next.js API routes + PostgreSQL | Social ID ↔ address mapping, partitions, fund requests, invoices, transaction indexing/reporting. |
| Files | Pinata | Invoice uploads → IPFS, CID stored in DB + emitted on-chain. |
| Automation | Gelato Web3 Functions | Watches partition due-dates, permissionlessly calls `Vault.releaseVault(partitionId)`. |
| Frontend | React + TypeScript + Tailwind + anime.js | Brutalist UI. |

Particle and ZeroDev never touch the same account: Particle moves money into the
Vault, ZeroDev session keys move money out. They meet only at the Vault contract's
`deposit()` / `withdraw()` boundary.

## Features

1. Social ID (username) replaces raw whitelisted address.
2. Invoice (proof of usage) via IPFS/Pinata, required on every withdraw.
3. Fund Request — off-chain request when a user hits their partition limit, owner
   approves, backend sends on-chain tx raising the limit.
4. Main Wallet Partition
   - Vault auto-release on due date to an arrayed Social ID list (salary), triggered
     by Gelato Web3 Function calling `releaseVault()`.
   - Owner (`msg.sender == owner`) splits Main Wallet into partitions, each with its
     own whitelist; whitelisted users can only spend within their partition.
   - Optional backup partition with no whitelist yet — holding pool for unassigned
     funds.
5. Transaction Report — grouped by timestamp, user, amount, partition.
6. QR Code generation.
7. QR Code Payment — Vault pays out to a scanning merchant (invoice/expense payout
   flow), not top-up.

## Smart contract — `Vault.sol`

```solidity
address public owner; // ZeroDev Kernel account of corp owner (sudo validator)

struct Partition {
    uint256 balance;
    uint256 dueDate;        // 0 = no auto-release
    bool isBackup;          // true = no whitelist yet, holding pool
    address[] whitelist;    // Social-ID-resolved addresses
}

mapping(uint256 => Partition) public partitions;
mapping(uint256 => mapping(address => uint256)) public partitionLimit;
mapping(uint256 => mapping(address => uint256)) public partitionSpent;
mapping(bytes32 => bool) public processedInvoices; // invoice CID hash -> used
uint256 public partitionCount;
```

Functions: `deposit(partitionId)`, `createPartition(dueDate, isBackup)`,
`whitelistToPartition(partitionId, users[], limits[])`, `withdraw(partitionId, to,
amount, invoiceCidHash)` (only fn the ZeroDev session key `CallPolicy` targets),
`requestApproved(partitionId, user, additionalLimit)`, `releaseVault(partitionId)`
(permissionless, Gelato-called).

Events: `Deposited`, `PartitionCreated`, `Whitelisted`,
`Withdrawn(partitionId, user, amount, invoiceCidHash)`, `FundRequestApproved`,
`VaultReleased`.

Authorization logic (limits, whitelist, partitions) lives in the contract — the
ZeroDev session key only scopes *which function* can be called, not the business
rules around amount/partition.

## Database schema (Postgres)

```
users(id, social_id UNIQUE, address, magic_issuer, created_at)
partitions(id, on_chain_id, corp_id, label, is_backup, due_date, created_at)
partition_members(partition_id, user_id, limit_wei, spent_wei)
fund_requests(id, partition_id, user_id, amount_wei, reason, status, requested_at, approved_at)
invoices(id, cid, hash, partition_id, user_id, amount_wei, tx_hash, created_at)
transactions(id, tx_hash, partition_id, user_id, amount_wei, type, timestamp)
```

## Off-chain flows

- **Social ID registration**: Magic login → deterministic address → backend stores
  `{ social_id, address, magic_issuer }`. Owner picks usernames when whitelisting;
  backend resolves username → address before calling `whitelistToPartition`.
- **Fund Request**: employee over limit → `POST /api/fund-requests` (status
  `pending`) → owner approves in dashboard → backend sends `requestApproved()` via
  owner's ZeroDev sudo key → row flips to `approved` on confirmation.
- **Invoice upload**: file → Pinata pin → CID → `keccak256` hash → passed as
  `invoiceCidHash` into `withdraw()`. `processedInvoices` mapping blocks reuse.
- **QR payment**: employee generates QR encoding `{ partitionId, amount,
  merchantAddress, invoiceRef, nonce, expiry }` → merchant scans → backend
  validates → builds `withdraw()` UserOp via employee's ZeroDev session key →
  sponsored submit → funds land in merchant wallet.
- **Auto-release**: Gelato Web3 Function polls `dueDate` per partition, calls
  `releaseVault(id)` permissionlessly when due.

## Frontend

React + TS + Tailwind + Wagmi + viem. anime.js for QR reveal, partition-balance
bar fill on withdraw, hard-cut brutalist modal transitions (no ease-in-out).

Brutalist design system: raw black borders (2–4px, no border-radius except one
deliberate accent shape), high contrast (black/white + one alarm color for
over-limit states), monospace/grotesk display font, exposed grid lines, oversized
balance numerals, hard offset shadows (`box-shadow: 6px 6px 0 #000`) instead of
blur shadows.

## Open assumptions

- Single corp per deployed Vault instance (no factory-of-corporations).
- Testnet target = Arbitrum Sepolia for demo; mainnet is a config swap.
- Gelato picked over Chainlink Automation for `releaseVault` trigger.
- Salary auto-release assumes equal split across whitelist unless per-user salary
  amounts are added later.

## Repo scaffold (to fill in)

- `contracts/` — `Vault.sol`, deploy scripts, tests
- `backend/` — Next.js API routes, Postgres schema/migrations
- `frontend/` — React + TS + Tailwind + anime.js app
- `lib/` — Magic / Particle / ZeroDev client wiring, shared across frontend/backend
