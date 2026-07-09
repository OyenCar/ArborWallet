# ArborWallet Backend Setup Guide

This guide explains how to connect your Next.js frontend to your PostgreSQL database, integrate Magic Wallet authentication, and set up API routes.

## Prerequisites

- PostgreSQL database running locally (or remote connection string)
- Magic Dashboard account (https://dashboard.magic.link)
- Node.js 18+ and npm/yarn/pnpm

## Step 1: Install Dependencies

Add the required packages to your Next.js project:

```bash
cd web
npm install @prisma/client @magic-sdk/admin uuid
npm install -D prisma
```

## Step 2: Set Up Environment Variables

Copy the template and fill in your actual values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with:

```env
# Database Connection (adjust for your local setup)
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/Arbor_Wallet"

# Magic Dashboard Keys (from https://dashboard.magic.link)
NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_YOUR_KEY
MAGIC_SECRET_KEY=sk_live_YOUR_KEY

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

## Step 3: Initialize Prisma

The Prisma schema is already created at `schema.prisma`. Now push it to your database:

```bash
npx prisma db push
```

This will:
- Create/verify all tables match your database schema
- Set up indexes and constraints
- **Important**: Your existing database tables will be matched with the schema

## Step 4: Verify Database Connection

Generate the Prisma client:

```bash
npx prisma generate
```

Test the connection:

```bash
npx prisma studio
```

This opens a web UI to browse your database.

## Step 5: Start the Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and verify the app loads without errors.

## Authentication Flow

### 1. User Login with Magic

Frontend calls Magic to get a token:

```typescript
// In your React component (frontend)
const magic = new Magic(process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY!);

const response = await magic.auth.loginWithMagicLink({
  email: userEmail,
});

const token = response.getIdToken(); // Get the token
```

### 2. Backend Login Endpoint

Frontend sends token to backend:

```typescript
// POST /api/auth/login
const res = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token }),
});

const { userId, magicIssuer, requiresSocialLink } = await res.json();
```

### 3. Link Social ID (Non-Renameable)

If `requiresSocialLink` is true, user must link their social ID:

```typescript
// POST /api/auth/link-social
const res = await fetch("/api/auth/link-social", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`, // Send the Magic token
  },
  body: JSON.stringify({
    socialId: "@username", // e.g., "@alice", "@bob"
    address: "0x1234...", // Ethereum address from wallet
  }),
});
```

Once set, the `socialId` **cannot be changed** — it's enforced by the database schema.

## API Endpoints

All endpoints (except `/api/auth/login`) require authentication:

```
Authorization: Bearer <magic_token>
```

### Authentication

- `POST /api/auth/login` — Login with Magic token
- `POST /api/auth/link-social` — Link social ID (non-renameable)
- `GET /api/users/me` — Get current user info

### Data Endpoints

- `GET /api/partitions` — Get all partitions + members
- `GET /api/transactions?partitionId=&type=&socialId=` — Get transactions
- `GET /api/fund-requests?status=pending` — Get fund requests
- `POST /api/fund-requests` — Create new fund request
  - Body: `{ partitionId: string, amountWei: string, reason?: string }`

## Database Schema

Your database is now mapped to Prisma with these key features:

### Social ID (Non-Renameable)

The `address` table maps `socialId` to Ethereum addresses:

```sql
-- Table: address
-- Columns: socialId (PK), address
```

Users can only link their `socialId` ONCE. Any attempt to change it after initial setup will fail.

### Users

- `id`: Unique user ID (BigInt)
- `magicIssuer`: Magic authentication issuer (unique)
- `socialId`: Linked social ID (nullable, becomes required after first link)
- `createdAt`: Account creation timestamp

### Partitions

Budget containers with:
- `id`: Database ID
- `onChainId`: Corresponding on-chain vault ID
- `label`: Human-readable name
- `isBackup`: Whether it's a backup partition
- `dueDate`: For payroll automation
- `members`: Employees with spending limits

### Transactions

- Indexed by partition, user, and timestamp
- Stores on-chain tx hash as bytea (32 bytes)
- Type: "withdraw", "deposit", "release", "qr_pay"

### Fund Requests

- Status: "pending", "approved", "rejected"
- Automatically indexed by status for fast lookups
- Links to partition, user, and amount

## Testing Endpoints with cURL

### 1. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token":"your_magic_token_here"}'
```

### 2. Link Social ID

```bash
curl -X POST http://localhost:3000/api/auth/link-social \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_magic_token" \
  -d '{"socialId":"@alice","address":"0x1234567890123456789012345678901234567890"}'
```

### 3. Get Partitions

```bash
curl http://localhost:3000/api/partitions \
  -H "Authorization: Bearer your_magic_token"
```

## Troubleshooting

### "Unauthorized" Error

- Verify Magic token is sent in `Authorization: Bearer <token>` header
- Check that the token hasn't expired
- Verify `MAGIC_SECRET_KEY` is correct in `.env.local`

### Database Connection Fails

```bash
# Test connection directly
psql "postgresql://postgres:password@localhost:5432/Arbor_Wallet"
```

### Prisma Schema Mismatch

If you modify the database manually, regenerate:

```bash
npx prisma db push
npx prisma generate
```

## Next Steps

1. **Add social login providers** to Magic (Google, Discord, etc.)
2. **Implement invoice storage** — Add IPFS/Pinata integration for CID storage
3. **Add on-chain balance reads** — Connect to Arbitrum RPC to get actual partition balances
4. **Create frontend auth context** — Wrap app with Magic and token management
5. **Add fee sponsorship** — Integrate ERC-4337 paymaster for sponsored transactions

## Frontend Integration Example

See `CLAUDE.md` in `/web` for implementation patterns with React hooks.

---

**Questions?** Check the existing API route files in `/src/app/api/` for more examples.
