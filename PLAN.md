Phase 0 — Setup (half day, everyone)
web/: install missing deps (@zerodev/sdk, @zerodev/ecdsa-validator, @zerodev/permissions, magic-sdk, @particle-network/universal-account-sdk, qrcode + scanner lib, pg/drizzle)
lib/types.ts — write first, freeze early: Partition, User, FundRequest, Invoice, Transaction, PaymentIntent, wallet-fn signatures (getSessionAccount(), sendWithdraw(), getBalances())
ZeroDev dashboard: project + Arbitrum Sepolia gas policy. Magic + Particle + Pinata keys into .env
Phase 1 — Frontend (Person C leads; ~days 1–3)
All 6 screens from web/DESIGN.md, wired to mocks:

web/src/lib/mock/ — fixtures matching lib/types.ts (partitions, transactions, pending requests) + fake wallet module (same signatures as real lib/, resolves after 800ms delay, flips mock state)
Build order = demo priority: Dashboard → Budget Detail → Withdraw flow → QR 4a/4b → Activity → Settings
Design system first: tokens (colors/type/shadows from DESIGN.md) as Tailwind config + base components (Button, Card, StatusChip, Table, ViewInfrastructure panel shell)
Fiat⇄ETH toggle working against mock price
Gate: full click-through demo on mocks — every flow walkable without chain. This alone is demo-able if later phases slip.
Phase 2 — Smart contract (Person A; ~days 2–4, overlaps Phase 1)
contracts/ — Foundry init, Vault.sol per SPEC (partitions, limits, withdraw + invoice hash replay guard, releaseVault, events)
Tests: whitelist enforcement, limit math, backup partition, double-invoice reject, release-once
Deploy Arbitrum Sepolia → address + ABI exported to lib/vault/abi.ts (typed, viem Abi const)
Gelato Web3 Function registered against deployed address
Gate: cast calls prove withdraw/limit/release on testnet
Phase 3 — Wallet layer + backend (Person B wallet, Person A backend; ~days 4–6)
Wallet (lib/):

Magic login → viem account
ZeroDev: owner Kernel (sudo) + session-key issuance with CallPolicy → withdraw() only, expiry
Particle Universal Account deposit path
Implement real module with exact mock signatures — frontend swap = one import change
Backend (web/src/app/api/):

Postgres schema (SPEC) + migrations
Routes: users, partitions, fund-requests (+approve→requestApproved() via sudo key), invoices (Pinata pin→CID→hash), pay/execute (intent validate: sig/expiry/nonce/limit), price (cached CoinGecko)
Event indexer: viem watchContractEvent → transactions table
Phase 4 — Integration + demo (everyone; ~days 6–7)
Swap mocks → real lib/ + /api, screen by screen (Dashboard first)
E2E on Sepolia: deposit → partition → whitelist → session key → withdraw w/ invoice → QR both flows → auto-release
ViewInfrastructure panels fed real data (UserOp hash, scope, sponsorship) — judge demo moment
Pitch: known trade-offs slide (request-to-claim QR interception risk, single-corp assumption)
Dependency rule: frontend never blocks — mocks stand in for anything unfinished. Only hard sequence: contract ABI (end Phase 2) before wallet layer finalizes calldata, backend indexer needs deployed address.