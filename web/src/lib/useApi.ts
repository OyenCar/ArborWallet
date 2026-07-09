import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Partition, FundRequest, Tx } from "@/lib/types";

/**
 * Helper to add auth header to requests
 */
function withAuth(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

/**
 * Hook: Get current user info
 */
export function useCurrentUser() {
  const { auth } = useAuth();

  return useQuery({
    queryKey: ["user", auth?.magicIssuer],
    queryFn: async () => {
      if (!auth?.token) throw new Error("Not authenticated");

      const res = await fetch("/api/users/me", withAuth(auth.token));
      if (!res.ok) throw new Error("Failed to get user");
      return res.json();
    },
    enabled: !!auth?.token,
  });
}

/**
 * Hook: Get all partitions
 */
export function usePartitions() {
  const { auth } = useAuth();

  return useQuery({
    queryKey: ["partitions", auth?.magicIssuer],
    queryFn: async () => {
      if (!auth?.token) throw new Error("Not authenticated");

      const res = await fetch("/api/partitions", withAuth(auth.token));
      if (!res.ok) throw new Error("Failed to get partitions");
      return res.json() as Promise<{
        partitions: Partition[];
        vaultTotalWei: string;
      }>;
    },
    enabled: !!auth?.token,
  });
}

/**
 * Hook: Get transactions with filters
 */
export function useTransactions(filters?: {
  partitionId?: string;
  type?: string;
  socialId?: string;
}) {
  const { auth } = useAuth();

  const params = new URLSearchParams();
  if (filters?.partitionId) params.set("partitionId", filters.partitionId);
  if (filters?.type) params.set("type", filters.type);
  if (filters?.socialId) params.set("socialId", filters.socialId);

  return useQuery({
    queryKey: ["transactions", auth?.magicIssuer, filters],
    queryFn: async () => {
      if (!auth?.token) throw new Error("Not authenticated");

      const res = await fetch(
        `/api/transactions?${params}`,
        withAuth(auth.token)
      );
      if (!res.ok) throw new Error("Failed to get transactions");
      return res.json() as Promise<{ transactions: Tx[]; count: number }>;
    },
    enabled: !!auth?.token,
  });
}

/**
 * Hook: Get fund requests
 */
export function useFundRequests(status?: string) {
  const { auth } = useAuth();

  return useQuery({
    queryKey: ["fundRequests", auth?.magicIssuer, status],
    queryFn: async () => {
      if (!auth?.token) throw new Error("Not authenticated");

      const url = status
        ? `/api/fund-requests?status=${status}`
        : "/api/fund-requests";

      const res = await fetch(url, withAuth(auth.token));
      if (!res.ok) throw new Error("Failed to get fund requests");
      return res.json() as Promise<{ fundRequests: FundRequest[] }>;
    },
    enabled: !!auth?.token,
  });
}

/**
 * Hook: Create fund request
 */
export function useCreateFundRequest() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      partitionId: string;
      amountWei: string;
      reason?: string;
    }) => {
      if (!auth?.token) throw new Error("Not authenticated");

      const res = await fetch("/api/fund-requests", {
        method: "POST",
        ...withAuth(auth.token),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create fund request");
      }

      return res.json() as Promise<FundRequest>;
    },
    onSuccess: () => {
      // Refetch fund requests after creating one
      queryClient.invalidateQueries({ queryKey: ["fundRequests"] });
    },
  });
}

/**
 * Example usage in a component:
 * 
 * export function MyComponent() {
 *   const { data: partitions } = usePartitions();
 *   const { data: transactions } = useTransactions({ type: "withdraw" });
 *   const createFundRequest = useCreateFundRequest();
 * 
 *   const handleCreate = async () => {
 *     await createFundRequest.mutateAsync({
 *       partitionId: "1",
 *       amountWei: "1000000000000000000",
 *       reason: "Team budget increase",
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       {partitions?.partitions.map((p) => (
 *         <div key={p.id}>{p.label}</div>
 *       ))}
 *     </div>
 *   );
 * }
 */
