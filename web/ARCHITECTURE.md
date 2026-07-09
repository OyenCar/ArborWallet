# Architecture & Flow Diagrams

## Authentication Flow

```
┌─────────────┐
│   User      │
│  @ Browser  │
└──────┬──────┘
       │
       │ 1. Enters email
       ▼
┌─────────────────────────────┐
│  Magic Login Component      │
│  (React)                    │
│  - Shows email form         │
│  - Calls magic.auth.        │
│    loginWithMagicLink()     │
└──────┬──────────────────────┘
       │
       │ 2. Sends link to email
       ▼
┌─────────────────────────────┐
│  Magic Dashboard            │
│  (magic.link)               │
│  - Generates magic link     │
│  - Emails user              │
└──────┬──────────────────────┘
       │
       │ 3. User clicks link in email
       ▼
┌─────────────────────────────┐
│  Magic Redirect             │
│  - Confirms email           │
│  - Sends token to browser   │
└──────┬──────────────────────┘
       │
       │ 4. Frontend gets token
       │    token = await magic.user.getIdToken()
       ▼
┌─────────────────────────────┐
│  POST /api/auth/login       │
│  (Next.js API)              │
│  Body: { token }            │
└──────┬──────────────────────┘
       │
       │ 5. Backend verifies token with Magic
       │    magic.token.validate(token)
       ▼
┌─────────────────────────────┐
│  Magic Servers              │
│  - Validate token           │
│  - Return issuer (user ID)  │
└──────┬──────────────────────┘
       │
       │ 6. Backend queries database
       │    users.findUnique({ magicIssuer })
       ▼
┌─────────────────────────────┐
│  PostgreSQL Database        │
│  - Find or create user      │
│  - Check if social_id set   │
└──────┬──────────────────────┘
       │
       │ 7. Return requiresSocialLink
       ▼
┌─────────────────────────────┐
│  Frontend Check             │
│  if (requiresSocialLink)    │
│    → Show social link form  │
└──────┬──────────────────────┘
       │
       │ 8. User fills in:
       │    - @socialId (e.g., @alice)
       │    - Wallet address (0x...)
       ▼
┌─────────────────────────────────┐
│  POST /api/auth/link-social     │
│  Header: Authorization: Bearer  │
│          <magic_token>          │
│  Body: { socialId, address }    │
└──────┬──────────────────────────┘
       │
       │ 9. Backend:
       │    - Verify token
       │    - Create/update address record
       │    - Update users.social_id
       │    - Check for duplicates (non-renameable)
       ▼
┌─────────────────────────────┐
│  PostgreSQL Database        │
│  address table:             │
│  ├─ social_id: @alice       │
│  └─ address: 0x...          │
│                             │
│  users table:               │
│  ├─ id: 1                   │
│  ├─ magic_issuer: iss_...   │
│  ├─ social_id: @alice       │
│  └─ created_at: now()       │
└──────┬──────────────────────┘
       │
       │ 10. Return success
       │     + auth context updated
       ▼
┌─────────────────────────────┐
│  User Authenticated ✅       │
│  Ready to use all endpoints │
│  All future requests:       │
│  Authorization: Bearer      │
│                  <token>    │
└─────────────────────────────┘
```

---

## API Request Authentication

```
Frontend Component
  │
  │ 1. useAuth() → get token
  ├─────────────────────────┐
  │                         │
  ▼                         ▼
GET /api/partitions    POST /api/fund-requests
  │                         │
  │ 2. Add header           │ 2. Add header
  │    Authorization:       │    Authorization:
  │    Bearer <token>       │    Bearer <token>
  │                         │
  ▼                         ▼
Next.js API Route     Next.js API Route
  │                         │
  │ 3. Extract token       │ 3. Extract token
  │    from Authorization  │    from Authorization
  │    header              │    header
  │                         │
  ▼                         ▼
verifyMagicToken()    verifyMagicToken()
  │                         │
  │ 4. Validate with       │ 4. Validate with
  │    Magic servers       │    Magic servers
  │                         │
  ▼                         ▼
PostgreSQL Query      PostgreSQL Query
  │                         │
  │ 5. Get partitions      │ 5. Create fund request
  │    with members        │    + return created
  │                         │
  ▼                         ▼
Return JSON           Return JSON
  │                         │
  └─────────────┬───────────┘
                │
                ▼
         Frontend Hook Updates
         (usePartitions, etc.)
                │
                ▼
         Component Re-renders
         with fresh data
```

---

## Database Relationships

```
┌──────────────────────────────────────────────────────────────┐
│                    address (Social ID)                       │
├──────────────┬────────────────────────────────────────────────┤
│ social_id ◄─┤ PRIMARY KEY, VARCHAR(64)                       │
│ address      │ VARCHAR(64)                                    │
└──────────┬───┴────────────────────────────────────────────────┘
           │
           │ FOREIGN KEY
           │ users.social_id
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                       users                                  │
├──────────────┬────────────────────────────────────────────────┤
│ id           │ BIGSERIAL PRIMARY KEY                          │
│ magic_issuer │ TEXT UNIQUE                                   │
│ social_id    │ VARCHAR(64) UNIQUE (Nullable initially)       │
│ created_at   │ TIMESTAMPTZ                                   │
└──────┬────┬──┴──────┬──────────────────────────────────────────┘
       │    │         │
   ┌───┘    │         └────┐
   │        │              │
   │        ▼              ▼
   │   partition_members  transactions
   │   ├─ partition_id    ├─ id
   │   ├─ user_id ◄───────┤─ user_id
   │   ├─ limit_wei       ├─ partition_id
   │   └─ spent_wei       ├─ amount_wei
   │                      ├─ type
   │                      └─ timestamp
   │
   ▼
┌──────────────────────────────────────────────────────────────┐
│                    partitions                                │
├──────────────┬────────────────────────────────────────────────┤
│ id           │ BIGSERIAL PRIMARY KEY                          │
│ on_chain_id  │ BIGINT UNIQUE                                 │
│ corp_id      │ UUID                                          │
│ label        │ TEXT                                          │
│ is_backup    │ BOOLEAN                                       │
│ due_date     │ TIMESTAMPTZ (Nullable)                        │
│ created_at   │ TIMESTAMPTZ                                   │
└──────┬──────┬┴──────────────────────────────────────────────┤
       │      │                                                │
   ┌───┘      └────┐                                           │
   │              │                                            │
   ▼              ▼                                            │
fund_requests  invoices                                       │
├─ id          ├─ id                                          │
├─ partition   ├─ cid (IPFS hash)                            │
├─ user_id ◄───┤─ hash (32-byte check)                      │
├─ amount_wei  ├─ partition_id                              │
├─ reason      ├─ user_id                                   │
├─ status      ├─ amount_wei                                │
└─ requested_at├─ tx_hash (Nullable)                        │
               └─ created_at                                │
```

---

## Data Flow: Creating a Fund Request

```
Step 1: User Interface
┌──────────────────────┐
│ FundRequestPanel     │
│ - Amount input       │
│ - Reason textarea    │
│ - Submit button      │
└──────────┬───────────┘
           │
           │ handleSubmit()
           ▼
Step 2: React Mutation Hook
┌──────────────────────────────────┐
│ useCreateFundRequest()           │
│ - Gets auth token from context   │
│ - Prepares API call              │
└──────────┬──────────────────────┘
           │
           │ mutateAsync({ partitionId, amountWei, reason })
           ▼
Step 3: API Request
┌──────────────────────────────────────────────────────┐
│ POST /api/fund-requests                              │
│ Headers:                                              │
│   Authorization: Bearer <magic_token>                 │
│   Content-Type: application/json                      │
│ Body:                                                 │
│   {                                                   │
│     "partitionId": "1",                              │
│     "amountWei": "1000000000000000000",             │
│     "reason": "Q2 budget"                            │
│   }                                                   │
└──────────┬──────────────────────────────────────────┘
           │
           │ Next.js API Route Handler
           ▼
Step 4: Verify Auth
┌──────────────────────────────────────┐
│ requireAuth(request)                 │
│ - Extract token from header          │
│ - Call verifyMagicToken()            │
│ - Return auth context or 401         │
└──────────┬───────────────────────────┘
           │
           │ If auth fails → return 401
           │ If auth passes → continue
           ▼
Step 5: Validate Request
┌──────────────────────────────────────┐
│ Validate Input                       │
│ - partitionId required?              │
│ - amountWei required?                │
│ - amount > 0?                        │
└──────────┬───────────────────────────┘
           │
           │ If invalid → return 400
           │ If valid → continue
           ▼
Step 6: Database Insert
┌──────────────────────────────────────────────────┐
│ db.fundRequest.create({                          │
│   id: uuid(),                                    │
│   partitionId: BigInt(partitionId),             │
│   userId: auth.userId,                           │
│   amountWei: BigInt(amountWei),                 │
│   reason: reason || "",                          │
│   status: "pending",                             │
│   // timestamps auto-set by DB                  │
│ })                                               │
└──────────┬──────────────────────────────────────┘
           │
           │ INSERT INTO fund_requests (...)
           ▼
Step 7: Database Response
┌──────────────────────────────┐
│ PostgreSQL                   │
│ - Insert row                 │
│ - Set defaults (timestamps)  │
│ - Return inserted record     │
└──────────┬──────────────────┘
           │
           │ fundRequest object
           ▼
Step 8: Format Response
┌──────────────────────────────────┐
│ Convert to JSON-serializable:    │
│ - id: UUID                       │
│ - partitionId: string (BigInt)  │
│ - socialId: from relationship    │
│ - amountWei: string (Decimal)   │
│ - reason: string                 │
│ - status: "pending"              │
│ - requestedAt: ISO string        │
└──────────┬──────────────────────┘
           │
           │ return NextResponse.json(formatted, { status: 201 })
           ▼
Step 9: Client Receives Response
┌──────────────────────────────────┐
│ useCreateFundRequest mutation    │
│ - onSuccess callback fires       │
│ - Query cache invalidated        │
│ - useFundRequests() re-fetches   │
└──────────┬──────────────────────┘
           │
           │ Component updates with new data
           ▼
Step 10: UI Updates
┌────────────────────────────────┐
│ FundRequestList                │
│ ├─ ✓ Your request submitted    │
│ ├─ ...                         │
│ └─ New request appears in list │
└────────────────────────────────┘
```

---

## Social ID Non-Renameable Enforcement

```
First Login:
┌────────────────────────────┐
│ User clicks email link     │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ POST /api/auth/login       │
│ ├─ Verify token            │
│ ├─ Find user or create     │
│ └─ Return requiresSocialLink
└────────┬───────────────────┘
         │
         │ User has no social_id yet
         ▼
┌────────────────────────────┐
│ showSocialLinkForm()       │
│ ├─ Input: @username        │
│ ├─ Input: wallet address   │
│ └─ Submit button           │
└────────┬───────────────────┘
         │
         │ handleSocialLink()
         ▼
┌───────────────────────────────────────────┐
│ POST /api/auth/link-social                │
│ ├─ Verify token                           │
│ ├─ Check user.social_id IS NULL           │
│ ├─ Create address record (if new)         │
│ ├─ UPDATE users SET social_id = @alice    │
│ └─ Return success                         │
└───────┬─────────────────────────────────┘
        │
        │ SQL:
        │ UPDATE users
        │ SET social_id = '@alice'
        │ WHERE id = 123
        │   AND social_id IS NULL
        │
        ▼
┌─────────────────────────────┐
│ Database Constraint:        │
│ UNIQUE(social_id)           │
│                             │
│ This ensures:               │
│ - Only one user per social  │
│ - Can't update once set     │
└─────────────────────────────┘

Later Attempt to Change:
┌────────────────────────────┐
│ POST /api/auth/link-social │
│ { socialId: "@bob", ... }  │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Backend Checks:            │
│ user.social_id             │
│ IS NOT NULL                │
│                            │
│ Return 400:                │
│ "Social ID already linked  │
│  (non-renameable)"         │
└────────────────────────────┘
```

---

## Deployment Architecture (Future)

```
┌──────────────────────────────────────────────────────────┐
│                    Production Setup                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐      ┌──────────────┐                 │
│  │   Vercel    │      │  Magic Link   │                │
│  │  (Frontend  │◄────►│  (Auth SaaS)  │                │
│  │  Next.js)   │      │               │                │
│  └─────────────┘      └──────────────┘                 │
│        │                                                 │
│        │ API calls                                       │
│        │                                                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  /api/auth/login                                    │ │
│  │  /api/auth/link-social                             │ │
│  │  /api/partitions                                   │ │
│  │  /api/transactions                                 │ │
│  │  /api/fund-requests                                │ │
│  └─────────────┬───────────────────────────────────────┘ │
│                │                                          │
│                ▼                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         PostgreSQL Database                      │   │
│  │  (AWS RDS / Supabase / Railway)                 │   │
│  │  ├─ address (social_id mapping)                 │   │
│  │  ├─ users (magic_issuer, social_id)            │   │
│  │  ├─ partitions                                 │   │
│  │  ├─ transactions                               │   │
│  │  ├─ fund_requests                              │   │
│  │  ├─ invoices                                   │   │
│  │  └─ partition_members                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │    Optional: Pinata IPFS                        │   │
│  │    (Invoice/document storage)                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │    Optional: ZeroDev / Arbitrum RPC             │   │
│  │    (On-chain transactions & balance)            │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Key Points

✅ **Authentication is stateless** - Each request validates token with Magic
✅ **Social ID is immutable** - Database enforces with UNIQUE constraint  
✅ **Data is always fresh** - React Query handles caching and refetching
✅ **Type-safe** - Full TypeScript throughout stack
✅ **Scalable** - Indexed database queries for fast lookups
✅ **Secure** - Passwords never stored, Magic handles auth

