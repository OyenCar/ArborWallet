# ArborWallet Implementation Checklist

Complete setup guide with step-by-step instructions to connect your frontend to the PostgreSQL database and Magic Wallet authentication.

---

## Phase 1: Dependencies & Environment (15 min)

- [ ] Install dependencies
  ```bash
  cd web
  npm install
  ```

- [ ] Copy environment template
  ```bash
  cp .env.local.example .env.local
  ```

- [ ] Fill in `.env.local`:
  - `DATABASE_URL`: Your PostgreSQL connection string
  - `MAGIC_SECRET_KEY`: From Magic Dashboard (https://dashboard.magic.link)
  - `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY`: Public key from Magic Dashboard

- [ ] Verify Magic Dashboard is set up:
  - [ ] Create account at https://dashboard.magic.link
  - [ ] Create a new app
  - [ ] Copy both `pk_live_*` (public) and `sk_live_*` (secret) keys
  - [ ] Save to `.env.local`

---

## Phase 2: Database Setup (10 min)

- [ ] Verify PostgreSQL is running
  ```bash
  psql "postgresql://postgres:password@localhost:5432/Arbor_Wallet"
  ```

- [ ] Initialize Prisma
  ```bash
  npx prisma db push
  ```

- [ ] Generate Prisma client
  ```bash
  npx prisma generate
  ```

- [ ] Test database connection (opens UI at http://localhost:5555)
  ```bash
  npx prisma studio
  ```

---

## Phase 3: Backend API Setup (10 min)

The following files have been created/updated:

**Authentication Routes:**
- [ ] `/src/app/api/auth/login/route.ts` - Magic token verification
- [ ] `/src/app/api/auth/link-social/route.ts` - Link social ID (non-renameable)

**Data Routes:**
- [ ] `/src/app/api/users/me/route.ts` - Get current user
- [ ] `/src/app/api/partitions/route.ts` - Get partitions (updated from mock)
- [ ] `/src/app/api/transactions/route.ts` - Get transactions (updated from mock)
- [ ] `/src/app/api/fund-requests/route.ts` - Get/create fund requests (updated from mock)

**Utilities:**
- [ ] `/src/lib/db.ts` - Prisma client
- [ ] `/src/lib/auth.ts` - Magic authentication logic

---

## Phase 4: Frontend State Management (10 min)

- [ ] Add `AuthProvider` to root layout
  - [ ] Update `/src/app/layout.tsx` to wrap with `<AuthProvider>`
  - [ ] Add `QueryClientProvider` from React Query

- [ ] Create login page
  ```bash
  # Copy MagicLoginComponent from examples
  # Create src/app/login/page.tsx
  ```

Files created:
- [ ] `/src/lib/AuthContext.tsx` - Auth state & hooks
- [ ] `/src/lib/useApi.ts` - React Query hooks for all endpoints
- [ ] `/src/components/MagicLoginComponent.tsx` - Example login form

---

## Phase 5: Frontend Integration (15 min)

- [ ] Update `Nav.tsx` to show user's social ID when logged in
  ```typescript
  import { useAuth } from "@/lib/AuthContext";
  
  export function Nav() {
    const { auth } = useAuth();
    return <nav>{auth?.socialId && <span>{auth.socialId}</span>}</nav>;
  }
  ```

- [ ] Add logout button
  ```typescript
  const { logout } = useAuth();
  <button onClick={logout}>Logout</button>
  ```

- [ ] Update dashboard pages to use data hooks
  - [ ] Replace mock data in `/src/app/page.tsx`
  - [ ] Use `usePartitions()` hook
  - [ ] Use `useTransactions()` hook
  - [ ] Wrap pages with `withAuth()` HOC

- [ ] Test fund request creation
  - [ ] Add form in `/src/app/payments/request/page.tsx`
  - [ ] Use `useCreateFundRequest()` hook

---

## Phase 6: Testing (10 min)

### Test Login Flow

```bash
# 1. Start dev server
npm run dev

# 2. Visit http://localhost:3000/login
# 3. Enter any test email
# 4. Check your email for Magic link
# 5. Click link in email
# 6. Fill in social ID (e.g., @alice) and wallet address
```

### Test API Routes

```bash
# Store token from login
TOKEN="your_magic_token_here"

# Test get current user
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# Test get partitions
curl http://localhost:3000/api/partitions \
  -H "Authorization: Bearer $TOKEN"

# Test get transactions
curl http://localhost:3000/api/transactions \
  -H "Authorization: Bearer $TOKEN"

# Test create fund request
curl -X POST http://localhost:3000/api/fund-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "partitionId": "1",
    "amountWei": "1000000000000000000",
    "reason": "Q2 budget"
  }'
```

### Verify Social ID is Non-Renameable

```bash
# After linking @alice, try to link again (should fail)
curl -X POST http://localhost:3000/api/auth/link-social \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "socialId": "@bob",
    "address": "0x..."
  }'
# Expected: 400 error "Social ID already linked (non-renameable)"
```

---

## Phase 7: Documentation Review

- [ ] Read [BACKEND_SETUP.md](./BACKEND_SETUP.md) - Full backend setup guide
- [ ] Read [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) - Frontend integration patterns
- [ ] Review [DESIGN.md](./DESIGN.md) - UI/UX philosophy

---

## Key Design Decisions

### Social ID (Non-Renameable)

- User links their `@socialId` on first login
- Once set, **cannot be changed** (database constraint)
- Maps to `address` table → Ethereum address
- Used throughout app for user identification

**In Schema:**
```sql
CREATE TABLE address (
  social_id VARCHAR(64) PRIMARY KEY,
  address VARCHAR(64) NOT NULL
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  magic_issuer TEXT UNIQUE NOT NULL,
  social_id VARCHAR(64) UNIQUE, -- Foreign key to address
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- After setting social_id, attempting to update it will fail
-- due to the foreign key constraint + NOT NULL requirement
```

### Authentication Flow

1. Frontend sends email to Magic Wallet
2. User clicks link in email
3. Frontend gets ID token from Magic
4. Frontend sends token to `/api/auth/login`
5. Backend verifies token with Magic servers
6. If first login, user is created in DB
7. If social ID not yet set, user must link it at `/api/auth/link-social`
8. All subsequent API calls include token in `Authorization: Bearer` header

### Database Relationships

```
address (1) ←→ (1) users
users (1) ←→ (many) partitions (members)
users (1) ←→ (many) transactions
users (1) ←→ (many) fund_requests
partitions (1) ←→ (many) transactions
partitions (1) ←→ (many) fund_requests
partitions (1) ←→ (many) invoices
```

---

## Troubleshooting

### "Unauthorized" on all API calls

- ✅ Check `Authorization: Bearer` header is present
- ✅ Verify token hasn't expired (get new one from Magic)
- ✅ Check `MAGIC_SECRET_KEY` in `.env.local`

### Database connection fails

```bash
# Test connection directly
psql "postgresql://postgres:password@localhost:5432/Arbor_Wallet"

# Check Prisma connection
npx prisma studio
```

### Prisma schema mismatch

```bash
# Regenerate and sync
npx prisma db push --force-reset  # WARNING: Clears data
npx prisma generate
```

### Magic token invalid

- Token expires after 1 hour
- User must get new token by logging in again
- Test: `await magic.user.isLoggedIn()`

### Social ID linking fails with "non-renameable"

- This is expected behavior
- User can only link once per account
- If need to change, create new Magic account

---

## Next Features to Implement

1. **Invoices with IPFS**
   - [ ] Upload to Pinata via `/api/invoices`
   - [ ] Store IPFS CID in database
   - [ ] Display in transaction history

2. **On-Chain Balance Reading**
   - [ ] Call Arbitrum RPC to get partition balance
   - [ ] Update `balanceWei` in partition responses

3. **Social Login Providers**
   - [ ] Add Google login button in Magic
   - [ ] Add Discord login button in Magic
   - [ ] Update MagicLoginComponent

4. **Fund Request Approval**
   - [ ] Add `/api/fund-requests/[id]/approve` endpoint
   - [ ] Only allow partition owner (role check)

5. **Real-Time Updates**
   - [ ] WebSocket for transaction updates
   - [ ] Server-sent events for fund request status

6. **ERC-4337 Integration**
   - [ ] Connect to ZeroDev for smart accounts
   - [ ] Gasless transactions with paymaster

---

## Files Reference

```
web/
├── .env.local.example          ← Copy and fill with your keys
├── schema.prisma               ← Database schema (Prisma ORM)
├── BACKEND_SETUP.md            ← Backend guide
├── FRONTEND_INTEGRATION.md     ← Frontend guide
├── package.json                ← Updated with new dependencies
├── src/
│   ├── lib/
│   │   ├── auth.ts             ← Magic token verification
│   │   ├── db.ts               ← Prisma client
│   │   ├── AuthContext.tsx     ← Auth state management
│   │   └── useApi.ts           ← React Query hooks
│   ├── app/
│   │   ├── layout.tsx          ← Update with providers
│   │   ├── login/
│   │   │   └── page.tsx        ← Create login page
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts        ← ✓ Created
│   │       │   └── link-social/route.ts  ← ✓ Created
│   │       ├── users/
│   │       │   └── me/route.ts           ← ✓ Created
│   │       ├── partitions/route.ts       ← ✓ Updated
│   │       ├── transactions/route.ts     ← ✓ Updated
│   │       └── fund-requests/route.ts    ← ✓ Updated
│   └── components/
│       └── MagicLoginComponent.tsx       ← ✓ Created
```

---

## Support

For issues:
1. Check error messages in browser console
2. Check server logs: `npm run dev`
3. Check database: `npx prisma studio`
4. Review [BACKEND_SETUP.md](./BACKEND_SETUP.md) troubleshooting section

Happy coding! 🚀
