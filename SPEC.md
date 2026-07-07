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
| Frontend | React + TypeScript + Tailwind + anime.js | Neo Brutalist UI. |

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
6. QR Code generation — two kinds:
   a. Merchant QR (static): merchant displays a QR encoding their own receiving
      address (`ethereum:<address>`, EIP-681 style). Merchant needs no
      ArborWallet account/Social ID — any EOA works (existing wallet, or a
      Magic login done on the spot if they have none).
   b. Payment-request QR (dynamic): employee generates a QR encoding a signed
      payment intent `{ partitionId, amount, invoiceRef, nonce, expiry }` with
      a visible countdown. Scanning it opens a claim page where the payee
      supplies/connects a receiving address; backend validates the intent and
      executes the payout.
7. QR Code Payment — invoice/expense payout flow, not top-up. Two directions:
   a. Scan-to-pay (QRIS-style): employee scans a merchant's static QR
      (captures `to` address), enters amount, attaches invoice; Vault pays out
      from the employee's partition to that address.
   b. Request-to-claim: payee scans the employee's payment-request QR before
      `expiry`, provides a receiving address on the claim page, backend
      validates + submits the withdraw. Countdown expiry + nonce prevent
      reuse.

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
- **QR payment (scan-to-pay)**: merchant displays a static QR encoding their
  own address (`ethereum:<address>`, EIP-681) — needs no ArborWallet account.
  Employee scans it in-app, capturing `merchantAddress`; enters `amount`,
  attaches invoice (Pinata CID/hash) → backend validates against
  `partitionLimit` → builds `withdraw(partitionId, merchantAddress, amount,
  invoiceCidHash)` UserOp via employee's ZeroDev session key → sponsored
  submit → funds land directly in merchant's wallet, no further action from
  merchant.
- **QR payment (request-to-claim)**: employee generates a signed payment
  intent `{ partitionId, amount, invoiceRef, nonce, expiry }` rendered as a
  QR with countdown. Payee scans → claim page → supplies/connects receiving
  address → backend verifies signature, expiry, nonce unused, limit → builds
  the same `withdraw()` UserOp via the employee's session key → payout.
  Nonce stored in DB, marked spent on execution.
- **Currency display**: UI shows fiat by default with one-tap toggle to ETH.
  Backend proxies a price feed (e.g. CoinGecko) and caches it; on-chain values
  stay wei, conversion is display-only.
- **Auto-release**: Gelato Web3 Function polls `dueDate` per partition, calls
  `releaseVault(id)` permissionlessly when due.

## Frontend

React + TS + Tailwind + Wagmi + viem + anime.js. Design direction lives in
`web/DESIGN.md` (source of truth): "product neo-brutalism" — Stripe-like
treasury software with a neo-brutalist visual skin (2px borders, hard offset
shadows, Inter/Geist + JetBrains Mono for technical data, #12AAFF accent).
Blockchain infrastructure is hidden from primary flows; user-facing copy is
finance language ("Confirm Payment", not "Sign UserOperation"). Tech surfaces
only in a polished "View Infrastructure" expandable panel per key flow —
session key scope, UserOp hash, paymaster sponsorship — designed as
first-class UI for the ZeroDev-subtrack demo, not a debug dump. Fiat-first
balances with one-tap ETH toggle. Motion under 250 ms, state-communicating
only.

## Open assumptions

- Single corp per deployed Vault instance (no factory-of-corporations).
- Testnet target = Arbitrum Sepolia for demo; mainnet is a config swap.
- Gelato picked over Chainlink Automation for `releaseVault` trigger.
- Salary auto-release assumes equal split across whitelist unless per-user salary
  amounts are added later.

## Repo scaffold (to fill in)

- `contracts/` — `Vault.sol`, deploy scripts, tests
- `web/` — single Next.js app: `src/app/api/**` = backend (API routes, Postgres
  access), `src/app/**` (outside `api/`) + `src/components/**` = frontend
  (React + TS + Tailwind + anime.js). Merged into one app to avoid
  CORS/dual-deploy overhead; ownership split enforced by folder, not by repo.
- `lib/` — Magic / Particle / ZeroDev client wiring, shared, imported by `web/`
