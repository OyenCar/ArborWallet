@AGENTS.md

# ArborWallet — web

Single Next.js app: frontend UI + backend API routes together (merged on
purpose — avoids CORS/dual-origin/dual-deploy overhead for a hackathon). Full
architecture/spec: `../SPEC.md` at repo root — read that first, it's the source
of truth for schema, contract ABI shape, and flows.

## Folder ownership (internal split, not separate apps)

- `src/app/api/**` — backend: route handlers only. Owns DB access, Pinata,
  owner-key tx sending, on-chain event indexing, and Magic TEE Server Wallet interactions.
- `src/app/**` (everything outside `api/`) + `src/components/**` — frontend:
  pages, brutalist UI, QR gen/scan, settings, dashboards. Consumes `api/` routes as a
  black box (`fetch('/api/...')`) and `../lib/` format/firebase functions.
- Stick to these boundaries so two people can work in this one app without
  constant merge conflicts.

## Backend responsibilities (`src/app/api/**`)

This app does NOT hold session keys or user funds directly in its own state —
- Maps Firebase User (Email, Google) ↔ wallet address (Magic TEE-derived signer address).
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
- Interfaces with Magic TEE (`https://tee.express.magiclabs.com/v1/wallet`) using the user's Firebase JWT, `MAGIC_SECRET_KEY`, and `OIDC_PROVIDER_ID` to programmatically retrieve or create wallets.

## Frontend responsibilities (`src/app/**` pages, `src/components/**`)

React + TS + Tailwind + anime.js, brutalist design (see `../SPEC.md`).
- **Authentication**: Uses Firebase Authentication (`signInWithEmailAndPassword`, `signInWithPopup` for Google Sign-In) wrapped in `FirebaseProvider` and `UserContext`. GitHub and Telegram options have been completely removed.
- **Dynamic Balances**: Fetches real-time native ETH balances of the user's public address directly from Arbitrum Sepolia RPC (`https://sepolia-rollup.arbitrum.io/rpc`) using `getArbitrumSepoliaBalance` in `format.ts`.
- **Caste-Free Roles**: The CFO/Employee role selector has been removed. All users are assigned a unified `role: "employee"` to keep them equal.

## Stack

- Next.js (App Router) — both `api/` route handlers and pages in one app
- Firebase SDK — authentication (Google, Email/Password)
- PostgreSQL — schema in `../SPEC.md`
- viem + wagmi — reading/writing `Vault.sol`
- animejs — brutalist UI transitions
- Pinata SDK/API — invoice uploads

## Conventions

- Env vars (never commit): `DATABASE_URL`, `PINATA_JWT`, `ZERODEV_PROJECT_ID`,
  `PARTICLE_PROJECT_ID`, `OWNER_SUDO_PRIVATE_KEY` or equivalent owner-signer
  config, `VAULT_CONTRACT_ADDRESS`, `ARBITRUM_SEPOLIA_RPC_URL`, `MAGIC_SECRET_KEY`, `NEXT_PUBLIC_MAGIC_API_KEY`, `OIDC_PROVIDER_ID`.
  `NEXT_PUBLIC_*` prefix only for values safe to ship to the browser (e.g.
  public RPC URL, Firebase client credentials, Magic publishable API key) — never
  prefix secrets like `MAGIC_SECRET_KEY` or `OIDC_PROVIDER_ID` with `NEXT_PUBLIC_`.
- API routes under `src/app/api/*` (App Router route handlers), not `pages/api`.
- Any route that sends a tx must be idempotent-safe or check on-chain state
  first — don't rely on DB status alone to prevent double-spends.
- This is Next.js 16 — check `node_modules/next/dist/docs/` before assuming
  API/conventions match older Next.js knowledge (per AGENTS.md above).
