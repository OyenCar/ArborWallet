@AGENTS.md

# ArborWallet — web

Single Next.js app: frontend UI + backend API routes together (merged on
purpose — avoids CORS/dual-origin/dual-deploy overhead for a hackathon). Full
architecture/spec: `../SPEC.md` at repo root — read that first, it's the source
of truth for schema, contract ABI shape, and flows.

## Folder ownership (internal split, not separate apps)

- `src/app/api/**` — backend: route handlers only. Owns DB access, Pinata,
  owner-key tx sending, on-chain event indexing.
- `src/app/**` (everything outside `api/`) + `src/components/**` — frontend:
  pages, brutalist UI, QR gen/scan, dashboards. Consumes `api/` routes as a
  black box (`fetch('/api/...')`) and `../lib/` wallet functions as black
  boxes — doesn't need to know ZeroDev/Particle internals.
- Stick to these boundaries so two people can work in this one app without
  constant merge conflicts.

## Backend responsibilities (`src/app/api/**`)

This app does NOT hold session keys or user funds directly in its own state —
- Maps Social ID (username) ↔ wallet address (Magic-derived signer address).
- Indexes on-chain events (`Deposited`, `Withdrawn`, `VaultReleased`, etc.) from
  `Vault.sol` into Postgres for reporting.
- Handles Fund Request workflow (pending → owner approval → sends
  `requestApproved()` tx via owner's ZeroDev sudo key — this is the one place
  the app signs/sends a tx server-side, using the *owner's* key, never an
  employee's session key).
- Pins invoices to IPFS via Pinata, returns CID + `keccak256` hash for the
  frontend to pass into `withdraw()`.
- Validates + relays QR-payment intents (builds `withdraw()` UserOp via the
  scanning employee's ZeroDev session key, sponsored submit).

## Frontend responsibilities (`src/app/**` pages, `src/components/**`)

React + TS + Tailwind + anime.js, brutalist design (see `../SPEC.md`). Wagmi
for wallet-state hooks, viem for reads, calls into `../lib/` for anything
ZeroDev/Particle/Magic-specific rather than importing those SDKs directly in
components.

## Stack

- Next.js (App Router) — both `api/` route handlers and pages in one app
- PostgreSQL — schema in `../SPEC.md` (`users`, `partitions`,
  `partition_members`, `fund_requests`, `invoices`, `transactions`)
- viem + wagmi — reading/writing `Vault.sol` (ABI comes from `contracts/`,
  coordinate with whoever owns that folder for the compiled ABI path)
- animejs — brutalist UI transitions
- Pinata SDK/API — invoice uploads

## Conventions

- Env vars (never commit): `DATABASE_URL`, `PINATA_JWT`, `ZERODEV_PROJECT_ID`,
  `PARTICLE_PROJECT_ID`, `OWNER_SUDO_PRIVATE_KEY` or equivalent owner-signer
  config, `VAULT_CONTRACT_ADDRESS`, `ARBITRUM_SEPOLIA_RPC_URL`.
  `NEXT_PUBLIC_*` prefix only for values safe to ship to the browser (e.g.
  public RPC URL, ZeroDev/Particle project IDs used client-side) — never
  prefix secrets like `PINATA_JWT` or `OWNER_SUDO_PRIVATE_KEY` with
  `NEXT_PUBLIC_`.
- API routes under `src/app/api/*` (App Router route handlers), not `pages/api`.
- Any route that sends a tx must be idempotent-safe or check on-chain state
  first (e.g. `processedInvoices` mapping) — don't rely on DB status alone to
  prevent double-spends.
- This is Next.js 16 — check `node_modules/next/dist/docs/` before assuming
  API/conventions match older Next.js knowledge (per AGENTS.md above).
