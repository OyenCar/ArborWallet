# ArborWallet Backend Implementation Summary

## What's Been Created

I've set up a complete backend and frontend integration for ArborWallet with database, authentication, and API endpoints. Here's what's been implemented:

### 🗄️ Database Layer
- **Prisma ORM Schema** (`schema.prisma`) mapping to your existing PostgreSQL database
- **Social ID Mapping** - Non-renameable username → address linking in the `address` table
- All 7 tables properly configured with relationships and constraints

### 🔐 Authentication
- **Magic Wallet Integration** - Passwordless email login + social providers (Google, Discord, etc.)
- **Token Verification** - Server-side Magic token validation
- **Social ID Linking** - One-time, non-renameable linking at `/api/auth/link-social`
- **Protected Routes** - All data endpoints require valid Magic token

### 📡 API Endpoints Created/Updated

**Authentication:**
- `POST /api/auth/login` - Verify Magic token, create/return user
- `POST /api/auth/link-social` - Link social ID to user (non-renameable)
- `GET /api/users/me` - Get current authenticated user

**Data Endpoints:**
- `GET /api/partitions` - Get all partitions with members (from DB)
- `GET /api/transactions` - Query transactions with filters (from DB)
- `GET /api/fund-requests` - Get pending fund requests (from DB)
- `POST /api/fund-requests` - Create new fund request (from DB)

### 💾 Backend Utilities
- `src/lib/db.ts` - Prisma client singleton
- `src/lib/auth.ts` - Magic token verification & social ID linking
- Complete TypeScript types in `src/lib/types.ts`

### 🎨 Frontend State Management
- `src/lib/AuthContext.tsx` - React Context for auth state
- `src/lib/useApi.ts` - React Query hooks for all API endpoints
- `src/components/MagicLoginComponent.tsx` - Full login form component

### 📚 Documentation
- **BACKEND_SETUP.md** - Complete backend setup guide with cURL examples
- **FRONTEND_INTEGRATION.md** - Frontend integration patterns and examples
- **SETUP_CHECKLIST.md** - Step-by-step checklist to get running
- **setup.sh** - Automated setup script

---

## Quick Start (5 minutes)

### 1. Install Dependencies
```bash
cd web
npm install
```

### 2. Configure Environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your database and Magic credentials
```

### 3. Set Up Database
```bash
npx prisma db push      # Apply schema to your DB
npx prisma generate     # Generate Prisma client
```

### 4. Start Development Server
```bash
npm run dev
# Visit http://localhost:3000
```

### 5. Test Login Flow
- Visit `/login`
- Enter any email
- Check email for Magic link
- Click link
- Fill in social ID (e.g., @alice) and wallet address
- You're authenticated!

---

## Key Features Implemented

### ✅ Non-Renameable Social IDs
Social IDs are permanently linked to users. Once set, they cannot be changed:

```typescript
// First link succeeds
POST /api/auth/link-social
{ "socialId": "@alice", "address": "0x..." }
// ✅ Success

// Attempt to change fails
POST /api/auth/link-social
{ "socialId": "@bob", "address": "0x..." }
// ❌ Error: "Social ID already linked (non-renameable)"
```

### ✅ Database-Driven Data
All endpoints now query the real database instead of using mocks:

```typescript
// Before (mock)
export async function GET() {
  return NextResponse.json({ partitions: mockPartitions });
}

// After (database)
const partitions = await db.partition.findMany({
  include: { members: true }
});
```

### ✅ Magic Wallet Authentication
Frontend to backend flow:

```
User Email
    ↓
Magic Sends Link
    ↓
User Clicks Link
    ↓
Frontend Gets Token
    ↓
Frontend POST /api/auth/login
    ↓
Backend Verifies Token with Magic
    ↓
User Created in Database (if new)
    ↓
User Linked Social ID (if not yet set)
    ↓
All Subsequent Requests Use Token
```

### ✅ React Query Integration
Hooks for all API calls with caching and refetching:

```typescript
const { data: partitions } = usePartitions();
const { data: txs } = useTransactions({ type: "withdraw" });
const createFundRequest = useCreateFundRequest();

await createFundRequest.mutateAsync({
  partitionId: "1",
  amountWei: "1000000000000000000",
});
```

---

## File Structure

```
web/
├── .env.local.example              ← Copy and customize
├── schema.prisma                   ← Database schema
├── setup.sh                        ← Automated setup script
├── BACKEND_SETUP.md                ← Backend guide
├── FRONTEND_INTEGRATION.md         ← Frontend guide
├── SETUP_CHECKLIST.md              ← Checklist
│
├── src/
│   ├── lib/
│   │   ├── db.ts                   ← Prisma client
│   │   ├── auth.ts                 ← Magic verification
│   │   ├── types.ts                ← TypeScript types
│   │   ├── AuthContext.tsx         ← Auth state (NEW)
│   │   └── useApi.ts               ← React Query hooks (NEW)
│   │
│   ├── app/
│   │   ├── layout.tsx              ← Needs provider wrappers
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts              ✅ NEW
│   │       │   └── link-social/route.ts       ✅ NEW
│   │       ├── users/me/route.ts              ✅ NEW
│   │       ├── partitions/route.ts            ✅ UPDATED
│   │       ├── transactions/route.ts          ✅ UPDATED
│   │       └── fund-requests/route.ts         ✅ UPDATED
│   │
│   └── components/
│       └── MagicLoginComponent.tsx ✅ NEW
│
└── package.json                    ✅ UPDATED (added deps)
```

---

## What You Need to Do

### Immediate Tasks

1. **Install dependencies** - `npm install`
2. **Get Magic credentials** - https://dashboard.magic.link
3. **Fill .env.local** - Copy from `.env.local.example`
4. **Push schema to DB** - `npx prisma db push`
5. **Start dev server** - `npm run dev`

### Frontend Integration

1. **Wrap app with providers** - Update `src/app/layout.tsx`:
   ```typescript
   import { QueryClientProvider } from "@tanstack/react-query";
   import { AuthProvider } from "@/lib/AuthContext";
   
   export default function RootLayout({ children }) {
     return (
       <QueryClientProvider client={queryClient}>
         <AuthProvider>{children}</AuthProvider>
       </QueryClientProvider>
     );
   }
   ```

2. **Create login page** - Create `src/app/login/page.tsx`:
   ```typescript
   import { MagicLoginComponent } from "@/components/MagicLoginComponent";
   export default function LoginPage() {
     return <MagicLoginComponent />;
   }
   ```

3. **Update dashboard** - Replace mock data with hooks:
   ```typescript
   import { usePartitions } from "@/lib/useApi";
   
   export function Dashboard() {
     const { data } = usePartitions();
     return <div>{data?.partitions.map(...)}</div>;
   }
   ```

### Testing

```bash
# 1. Start server
npm run dev

# 2. Visit http://localhost:3000/login
# 3. Enter test email
# 4. Click Magic link from email
# 5. Fill in social ID and address

# 6. Test API with curl
MAGIC_TOKEN="your_token_here"

curl http://localhost:3000/api/partitions \
  -H "Authorization: Bearer $MAGIC_TOKEN"
```

---

## Database Schema Highlights

### address Table (Social ID Mapping)
```sql
CREATE TABLE address (
  social_id VARCHAR(64) PRIMARY KEY,      -- @alice, @bob, etc.
  address VARCHAR(64) NOT NULL            -- 0x... Ethereum address
);
```

**Key Point:** `social_id` is the primary key, making it immutable.

### users Table
```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  magic_issuer TEXT UNIQUE NOT NULL,      -- Magic user ID
  social_id VARCHAR(64) UNIQUE,           -- Links to address table
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Point:** `social_id` is unique and can only be set once.

### Other Tables
- **partitions** - Budget containers with members and spending limits
- **partition_members** - Many-to-many: which users belong to which partitions
- **transactions** - Withdraw, deposit, release, qr_pay transactions
- **fund_requests** - Pending budget increase requests
- **invoices** - IPFS-backed invoice data

---

## API Usage Examples

### Login
```typescript
const token = await magic.user.getIdToken();
const res = await fetch("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ token }),
});
const { userId, requiresSocialLink } = await res.json();
```

### Link Social ID
```typescript
const res = await fetch("/api/auth/link-social", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    socialId: "@alice",
    address: "0x1234567890123456789012345678901234567890",
  }),
});
```

### Get Partitions
```typescript
const res = await fetch("/api/partitions", {
  headers: { Authorization: `Bearer ${token}` },
});
const { partitions, vaultTotalWei } = await res.json();
```

### Create Fund Request
```typescript
const res = await fetch("/api/fund-requests", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    partitionId: "1",
    amountWei: "1000000000000000000",
    reason: "Q2 budget increase",
  }),
});
```

---

## Next Steps (Advanced)

After basic setup, consider:

1. **Invoices** - Implement IPFS/Pinata integration for invoice storage
2. **On-Chain Balance** - Read from Arbitrum RPC for real partition balances
3. **Fund Request Approval** - Admin endpoint to approve/reject requests
4. **ERC-4337** - Integrate ZeroDev for gasless transactions
5. **WebSockets** - Real-time updates for transactions and requests
6. **Rate Limiting** - Add middleware to prevent abuse

---

## Troubleshooting

**Q: "Unauthorized" on all API calls**
A: Check the Authorization header has `Bearer <token>` and token hasn't expired.

**Q: Database connection fails**
A: Run `psql` directly to test: `psql "postgresql://postgres:password@localhost:5432/Arbor_Wallet"`

**Q: Social ID linking fails**
A: If you get "non-renameable" error, that's expected - the user already has a social ID linked. Create a new Magic account to test.

**Q: Prisma schema mismatch**
A: Regenerate with `npx prisma db push` and `npx prisma generate`

---

## Support Documents

- **[BACKEND_SETUP.md](./BACKEND_SETUP.md)** - Complete backend walkthrough
- **[FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)** - React component examples
- **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** - Phase-by-phase checklist

---

**You're all set!** 🚀

Follow SETUP_CHECKLIST.md for step-by-step instructions, or jump straight to `npm install && npm run dev` to get started.

Questions? Check the docs or review the example components in `/src/components/` and `/src/app/api/`.
