# Frontend Integration Guide

This guide shows how to integrate Magic Wallet authentication and database-driven features into your React frontend.

## Overview

The frontend uses:
- **Magic Wallet** for passwordless email/social authentication
- **TanStack React Query** for server state management
- **React Context** for managing authentication state locally
- **TypeScript** for type safety across API calls

## Step 1: Wrap Your App with Providers

Update `src/app/layout.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/AuthContext";

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Nav />
            <main>{children}</main>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

## Step 2: Add Magic Initialization to Your Page

Create a login page `src/app/login/page.tsx`:

```typescript
"use client";

import { MagicLoginComponent } from "@/components/MagicLoginComponent";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <MagicLoginComponent />
    </div>
  );
}
```

## Step 3: Protect Routes with Authentication

Create a protected page wrapper:

```typescript
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function withAuth<P extends {}>(Component: React.ComponentType<P>) {
  return function ProtectedComponent(props: P) {
    const { auth } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!auth?.socialId) {
        router.push("/login");
      }
    }, [auth, router]);

    if (!auth?.socialId) {
      return <div className="p-4">Loading...</div>;
    }

    return <Component {...props} />;
  };
}

// Usage:
// export default withAuth(DashboardPage);
```

## Step 4: Use Hooks to Fetch Data

In your components, use the custom hooks:

```typescript
"use client";

import { usePartitions, useTransactions } from "@/lib/useApi";
import { withAuth } from "./auth-wrapper";

function DashboardPage() {
  const { data: partitionsData, isLoading } = usePartitions();
  const { data: txData } = useTransactions();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Partitions</h1>
      {partitionsData?.partitions.map((partition) => (
        <div key={partition.id}>
          <h2>{partition.label}</h2>
          <p>Balance: {partition.balanceWei} wei</p>
          <div>
            <h3>Members</h3>
            {partition.members.map((member) => (
              <div key={member.socialId}>
                {member.socialId}: {member.limitWei} wei limit
              </div>
            ))}
          </div>
        </div>
      ))}

      <h1>Recent Transactions</h1>
      {txData?.transactions.map((tx) => (
        <div key={tx.id}>
          {tx.socialId}: {tx.amountWei} wei - {tx.type}
        </div>
      ))}
    </div>
  );
}

export default withAuth(DashboardPage);
```

## Step 5: Handle Fund Requests

```typescript
"use client";

import { useFundRequests, useCreateFundRequest } from "@/lib/useApi";
import { useState } from "react";

export function FundRequestPanel() {
  const { data } = useFundRequests("pending");
  const createFundRequest = useCreateFundRequest();
  const [partitionId, setPartitionId] = useState("");
  const [amountWei, setAmountWei] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFundRequest.mutateAsync({
        partitionId,
        amountWei,
        reason,
      });
      alert("Fund request created!");
      setPartitionId("");
      setAmountWei("");
      setReason("");
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  };

  return (
    <div>
      <h2>Pending Fund Requests</h2>
      {data?.fundRequests.map((req) => (
        <div key={req.id}>
          {req.socialId}: {req.amountWei} wei - {req.reason}
        </div>
      ))}

      <form onSubmit={handleSubmit} className="mt-4 p-4 border rounded">
        <h3>Create Fund Request</h3>
        <input
          type="text"
          placeholder="Partition ID"
          value={partitionId}
          onChange={(e) => setPartitionId(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Amount (wei)"
          value={amountWei}
          onChange={(e) => setAmountWei(e.target.value)}
          required
        />
        <textarea
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          type="submit"
          disabled={createFundRequest.isPending}
        >
          {createFundRequest.isPending ? "Creating..." : "Create Request"}
        </button>
      </form>
    </div>
  );
}
```

## Data Types Reference

All types are defined in `src/lib/types.ts`:

```typescript
interface User {
  socialId: string; // Non-renameable after first set
  address: `0x${string}`;
  role: Role;
}

interface Partition {
  id: string;
  onChainId: number;
  label: string;
  isBackup: boolean;
  balanceWei: string;
  dueDate: string | null;
  members: PartitionMember[];
}

interface FundRequest {
  id: string;
  partitionId: string;
  socialId: string;
  amountWei: string;
  reason: string;
  status: FundRequestStatus;
  requestedAt: string;
}

interface Tx {
  id: string;
  txHash: `0x${string}`;
  partitionId: string;
  partitionLabel: string;
  socialId: string;
  amountWei: string;
  type: TxType;
  status: TxStatus;
  description: string;
  timestamp: string;
}
```

## Magic Wallet SDK Methods

### Login with Email

```typescript
const magic = new Magic(MAGIC_KEY);

// Send magic link
await magic.auth.loginWithMagicLink({ email: "user@example.com" });

// Get token after user clicks link
const token = await magic.user.getIdToken();
```

### Check Auth Status

```typescript
const isLoggedIn = await magic.user.isLoggedIn();
const user = await magic.user.getMetadata();
```

### Logout

```typescript
await magic.user.logout();
```

### Add Social Login (Optional)

In the Magic Dashboard:
1. Go to **Authentication** → **Social Logins**
2. Enable Google, Discord, GitHub, etc.
3. Update MagicLoginComponent to add social buttons:

```typescript
// After Magic initialization
const response = await magic.auth.loginWithSocial({
  provider: "google", // or "discord", "github"
});
const token = await magic.user.getIdToken();
await login(token);
```

## Error Handling

```typescript
try {
  await loginFlow();
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes("Unauthorized")) {
      // Token expired, need re-login
      logout();
      router.push("/login");
    } else if (error.message.includes("non-renameable")) {
      // User already has a social ID linked
      alert("Your social ID is already set and cannot be changed");
    }
  }
}
```

## Common Patterns

### Refresh Data After Mutation

```typescript
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: async (data) => { /* ... */ },
  onSuccess: () => {
    // Refetch all partitions
    queryClient.invalidateQueries({ queryKey: ["partitions"] });
  },
});
```

### Combine Multiple Data Queries

```typescript
const partitions = usePartitions();
const transactions = useTransactions();
const fundRequests = useFundRequests();

const isLoading = partitions.isLoading || 
                  transactions.isLoading || 
                  fundRequests.isLoading;

if (isLoading) return <div>Loading all data...</div>;
```

### Persist Auth Across Page Reloads

The AuthContext automatically stores the token in localStorage and persists it. On app load, check:

```typescript
useEffect(() => {
  const token = localStorage.getItem("auth_token");
  if (token && !auth) {
    // Optionally verify token is still valid
    login(token);
  }
}, []);
```

## Testing with cURL

### Get Partitions

```bash
MAGIC_TOKEN="<your_token_from_magic>"

curl http://localhost:3000/api/partitions \
  -H "Authorization: Bearer $MAGIC_TOKEN"
```

### Create Fund Request

```bash
curl -X POST http://localhost:3000/api/fund-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MAGIC_TOKEN" \
  -d '{
    "partitionId": "1",
    "amountWei": "1000000000000000000",
    "reason": "Q2 budget increase"
  }'
```

## Next Steps

1. **Update Nav component** to show user's social ID when logged in
2. **Add logout button** that calls `useAuth().logout()`
3. **Build dashboard** using the Partition and Transaction data
4. **Add real on-chain reads** for balance data
5. **Integrate invoice uploads** with Pinata IPFS
6. **Build payment flow** with ERC-4337 signing

---

For more examples, check the components in `/src/components/` and the mock implementations in `/src/lib/mock/`.
